const { expect } = require('chai')
const sinon = require('sinon')
const os = require('os')
const path = require('path')
const sqlite3 = require('sqlite3')
const fs = require('../../../server/libs/fsExtra')
const Logger = require('../../../server/Logger')
const Database = require('../../../server/Database')
const BackupManager = require('../../../server/managers/BackupManager')

const openDb = (dbPath) =>
  new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (error) => (error ? reject(error) : resolve(db)))
  })
const exec = (db, sql) => new Promise((resolve, reject) => db.exec(sql, (error) => (error ? reject(error) : resolve())))
const all = (db, sql) => new Promise((resolve, reject) => db.all(sql, (error, rows) => (error ? reject(error) : resolve(rows))))
const close = (db) => new Promise((resolve, reject) => db.close((error) => (error ? reject(error) : resolve())))

describe('BackupManager', () => {
  let tempDir
  let lockDb
  let backupManager
  let loggerWarnStub
  let originalConfigPath
  let originalMetadataPath

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'abs-backup-test-'))
    const dbPath = path.join(tempDir, 'absdatabase.sqlite')

    const db = await openDb(dbPath)
    await exec(db, `CREATE TABLE books (title TEXT); INSERT INTO books VALUES ('Dune');`)
    await close(db)

    originalConfigPath = global.ConfigPath
    originalMetadataPath = global.MetadataPath
    global.ConfigPath = tempDir
    global.MetadataPath = tempDir
    sinon.stub(Database, 'dbPath').value(dbPath)
    loggerWarnStub = sinon.stub(Logger, 'warn')
    sinon.stub(Logger, 'error')

    backupManager = new BackupManager()
    backupManager.sqliteBackupRetryDelayMs = 50
  })

  afterEach(async () => {
    if (lockDb) {
      await exec(lockDb, 'ROLLBACK').catch(() => {})
      await close(lockDb)
      lockDb = null
    }
    sinon.restore()
    global.ConfigPath = originalConfigPath
    global.MetadataPath = originalMetadataPath
    await fs.remove(tempDir)
  })

  // Simulates another connection holding the db lock
  const lockDatabase = async () => {
    lockDb = await openDb(Database.dbPath)
    await exec(lockDb, 'BEGIN EXCLUSIVE')
  }

  describe('backupSqliteDb', () => {
    it('copies the database to a new file in the config directory', async () => {
      const backupPath = await backupManager.backupSqliteDb({ id: 'test-backup' })

      expect(backupPath).to.equal(path.join(tempDir, 'absdatabase.test-backup.sqlite'))
      const backupDb = await openDb(backupPath)
      const rows = await all(backupDb, 'SELECT title FROM books')
      await close(backupDb)
      expect(rows).to.deep.equal([{ title: 'Dune' }])
      expect(loggerWarnStub.called).to.be.false
    })

    it('retries when the database is locked and succeeds once the lock is released', async function () {
      this.timeout(10000)
      await lockDatabase()
      // Release the lock when the first failed attempt logs its retry warning
      const db = lockDb
      loggerWarnStub.callsFake(() => exec(db, 'ROLLBACK').catch(() => {}))

      const backupPath = await backupManager.backupSqliteDb({ id: 'test-backup' })

      expect(loggerWarnStub.called).to.be.true
      const backupDb = await openDb(backupPath)
      const rows = await all(backupDb, 'SELECT title FROM books')
      await close(backupDb)
      expect(rows).to.deep.equal([{ title: 'Dune' }])
    })

    it('rejects instead of crashing when the database stays locked', async function () {
      this.timeout(10000)
      backupManager.sqliteBackupMaxAttempts = 2
      await lockDatabase()

      let error = null
      try {
        await backupManager.backupSqliteDb({ id: 'test-backup' })
      } catch (err) {
        error = err
      }

      expect(error).to.be.an('error')
      expect(error.code).to.equal('SQLITE_BUSY')
      expect(loggerWarnStub.calledOnce).to.be.true
      expect(await fs.pathExists(path.join(tempDir, 'absdatabase.test-backup.sqlite'))).to.be.false
    })

    it('rejects with the sqlite error when removing the partial backup file also fails', async function () {
      this.timeout(10000)
      backupManager.sqliteBackupMaxAttempts = 1
      sinon.stub(fs, 'remove').rejects(new Error('remove failed'))
      await lockDatabase()

      let error = null
      try {
        await backupManager.backupSqliteDb({ id: 'test-backup' })
      } catch (err) {
        error = err
      }

      expect(error.code).to.equal('SQLITE_BUSY')
    })
  })

  describe('stepSqliteBackup', () => {
    it('throws instead of looping when a step finishes without completing', async () => {
      const sqliteBackup = { step: sinon.stub().callsArgWith(1, null, false) }

      let error = null
      try {
        await backupManager.stepSqliteBackup(sqliteBackup)
      } catch (err) {
        error = err
      }

      expect(error).to.be.an('error')
      expect(sqliteBackup.step.calledOnce).to.be.true
    })
  })
})
