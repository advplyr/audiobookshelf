const { expect } = require('chai')
const fs = require('fs')
const os = require('os')
const Path = require('path')
const sinon = require('sinon')
const Logger = require('../../../server/Logger')
const { LogLevel } = require('../../../server/utils/constants')
const LibraryScan = require('../../../server/scanner/LibraryScan')

function fakeLibrary() {
  return {
    id: 'lib-1',
    name: 'My Library',
    mediaType: 'book',
    libraryFolders: [{ id: 'f1' }],
    toJSON() {
      return { id: 'lib-1', name: 'My Library' }
    }
  }
}

describe('LibraryScan', () => {
  afterEach(() => sinon.restore())

  it('starts empty', () => {
    const scan = new LibraryScan()
    expect(scan.id).to.equal(null)
    expect(scan.library).to.equal(null)
    expect(scan.verbose).to.equal(false)
    expect(scan.resultsAdded).to.equal(0)
    expect(scan.resultsUpdated).to.equal(0)
    expect(scan.resultsMissing).to.equal(0)
    expect(scan.logs).to.deep.equal([])
    expect(scan.authorsNumBooksChangedIds).to.be.instanceOf(Set)
  })

  it('setData stores the library and starts the scan, defaulting the type to scan', () => {
    const library = fakeLibrary()
    const scan = new LibraryScan()
    scan.setData(library)
    expect(scan.id).to.be.a('string').and.have.length.greaterThan(10)
    expect(scan.type).to.equal('scan')
    expect(scan.library).to.equal(library)
    expect(scan.startedAt).to.be.a('number')
    expect(scan.libraryId).to.equal('lib-1')
    expect(scan.libraryName).to.equal('My Library')
    expect(scan.libraryMediaType).to.equal('book')
    expect(scan.libraryFolders).to.deep.equal([{ id: 'f1' }])

    const forced = new LibraryScan()
    forced.setData(library, 'force-rescan')
    expect(forced.type).to.equal('force-rescan')
  })

  it('setComplete records the finish time and elapsed time', () => {
    const clock = sinon.useFakeTimers(5000)
    const scan = new LibraryScan()
    scan.setData(fakeLibrary())
    clock.tick(1500)
    scan.setComplete()
    clock.restore()
    expect(scan.finishedAt).to.equal(6500)
    expect(scan.elapsed).to.equal(1500)
  })

  it('formats result strings and the elapsed time', () => {
    const scan = new LibraryScan()
    scan.resultsAdded = 2
    scan.resultsUpdated = 0
    scan.resultsMissing = 1
    scan.elapsed = 3000
    expect(scan.resultStats).to.equal('2 Added | 0 Updated | 1 Missing')
    expect(scan.elapsedTimestamp).to.equal('0:03')
    expect(scan.scanResultsString).to.match(/^2 added, 1 missing \(.+\)$/)
    expect(scan.scanResults).to.deep.equal({ added: 2, updated: 0, missing: 1, elapsed: 3000, text: scan.scanResultsString })

    const none = new LibraryScan()
    none.elapsed = 1000
    expect(none.scanResultsString).to.match(/^No changes needed \(.+\)$/)
  })

  it('builds the log filename from the date and id', () => {
    const scan = new LibraryScan()
    scan.id = 'abc'
    expect(scan.logFilename).to.match(/^\d{4}-\d{2}-\d{2}_abc\.txt$/)
  })

  it('toJSON includes the library json and result counts', () => {
    const scan = new LibraryScan()
    scan.setData(fakeLibrary())
    scan.resultsAdded = 4
    expect(scan.toJSON()).to.deep.equal({
      id: scan.id,
      type: 'scan',
      library: { id: 'lib-1', name: 'My Library' },
      startedAt: scan.startedAt,
      finishedAt: null,
      elapsed: null,
      resultsAdded: 4,
      resultsUpdated: 0,
      resultsMissing: 0
    })
  })

  it('addLog stores the level name and joined message and only writes a debug log when verbose', () => {
    const debug = sinon.stub(Logger, 'debug')
    const scan = new LibraryScan()
    scan.setData(fakeLibrary())
    scan.addLog(LogLevel.INFO, 'Found', 2, 'items')
    expect(debug.called).to.equal(false)
    expect(scan.logs[0]).to.include({ message: 'Found 2 items', levelName: 'INFO', level: LogLevel.INFO })
    expect(new Date(scan.logs[0].timestamp).toISOString()).to.equal(scan.logs[0].timestamp)

    scan.verbose = true
    scan.addLog(LogLevel.WARN, 'a', 'b')
    expect(debug.calledOnceWithExactly('[LibraryScan] "My Library":', 'a', 'b')).to.equal(true)
    expect(scan.logs).to.have.length(2)
  })

  describe('saveLog', () => {
    let dir
    let originalMetadataPath

    beforeEach(() => {
      dir = fs.mkdtempSync(Path.join(os.tmpdir(), 'abs-libscan-'))
      originalMetadataPath = global.MetadataPath
      global.MetadataPath = dir
      fs.mkdirSync(Path.join(dir, 'logs'))
      sinon.stub(Logger, 'info')
    })

    afterEach(() => {
      global.MetadataPath = originalMetadataPath
      fs.rmSync(dir, { recursive: true, force: true })
    })

    it('creates the scans folder and writes the scan json followed by one line per log', async () => {
      const scan = new LibraryScan()
      scan.setData(fakeLibrary())
      scan.addLog(LogLevel.INFO, 'first')
      scan.addLog(LogLevel.DEBUG, 'second')
      await scan.saveLog()
      const lines = fs.readFileSync(Path.join(dir, 'logs', 'scans', scan.logFilename), 'utf8').split('\n')
      expect(lines).to.have.length(4)
      expect(lines[3]).to.equal('')
      expect(JSON.parse(lines[0])).to.deep.equal(JSON.parse(JSON.stringify(scan.toJSON())))
      expect(JSON.parse(lines[1]).message).to.equal('first')
      expect(JSON.parse(lines[2]).message).to.equal('second')
    })

    it('reuses an existing scans folder', async () => {
      fs.mkdirSync(Path.join(dir, 'logs', 'scans'))
      const scan = new LibraryScan()
      scan.setData(fakeLibrary())
      await scan.saveLog()
      expect(fs.existsSync(Path.join(dir, 'logs', 'scans', scan.logFilename))).to.equal(true)
    })
  })
})
