const { expect } = require('chai')
const sinon = require('sinon')
const Logger = require('../../../server/Logger')
const { LogLevel } = require('../../../server/utils/constants')
const ScanLogger = require('../../../server/scanner/ScanLogger')

describe('ScanLogger', () => {
  afterEach(() => sinon.restore())

  it('starts empty and serializes only the summary fields', () => {
    const scanLogger = new ScanLogger()
    expect(scanLogger.verbose).to.equal(false)
    expect(scanLogger.logs).to.deep.equal([])
    expect(scanLogger.authorsRemovedFromBooks).to.deep.equal([])
    expect(scanLogger.authorsNumBooksChangedIds).to.be.instanceOf(Set)
    expect(scanLogger.seriesRemovedFromBooks).to.deep.equal([])
    expect(scanLogger.toJSON()).to.deep.equal({ id: null, type: null, name: null, startedAt: null, finishedAt: null, elapsed: null })
  })

  it('setData creates an id and start time', () => {
    const scanLogger = new ScanLogger()
    scanLogger.setData('library', 'My Library')
    expect(scanLogger.id).to.be.a('string').and.have.length.greaterThan(10)
    expect(scanLogger.type).to.equal('library')
    expect(scanLogger.name).to.equal('My Library')
    expect(scanLogger.startedAt).to.be.a('number')
  })

  it('setComplete records the finish time and elapsed time', () => {
    const clock = sinon.useFakeTimers(1000)
    const scanLogger = new ScanLogger()
    scanLogger.setData('library', 'L')
    clock.tick(250)
    scanLogger.setComplete()
    clock.restore()
    expect(scanLogger.finishedAt).to.equal(1250)
    expect(scanLogger.elapsed).to.equal(250)
  })

  it('addLog stores the level name and the joined message without logging when not verbose', () => {
    const debug = sinon.stub(Logger, 'debug')
    const scanLogger = new ScanLogger()
    scanLogger.addLog(LogLevel.INFO, 'Found', 3, 'files')
    expect(debug.called).to.equal(false)
    expect(scanLogger.logs).to.have.length(1)
    expect(scanLogger.logs[0]).to.include({ message: 'Found 3 files', levelName: 'INFO', level: LogLevel.INFO })
    expect(new Date(scanLogger.logs[0].timestamp).toISOString()).to.equal(scanLogger.logs[0].timestamp)
  })

  it('addLog also writes a debug log when verbose', () => {
    const debug = sinon.stub(Logger, 'debug')
    const scanLogger = new ScanLogger()
    scanLogger.verbose = true
    scanLogger.name = 'Scan'
    scanLogger.addLog(LogLevel.WARN, 'a', 'b')
    expect(debug.calledOnceWithExactly('[Scan] "Scan":', 'a', 'b')).to.equal(true)
    expect(scanLogger.logs[0].levelName).to.equal('WARN')
  })
})
