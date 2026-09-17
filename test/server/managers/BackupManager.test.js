const { expect } = require('chai')
const sinon = require('sinon')
const os = require('os')
const Path = require('path')
const EventEmitter = require('events')
const childProcess = require('child_process')
const sqlite3 = require('sqlite3')

const BackupManager = require('../../../server/managers/BackupManager')
const Backup = require('../../../server/objects/Backup')
const Database = require('../../../server/Database')

describe('BackupManager', () => {
  let originalDialect
  let originalDbPath
  let originalConfigPath
  let originalMetadataPath

  beforeEach(() => {
    originalDialect = Database.dialect
    originalDbPath = Database.dbPath
    originalConfigPath = global.ConfigPath
    originalMetadataPath = global.MetadataPath
    global.MetadataPath = os.tmpdir()
  })

  afterEach(() => {
    Database.dialect = originalDialect
    Database.dbPath = originalDbPath
    global.ConfigPath = originalConfigPath
    global.MetadataPath = originalMetadataPath
    sinon.restore()
  })

  it('should select Postgres custom-format backups for the Postgres dialect', () => {
    Database.dialect = 'postgres'
    const manager = new BackupManager()

    expect(manager.databaseBackupConfig).to.deep.equal({
      dialect: 'postgres',
      entryName: 'absdatabase.postgres.dump'
    })
  })

  it('should create Postgres dumps with pg_dump without exposing credentials in argv', async () => {
    Database.dialect = 'postgres'
    Database.dbPath = 'postgresql://absuser:secretpass@localhost:5432/audiobookshelf'
    global.ConfigPath = os.tmpdir()

    const execFileStub = sinon.stub(childProcess, 'execFile').callsFake((command, args, options, callback) => {
      callback(null, '', '')
    })
    const manager = new BackupManager()
    const backup = new Backup()
    backup.id = '2026-08-02T0130'

    const dumpPath = await manager.backupPostgresDb(backup)

    expect(dumpPath).to.equal(Path.join(os.tmpdir(), 'absdatabase.2026-08-02T0130.postgres.dump'))
    expect(execFileStub.calledOnce).to.equal(true)
    expect(execFileStub.firstCall.args[0]).to.equal('pg_dump')
    expect(execFileStub.firstCall.args[1]).to.deep.equal([
      '--format=custom',
      '--no-owner',
      '--no-acl',
      '--file',
      dumpPath,
      '--host',
      'localhost',
      '--dbname',
      'audiobookshelf',
      '--port',
      '5432',
      '--username',
      'absuser'
    ])
    expect(execFileStub.firstCall.args[1].join(' ')).to.not.include('secretpass')
    expect(execFileStub.firstCall.args[2].env.PGPASSWORD).to.equal('secretpass')
    expect(execFileStub.firstCall.args[2].timeout).to.be.a('number')
  })

  it('should restore Postgres dumps in one transaction and clean existing objects', async () => {
    Database.dialect = 'postgres'
    Database.dbPath = 'postgresql://absuser:secretpass@localhost:5432/audiobookshelf'

    const execFileStub = sinon.stub(childProcess, 'execFile').callsFake((command, args, options, callback) => {
      callback(null, '', '')
    })
    const manager = new BackupManager()

    await manager.restorePostgresDb('/config/absdatabase-postgres-temp.dump')

    expect(execFileStub.firstCall.args[0]).to.equal('pg_restore')
    expect(execFileStub.firstCall.args[1]).to.deep.equal([
      '--clean',
      '--if-exists',
      '--exit-on-error',
      '--single-transaction',
      '--no-owner',
      '--no-acl',
      '/config/absdatabase-postgres-temp.dump',
      '--host',
      'localhost',
      '--dbname',
      'audiobookshelf',
      '--port',
      '5432',
      '--username',
      'absuser'
    ])
    expect(execFileStub.firstCall.args[1].join(' ')).to.not.include('secretpass')
    expect(execFileStub.firstCall.args[2].env.PGPASSWORD).to.equal('secretpass')
  })

  it('should redact database credentials from failed pg command errors', async () => {
    Database.dialect = 'postgres'
    Database.dbPath = 'postgresql://absuser:secretpass@localhost:5432/audiobookshelf'
    global.ConfigPath = os.tmpdir()

    sinon.stub(childProcess, 'execFile').callsFake((command, args, options, callback) => {
      const error = new Error('Command failed: pg_dump --dbname postgresql://absuser:secretpass@localhost/audiobookshelf\npg_dump: error: password authentication failed')
      error.cmd = 'pg_dump --dbname postgresql://absuser:secretpass@localhost/audiobookshelf'
      callback(error, '', 'connection using password secretpass failed')
    })
    const manager = new BackupManager()
    const backup = new Backup()
    backup.id = '2026-08-02T0130'

    let error
    try {
      await manager.backupPostgresDb(backup)
    } catch (caughtError) {
      error = caughtError
    }

    expect(error).to.be.an('error')
    expect(error.message).to.not.include('secretpass')
    expect(error.cmd).to.not.include('secretpass')
    expect(error.stderr).to.not.include('secretpass')
    expect(error.message).to.include('***')
  })

  it('should reject pg commands when DATABASE_URL is not a valid URI', async () => {
    Database.dialect = 'postgres'
    Database.dbPath = 'not a connection uri'
    global.ConfigPath = os.tmpdir()

    const manager = new BackupManager()
    const backup = new Backup()
    backup.id = '2026-08-02T0130'

    let error
    try {
      await manager.backupPostgresDb(backup)
    } catch (caughtError) {
      error = caughtError
    }

    expect(error).to.be.an('error')
    expect(error.message).to.include('valid postgres connection URI')
  })

  it('should reject SQLite backup open errors without an uncaught sqlite event', async () => {
    Database.dialect = 'sqlite'
    Database.dbPath = '/config/absdatabase.sqlite'
    global.ConfigPath = os.tmpdir()

    sinon.stub(sqlite3, 'Database').callsFake(function (_dbPath, callback) {
      const db = new EventEmitter()
      db.close = (closeCallback) => closeCallback()
      process.nextTick(() => callback(Object.assign(new Error('unable to open database file'), { code: 'SQLITE_CANTOPEN' })))
      return db
    })

    const manager = new BackupManager()
    const backup = new Backup()
    backup.id = '2026-08-02T0130'

    let error
    try {
      await manager.backupSqliteDb(backup)
    } catch (caughtError) {
      error = caughtError
    }

    expect(error).to.be.an('error')
    expect(error.code).to.equal('SQLITE_CANTOPEN')
  })
})
