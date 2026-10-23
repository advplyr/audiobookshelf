const { expect } = require('chai')
const sinon = require('sinon')
const Manager = require('../../../server/managers/BackupManager')
const Database = require('../../../server/Database')
const Notification = require('../../../server/managers/NotificationManager')
const Zip = require('../../../server/libs/nodeStreamZip')
const sqlite3 = require('sqlite3')
const nodeFs = require('fs/promises')
const Path = require('path')
const os = require('os')

describe('BackupManager compatibility', () => {
  let metadata, config, settings, temporary, manager
  beforeEach(async () => {
    metadata = global.MetadataPath; config = global.ConfigPath; settings = global.ServerSettings
    temporary = await nodeFs.mkdtemp(Path.join(os.tmpdir(), 'abs-phase5-backup-'))
    global.MetadataPath = temporary; global.ConfigPath = temporary
    global.ServerSettings = { backupPath: temporary, backupsToKeep: 1, maxBackupSize: 0, backupSchedule: false }
    manager = new Manager()
  })
  afterEach(async () => { sinon.restore(); global.MetadataPath = metadata; global.ConfigPath = config; global.ServerSettings = settings; await nodeFs.rm(temporary, { recursive: true, force: true }) })
  const response = () => ({ status: sinon.stub().returnsThis(), send: sinon.spy(), sendStatus: sinon.spy(), json: sinon.spy() })
  it('keeps fallback settings and returns false with original failure notification', async () => {
    expect(manager.maxBackupSize).to.equal(Infinity)
    sinon.stub(manager, 'backupSqliteDb').callsFake(() => Promise.reject('legacy failure'))
    const notify = sinon.stub(Notification, 'onBackupFailed').resolves()
    expect(await manager.runBackup()).to.equal(false)
    expect(notify.calledOnceWithExactly('legacy failure')).to.equal(true)
  })
  it('retains only the configured backups after successful archive creation', async () => {
    const sqlitePath = Path.join(temporary, 'snapshot.sqlite')
    await nodeFs.writeFile(sqlitePath, 'temporary database fixture')
    sinon.stub(manager, 'backupSqliteDb').resolves(sqlitePath)
    sinon.stub(manager, 'zipBackup').callsFake(async (path, backup) => { await nodeFs.writeFile(backup.fullPath, 'archive fixture'); return true })
    const old = { id: 'old', createdAt: 1 }; manager.backups = [old]
    const remove = sinon.stub(manager, 'removeBackup').resolves(), notify = sinon.stub(Notification, 'onBackupCompleted').resolves()
    expect(await manager.runBackup()).to.equal(true)
    expect(manager.backups).to.have.length(1)
    expect(remove.calledOnceWithExactly(old)).to.equal(true)
    expect(notify.firstCall.args.slice(1)).to.deep.equal([1, true])
    expect(manager.backups[0].fileSize).to.equal(15)
  })
  it('rejects wrong extension and oversized details without changing loaded backups', async () => {
    const res = response()
    await manager.uploadBackup({ files: { file: { name: 'backup.zip' } } }, res)
    expect(res.status.calledWithExactly(500)).to.equal(true)
    const close = sinon.stub().resolves()
    sinon.stub(Zip, 'async').returns({ entries: sinon.stub().resolves({ 'absdatabase.sqlite': {}, details: { size: 1048577 } }), close })
    await manager.uploadBackup({ files: { file: { name: 'backup.audiobookshelf', mv: sinon.stub().resolves() } } }, res)
    expect(res.status.calledWithExactly(400)).to.equal(true)
    expect(close.calledOnce).to.equal(true)
    expect(manager.backups).to.deep.equal([])
  })
  it('reconnects after missing extracted database without replacing the original database', async () => {
    const original = Path.join(temporary, 'absdatabase.sqlite')
    await nodeFs.writeFile(original, 'original fixture')
    const close = sinon.stub().resolves()
    sinon.stub(Zip, 'async').returns({ entries: sinon.stub().resolves({ 'absdatabase.sqlite': {} }), extract: sinon.stub().resolves(), close })
    const disconnect = sinon.stub(Database, 'disconnect').resolves(), reconnect = sinon.stub(Database, 'reconnect').resolves()
    const res = response()
    await manager.requestApplyBackup({ reset: sinon.spy() }, { fullPath: '/unused' }, res)
    expect(disconnect.calledOnce).to.equal(true)
    expect(reconnect.calledOnce).to.equal(true)
    expect(res.status.calledWithExactly(500)).to.equal(true)
    expect(await nodeFs.readFile(original, 'utf8')).to.equal('original fixture')
  })
  it('retains SQLite string failure reasons and backup call order', async () => {
    const handle = { completed: false, failed: true, message: 'legacy failure', step: sinon.spy(), finish: sinon.spy() }
    sinon.stub(sqlite3, 'Database').returns({ backup: sinon.stub().returns(handle) })
    expect(await manager.backupSqliteDb({ id: 'id' }).catch(e => e)).to.equal('legacy failure')
    expect(handle.step.calledWithExactly(-1)).to.equal(true)
    expect(handle.finish.calledAfter(handle.step)).to.equal(true)
  })
  it('retains timeout string after 240 polling intervals', async () => {
    const handle = { completed: false, failed: false, step: sinon.spy(), finish: sinon.spy() }
    sinon.stub(sqlite3, 'Database').returns({ backup: sinon.stub().returns(handle) })
    const clock = sinon.useFakeTimers()
    const pending = manager.backupSqliteDb({ id: 'id' }).catch(e => e)
    await clock.tickAsync(120000)
    expect(await pending).to.equal('Backup timed out')
  })
})
