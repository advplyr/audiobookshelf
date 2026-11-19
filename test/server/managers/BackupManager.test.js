const { expect } = require('chai')
const sinon = require('sinon')
const os = require('os')
const Path = require('path')
const { Sequelize } = require('sequelize')

const fs = require('../../../server/libs/fsExtra')
const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')
const BackupManager = require('../../../server/managers/BackupManager')

describe('BackupManager', () => {
  let tempDir
  let originalConfigPath
  let originalMetadataPath
  let originalSequelize
  let originalDbPath
  /** @type {BackupManager} */
  let backupManager

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(Path.join(os.tmpdir(), 'abs-backup-test-'))
    originalConfigPath = global.ConfigPath
    originalMetadataPath = global.MetadataPath
    originalSequelize = Database.sequelize
    originalDbPath = Database.dbPath
    global.ConfigPath = tempDir
    global.MetadataPath = Path.join(tempDir, 'metadata')

    backupManager = new BackupManager()
    backupManager.sqliteBackupStepDelayMs = 0
    backupManager.sqliteBackupLockRetryDelayMs = 0

    sinon.stub(Logger, 'debug')
    sinon.stub(Logger, 'warn')
    sinon.stub(Logger, 'error')
  })

  afterEach(async () => {
    sinon.restore()
    if (Database.sequelize && Database.sequelize !== originalSequelize) {
      await Database.sequelize.close()
    }
    Database.sequelize = originalSequelize
    Database.dbPath = originalDbPath
    global.ConfigPath = originalConfigPath
    global.MetadataPath = originalMetadataPath
    await fs.remove(tempDir)
  })

  describe('backupSqliteDb', () => {
    beforeEach(async () => {
      Database.dbPath = Path.join(tempDir, 'absdatabase.sqlite')
      Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: Database.dbPath, logging: false })
      await Database.sequelize.query('CREATE TABLE filler (id INTEGER PRIMARY KEY, data TEXT)')
      await Database.sequelize.query('CREATE TABLE progress (id INTEGER PRIMARY KEY, currentTime REAL)')
      await Database.sequelize.query('INSERT INTO progress VALUES (1, 0)')
      const data = 'x'.repeat(1000)
      const values = Array.from({ length: 2000 }, (_, i) => `(${i}, '${data}')`).join(',')
      await Database.sequelize.query(`INSERT INTO filler VALUES ${values}`)
    })

    async function readBackup(backupPath) {
      const backupDb = new Sequelize({ dialect: 'sqlite', storage: backupPath, logging: false })
      try {
        const [[result]] = await backupDb.query('SELECT (SELECT count(*) FROM filler) AS fillerCount, (SELECT currentTime FROM progress WHERE id = 1) AS currentTime')
        const [[integrity]] = await backupDb.query('PRAGMA integrity_check')
        return { ...result, integrity: integrity.integrity_check }
      } finally {
        await backupDb.close()
      }
    }

    it('should copy the db in batches while writes keep working and include those writes', async () => {
      backupManager.sqliteBackupPagesPerStep = 10
      backupManager.sqliteBackupStepDelayMs = 5

      let backupDone = false
      const backupPromise = backupManager.backupSqliteDb({ id: 'test' }).finally(() => (backupDone = true))

      // Simulates listening progress being synced while the backup runs
      let writes = 0
      while (!backupDone) {
        await Database.sequelize.query('UPDATE progress SET currentTime = currentTime + 1 WHERE id = 1')
        writes++
        await new Promise((resolve) => setTimeout(resolve, 5))
      }
      const backupPath = await backupPromise

      expect(backupPath).to.equal(Path.join(tempDir, 'absdatabase.test.sqlite'))
      expect(writes).to.be.greaterThan(1)
      const backup = await readBackup(backupPath)
      expect(backup.integrity).to.equal('ok')
      expect(backup.fillerCount).to.equal(2000)
      // Every write that finished before the backup completed is in the backup
      expect(backup.currentTime).to.be.at.least(writes - 1)
    })

    it('should wait for a lock held by another connection and then complete', async () => {
      backupManager.sqliteBackupPagesPerStep = 10
      backupManager.sqliteBackupLockRetryDelayMs = 50
      // Shorter than the lock so the backup step fails with SQLITE_BUSY instead of waiting it out
      await Database.sequelize.query('PRAGMA busy_timeout = 50')

      // Hold an exclusive lock from a second connection, e.g. a long write transaction
      const otherDb = new Sequelize({ dialect: 'sqlite', storage: Database.dbPath, logging: false })
      const transaction = await otherDb.transaction({ type: Sequelize.Transaction.TYPES.EXCLUSIVE })
      await otherDb.query('UPDATE progress SET currentTime = 100 WHERE id = 1', { transaction })
      const releaseLock = new Promise((resolve) => setTimeout(resolve, 300)).then(() => transaction.commit())

      try {
        const backupPath = await backupManager.backupSqliteDb({ id: 'test' })
        await releaseLock

        const backup = await readBackup(backupPath)
        expect(backup.integrity).to.equal('ok')
        expect(backup.fillerCount).to.equal(2000)
        expect(backup.currentTime).to.equal(100)
        expect(Logger.warn.calledOnce).to.be.true
      } finally {
        await releaseLock.catch(() => {})
        await otherDb.close()
      }
    })

    it('should leave the server db connection open', async () => {
      await backupManager.backupSqliteDb({ id: 'test' })

      const [[result]] = await Database.sequelize.query('SELECT currentTime FROM progress WHERE id = 1')
      expect(result.currentTime).to.equal(0)
    })

    describe('with a stubbed sqlite backup', () => {
      let fakeBackup
      let stepResults

      beforeEach(() => {
        stepResults = []
        fakeBackup = {
          completed: false,
          failed: false,
          remaining: 100,
          pageCount: 100,
          step: sinon.spy((pages, callback) => {
            const result = stepResults.shift() || {}
            if (result.remaining !== undefined) fakeBackup.remaining = result.remaining
            if (result.completed) fakeBackup.completed = true
            if (result.failed) fakeBackup.failed = true
            setTimeout(() => callback(result.error || null), 0)
          }),
          finish: sinon.spy((callback) => setTimeout(callback, 0))
        }
        const fakeDb = {
          backup: (filePath, callback) => {
            fs.writeFileSync(filePath, 'partial')
            setTimeout(() => callback(null), 0)
            return fakeBackup
          }
        }
        sinon.stub(Database.sequelize.dialect.connectionManager, 'getConnection').resolves(fakeDb)
      })

      function sqliteError(code) {
        const error = new Error(`${code}: error`)
        error.code = code
        return error
      }

      it('should retry a step when the db is busy or locked and warn once', async () => {
        stepResults = [{ error: sqliteError('SQLITE_BUSY') }, { error: sqliteError('SQLITE_LOCKED') }, { completed: true, remaining: 0 }]

        const backupPath = await backupManager.backupSqliteDb({ id: 'test' })

        expect(backupPath).to.equal(Path.join(tempDir, 'absdatabase.test.sqlite'))
        expect(fakeBackup.step.callCount).to.equal(3)
        expect(fakeBackup.finish.calledOnce).to.be.true
        expect(Logger.warn.calledOnce).to.be.true
      })

      it('should reject and remove the partial backup file when a step fails', async () => {
        stepResults = [{ error: sqliteError('SQLITE_IOERR'), failed: true }]

        let error = null
        await backupManager.backupSqliteDb({ id: 'test' }).catch((err) => (error = err))

        expect(error).to.be.an('error')
        expect(error.code).to.equal('SQLITE_IOERR')
        expect(fakeBackup.finish.calledOnce).to.be.true
        expect(await fs.pathExists(Path.join(tempDir, 'absdatabase.test.sqlite'))).to.be.false
      })

      it('should keep copying in batches when the backup restarts', async () => {
        stepResults = [{ remaining: 50 }, { remaining: 90 }, { remaining: 50 }, { remaining: 90 }, { remaining: 50 }, { completed: true, remaining: 0 }]

        await backupManager.backupSqliteDb({ id: 'test' })

        const pagesPerStep = fakeBackup.step.getCalls().map((call) => call.args[0])
        expect(pagesPerStep).to.deep.equal([500, 500, 500, 500, 500, 500])
      })

      it('should reject when the backup times out', async () => {
        backupManager.sqliteBackupTimeoutMs = 0

        let error = null
        await backupManager.backupSqliteDb({ id: 'test' }).catch((err) => (error = err))

        expect(error).to.be.an('error')
        expect(error.message).to.include('Backup timed out')
        expect(fakeBackup.finish.calledOnce).to.be.true
        expect(await fs.pathExists(Path.join(tempDir, 'absdatabase.test.sqlite'))).to.be.false
      })
    })
  })
})
