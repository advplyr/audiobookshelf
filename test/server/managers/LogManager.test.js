const { expect } = require('chai')
const sinon = require('sinon')
const LogManager = require('../../../server/managers/LogManager')
const DailyLog = require('../../../server/objects/DailyLog')
const fs = require('../../../server/libs/fsExtra')
const { LogLevel } = require('../../../server/utils/constants')

describe('LogManager compatibility', () => {
  let metadataPath, settings
  beforeEach(() => { metadataPath = global.MetadataPath; settings = global.ServerSettings; global.MetadataPath = '/temporary'; global.ServerSettings = {} })
  afterEach(() => { sinon.restore(); global.MetadataPath = metadataPath; global.ServerSettings = settings })
  const log = { timestamp: 'now', source: 'test', message: 'message', levelName: 'INFO', level: LogLevel.INFO }
  it('buffers until initialized and returns empty string without a daily log', async () => {
    const manager = new LogManager()
    await manager.logToFile(log)
    expect(manager.dailyLogBuffer).to.deep.equal([log])
    expect(manager.getMostRecentCurrentDailyLogs()).to.equal('')
    expect(manager.loggerDailyLogsToKeep).to.equal(7)
  })
  it('flushes buffered logs and sorts/filter filenames on initialization', async () => {
    const manager = new LogManager(), append = sinon.stub(DailyLog.prototype, 'appendLog').resolves()
    sinon.stub(fs, 'ensureDir').resolves()
    sinon.stub(fs, 'readdir').resolves(['z.txt', 'unknown.json', 'a.txt'])
    await manager.logToFile(log)
    await manager.init()
    expect(manager.dailyLogFiles.slice(0, 2)).to.deep.equal(['a.txt', 'z.txt'])
    expect(append.calledOnceWithExactly(log)).to.equal(true)
    expect(manager.dailyLogBuffer).to.deep.equal([])
  })
  it('removes missing filenames but keeps failed unlink entries', async () => {
    const manager = new LogManager()
    manager.dailyLogFiles = ['missing.txt', 'failed.txt']
    sinon.stub(fs, 'pathExists').onFirstCall().resolves(false).onSecondCall().resolves(true)
    sinon.stub(fs, 'unlink').rejects(new Error('denied'))
    await manager.removeLogFile('missing.txt')
    await manager.removeLogFile('failed.txt')
    expect(manager.dailyLogFiles).to.deep.equal(['failed.txt'])
  })
  it('logs fatal crashes before buffering daily logs', async () => {
    const manager = new LogManager(), crash = sinon.stub(manager, 'logCrashToFile').resolves()
    const fatal = { ...log, level: LogLevel.FATAL }
    await manager.logToFile(fatal)
    expect(crash.calledOnceWithExactly(fatal)).to.equal(true)
    expect(manager.dailyLogBuffer).to.deep.equal([fatal])
  })
  it('keeps the historical recent-log array response', () => {
    const manager = new LogManager()
    manager.currentDailyLog = new DailyLog('/temporary')
    manager.currentDailyLog.logs = [log]
    expect(manager.getMostRecentCurrentDailyLogs()).to.deep.equal([log])
  })
})
