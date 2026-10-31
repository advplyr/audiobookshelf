const { expect } = require('chai')
const sinon = require('sinon')
const fs = require('node:fs/promises')
const os = require('node:os')
const Path = require('node:path')
const DailyLog = require('../../../server/objects/DailyLog')

describe('DailyLog', () => {
  let directory
  let log

  beforeEach(async () => {
    directory = await fs.mkdtemp(Path.join(os.tmpdir(), 'abs-daily-log-'))
    log = new DailyLog(directory)
  })

  afterEach(async () => {
    sinon.restore()
    await fs.rm(directory, { recursive: true, force: true })
  })

  it('serializes file information without including in-memory logs', () => {
    expect(log.toJSON()).to.deep.equal({
      id: DailyLog.getCurrentDateString(),
      dailyLogDirPath: directory,
      fullPath: Path.join(directory, log.filename),
      filename: DailyLog.getCurrentDailyLogFilename(),
      createdAt: log.createdAt
    })
  })

  it('flushes concurrent appends in order and releases the lock', async () => {
    const first = { timestamp: 'now', source: 'test', message: 'first', levelName: 'INFO', level: 2 }
    const second = { ...first, message: 'second' }
    await Promise.all([log.appendLog(first), log.appendLog(second)])
    expect(await fs.readFile(log.fullPath, 'utf8')).to.equal(`${JSON.stringify(first)}\n${JSON.stringify(second)}\n`)
    expect(log.logs).to.deep.equal([first, second])
    expect(log.bufferedLogLines).to.deep.equal([])
    expect(log.locked).to.equal(false)
  })

  it('removes malformed lines while retaining truthy JSON values without shape validation', async () => {
    sinon.stub(console, 'error')
    sinon.stub(console, 'log')
    await fs.writeFile(log.fullPath, '{"message":"saved"}\ninvalid\n\n42\nfalse\n')
    await log.loadLogs()
    expect(log.logs).to.deep.equal([{ message: 'saved' }, 42])
    expect(await fs.readFile(log.fullPath, 'utf8')).to.equal('{"message":"saved"}\n42\n')
  })

  it('returns without creating a missing log file', async () => {
    sinon.stub(console, 'error')
    await log.loadLogs()
    expect(log.logs).to.deep.equal([])
    try {
      await fs.access(log.fullPath)
      expect.fail('Expected the log file to remain absent')
    } catch (error) {
      expect(error.code).to.equal('ENOENT')
    }
  })
})
