const os = require('os')
const Path = require('path')
const fs = require('fs')
const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const Scanner = require('../../../server/scanner/Scanner')
const BookFinder = require('../../../server/finders/BookFinder')
const Logger = require('../../../server/Logger')
const AudiobookDBError = require('../../../server/providers/AudiobookDBError')
const LibraryScanner = require('../../../server/scanner/LibraryScanner')
const TaskManager = require('../../../server/managers/TaskManager')
const SocketAuthority = require('../../../server/SocketAuthority')

describe('Scanner quick match explicit flag', () => {
  let searchStub
  let libraryItem
  let previousServerSettings

  beforeEach(async () => {
    previousServerSettings = Database.serverSettings
    global.ServerSettings = {
      metadataFileFormat: 'json',
      storeMetadataWithItem: false,
      scannerPreferMatchedMetadata: false
    }
    Database.serverSettings = { scannerPreferMatchedMetadata: false }
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : str)
    global.MetadataPath = Path.join(os.tmpdir(), `abs-quickmatch-${Date.now()}`)
    await Database.buildModels()

    searchStub = sinon.stub(BookFinder, 'search')
    searchStub.resolves([])
    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'debug')

    const library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
    const libraryFolder = await Database.libraryFolderModel.create({ path: '/test', libraryId: library.id })
    const book = await Database.bookModel.create({ title: 'Quick Match Book', audioFiles: [], tags: [], narrators: [], genres: [], chapters: [] })
    const item = await Database.libraryItemModel.create({
      path: '/test/quick-match-book',
      isFile: false,
      libraryFiles: [],
      mediaId: book.id,
      mediaType: 'book',
      libraryId: library.id,
      libraryFolderId: libraryFolder.id
    })
    libraryItem = await Database.libraryItemModel.getExpandedById(item.id)
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.sync({ force: true })
    await Database.sequelize.close()
    Database.serverSettings = previousServerSettings
    if (global.MetadataPath) {
      await fs.promises.rm(global.MetadataPath, { recursive: true, force: true }).catch(() => {})
      delete global.MetadataPath
    }
  })

  // Runs the real update path: Scanner.quickMatchLibraryItem with a stubbed
  // BookFinder, asserting the stored result (payload semantics), not the
  // source.
  const quickMatch = () => Scanner.quickMatchLibraryItem(null, libraryItem, { provider: 'audiobookdb' })

  it('stops a failed provider batch, retains saved matches, and finishes the task with scan cleanup', async () => {
    const library = await Database.libraryModel.findByPk(libraryItem.libraryId)
    library.provider = 'audiobookdb'
    const previousScanning = [...LibraryScanner.librariesScanning]
    const previousCancel = { ...LibraryScanner.cancelLibraryScan }
    const previousTasks = [...TaskManager.tasks]
    const emitter = sinon.stub(SocketAuthority, 'emitter')
    const failure = new AudiobookDBError('audiobookdb_rate_limited', 45)
    searchStub.onFirstCall().resolves([{ title: 'Quick Match Book', explicit: true }])
    searchStub.onSecondCall().rejects(failure)
    const items = Array.from({ length: 100 }, () => libraryItem)
    const increment = sinon.stub(Database.libraryItemModel, 'getLibraryItemsIncrement').resolves(items)
    sinon.stub(Logger, 'error')
    try {
      await Scanner.matchLibraryItems(null, library)
      sinon.assert.calledTwice(searchStub)
      sinon.assert.calledOnce(increment)
      const stored = await Database.bookModel.findByPk(libraryItem.media.id)
      expect(!!stored.explicit).to.equal(true)
      const finish = emitter.getCalls().find((call) => call.args[0] === 'task_finished')
      expect(finish).not.to.equal(undefined)
      const task = finish.args[1]
      expect(task.isFailed).to.equal(true)
      expect(task.isFinished).to.equal(true)
      expect(task.error).to.equal(failure.message)
      expect(task.data.scanResults.updated).to.equal(1)
      expect(TaskManager.tasks.some((entry) => entry.id === task.id)).to.equal(false)
      expect(LibraryScanner.librariesScanning).not.to.include(library.id)
      expect(LibraryScanner.cancelLibraryScan).not.to.have.property(library.id)
    } finally {
      LibraryScanner.librariesScanning = previousScanning
      LibraryScanner.cancelLibraryScan = previousCancel
      TaskManager.tasks = previousTasks
    }
  })

  it('applies a deliberate explicit: false from the provider match', async () => {
    // The stored item is marked explicit; the provider's explicit: false
    // must override it to false (a payload guard that treated false as
    // absent would leave it true).
    await libraryItem.media.update({ explicit: true })

    searchStub.resolves([{ title: 'Quick Match Book', explicit: false }])
    const result = await quickMatch()

    expect(result.updated).to.equal(true)
    const stored = await Database.bookModel.findByPk(libraryItem.media.id)
    expect(stored.explicit).to.equal(false)
  })

  it('applies explicit: true when the stored value is unset', async () => {
    searchStub.resolves([{ title: 'Quick Match Book', explicit: true }])
    const result = await quickMatch()

    expect(result.updated).to.equal(true)
    const stored = await Database.bookModel.findByPk(libraryItem.media.id)
    expect(!!stored.explicit).to.equal(true)
  })

  it('preserves the stored explicit value when the match omits it', async () => {
    // Absent/unknown (no explicit key) is not a signal: the existing value
    // is kept, no update is applied.
    await libraryItem.media.update({ explicit: true })

    searchStub.resolves([{ title: 'Quick Match Book' }])
    const result = await quickMatch()

    const stored = await Database.bookModel.findByPk(libraryItem.media.id)
    expect(!!stored.explicit).to.equal(true)
    expect(result.updated).to.equal(false)
  })

  it('preserves the stored explicit value when the match has an explicit null', async () => {
    // A null explicit (provider reported unknown) is not a signal: the
    // existing value is kept.
    await libraryItem.media.update({ explicit: false })

    searchStub.resolves([{ title: 'Quick Match Book', explicit: null }])
    const result = await quickMatch()

    const stored = await Database.bookModel.findByPk(libraryItem.media.id)
    expect(stored.explicit).to.equal(false)
    expect(result.updated).to.equal(false)
  })

  it('does not apply an unrelated same-prefix book from the relaxed quick-match fallback', async () => {
    searchStub.restore()
    // Set the item's author through the real association: authorName is a
    // getter-only property on Book, so passing it to update() would throw.
    await libraryItem.media.update({ title: 'Andorra' })
    await libraryItem.media.updateAuthorsFromRequest(['Kate Reading'], libraryItem.libraryId)
    libraryItem = await Database.libraryItemModel.getExpandedById(libraryItem.id)

    const audiobookdbStub = sinon.stub(BookFinder.audiobookdb, 'search').callsFake(async (title, author) => {
      if (author) return []
      return [{ id: 'andorra-work-1', title: 'Andorra Sector', author: 'A. N. Other' }]
    })
    const result = await quickMatch()

    // The real BookFinder search runs: the strict query with the item's
    // author finds nothing, then the fallback reaches the no-author
    // main-title query, which returns only the 'Andorra Sector' decoy.
    // The strict title identity gate rejects it, so automatic matching
    // abstains instead of consuming the decoy.
    expect(result.warning).to.equal('No audiobookdb match found')
    expect(audiobookdbStub.getCalls().map((call) => call.args.slice(0, 2))).to.deep.equal([
      ['Andorra', 'Kate Reading'],
      ['andorra', '']
    ])
    const stored = await Database.bookModel.findByPk(libraryItem.media.id)
    expect(stored.title).to.equal('Andorra')
    // The early no-match return carries no updated flag.
    expect(result).not.to.have.property('updated')
  })

  it('does not apply a stored-ASIN fallback when exact resolution does not identify the release', async () => {
    // Runs the real Scanner.quickMatchLibraryItem and BookFinder.search with
    // only the provider's transport stubbed: the item's stored ASIN is an
    // explicit identifier, so a miss on the exact endpoint must yield no
    // match and never fall back to a title search.
    searchStub.restore()
    await libraryItem.media.update({ asin: 'B00XYZ1234' })
    libraryItem = await Database.libraryItemModel.getExpandedById(libraryItem.id)

    const requestStub = sinon.stub(BookFinder.audiobookdb, '_request')
    requestStub.resolves(null)

    const result = await quickMatch()

    expect(result.warning).to.equal('No audiobookdb match found')
    expect(result).not.to.have.property('updated')
    // Only the exact-ASIN endpoint was consulted; a title search never ran.
    const paths = requestStub.getCalls().map((c) => c.args[0])
    expect(paths).to.deep.equal(['/audiobooks/external/audible/B00XYZ1234'])
    expect(paths).to.not.include('/search')
    const stored = await Database.bookModel.findByPk(libraryItem.media.id)
    expect(stored.asin).to.equal('B00XYZ1234')
  })
})

describe('Scanner quick match series sequence', () => {
  let searchStub
  let libraryItem
  let previousServerSettings

  beforeEach(async () => {
    previousServerSettings = Database.serverSettings
    global.ServerSettings = {
      metadataFileFormat: 'json',
      storeMetadataWithItem: false,
      scannerPreferMatchedMetadata: false
    }
    Database.serverSettings = { scannerPreferMatchedMetadata: false }
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : str)
    global.MetadataPath = Path.join(os.tmpdir(), `abs-quickmatch-${Date.now()}`)
    await Database.buildModels()

    searchStub = sinon.stub(BookFinder, 'search')
    searchStub.resolves([])
    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'debug')

    const library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
    const libraryFolder = await Database.libraryFolderModel.create({ path: '/test', libraryId: library.id })
    const book = await Database.bookModel.create({ title: 'Quick Match Book', audioFiles: [], tags: [], narrators: [], genres: [], chapters: [] })
    const item = await Database.libraryItemModel.create({
      path: '/test/quick-match-book',
      isFile: false,
      libraryFiles: [],
      mediaId: book.id,
      mediaType: 'book',
      libraryId: library.id,
      libraryFolderId: libraryFolder.id
    })
    libraryItem = await Database.libraryItemModel.getExpandedById(item.id)
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.sync({ force: true })
    await Database.sequelize.close()
    Database.serverSettings = previousServerSettings
    if (global.MetadataPath) {
      await fs.promises.rm(global.MetadataPath, { recursive: true, force: true }).catch(() => {})
      delete global.MetadataPath
    }
  })

  // Runs the real update path with overrideDetails so the series
  // association block executes even when the book already has series.
  const quickMatch = (match) => {
    searchStub.resolves(Array.isArray(match) ? match : [match])
    return Scanner.quickMatchLibraryItem(null, libraryItem, { provider: 'audiobookdb', overrideDetails: true })
  }

  const getStoredSequence = async (seriesName) => {
    const series = await Database.seriesModel.getByNameAndLibrary(seriesName, libraryItem.libraryId)
    const bookSeries = await Database.bookSeriesModel.findOne({
      where: { seriesId: series.id, bookId: libraryItem.media.id }
    })
    return bookSeries ? bookSeries.sequence : undefined
  }

  const addStoredSeries = async (name, sequence) => {
    const series = await Database.seriesModel.create({
      name,
      nameIgnorePrefix: name,
      libraryId: libraryItem.libraryId
    })
    await Database.bookSeriesModel.create({
      seriesId: series.id,
      bookId: libraryItem.media.id,
      sequence
    })
    libraryItem = await Database.libraryItemModel.getExpandedById(libraryItem.id)
  }

  it('normalizes a provider-omitted sequence on an existing series without crashing (stored "0" -> null)', async () => {
    // The live batch crash: stored sequence '0' with an upstream position
    // that the provider mapper omits (sequence undefined). The old code
    // assigned undefined to the STRING column, which Sequelize renders as
    // `UPDATE bookSeries SET  WHERE id = ...` (SQLITE_ERROR near "WHERE").
    // Native canonical form for an absent sequence is null.
    await addStoredSeries('Coffin Hotel', '0')

    const result = await quickMatch({
      title: 'Quick Match Book',
      series: [{ series: 'Coffin Hotel' }]
    })

    expect(result.updated).to.equal(true)
    expect(await getStoredSequence('Coffin Hotel')).to.equal(null)
  })

  it('leaves a stored null sequence unchanged when the provider omits it', async () => {
    await addStoredSeries('Coffin Hotel', null)

    const result = await quickMatch({
      title: 'Quick Match Book',
      series: [{ series: 'Coffin Hotel' }]
    })

    expect(result.updated).to.equal(false)
    expect(await getStoredSequence('Coffin Hotel')).to.equal(null)
  })

  it('preserves the stored sequence when the provider supplies the same value', async () => {
    await addStoredSeries('Coffin Hotel', '2')

    const result = await quickMatch({
      title: 'Quick Match Book',
      series: [{ series: 'Coffin Hotel', sequence: '2' }]
    })

    expect(result.updated).to.equal(false)
    expect(await getStoredSequence('Coffin Hotel')).to.equal('2')
  })

  it('treats a numeric supplied sequence equal to the stored string as unchanged', async () => {
    // Adapters such as Audible/CustomProviderAdapter can yield numeric
    // sequences; the stored value is a string, so 1 must not rewrite '1'.
    await addStoredSeries('Coffin Hotel', '1')

    const result = await quickMatch({
      title: 'Quick Match Book',
      series: [{ series: 'Coffin Hotel', sequence: 1 }]
    })

    expect(result.updated).to.equal(false)
    expect(await getStoredSequence('Coffin Hotel')).to.equal('1')
  })

  it('applies a real sequence change from null to a supplied value', async () => {
    await addStoredSeries('Coffin Hotel', null)

    const result = await quickMatch({
      title: 'Quick Match Book',
      series: [{ series: 'Coffin Hotel', sequence: '3' }]
    })

    expect(result.updated).to.equal(true)
    expect(await getStoredSequence('Coffin Hotel')).to.equal('3')
  })

  it('preserves fractional sequences as strings', async () => {
    // Audible publishes fractional positions (e.g. "1.5"); the value must
    // stay a string through normalization and storage.
    await addStoredSeries('Coffin Hotel', '1.5')

    const result = await quickMatch({
      title: 'Quick Match Book',
      series: [{ series: 'Coffin Hotel', sequence: '2.5' }]
    })

    expect(result.updated).to.equal(true)
    const stored = await getStoredSequence('Coffin Hotel')
    expect(stored).to.equal('2.5')
    expect(typeof stored).to.equal('string')
  })

  it('creates a new series membership with a null sequence when the provider omits it', async () => {
    const result = await quickMatch({
      title: 'Quick Match Book',
      series: [{ series: 'New Series' }]
    })

    expect(result.updated).to.equal(true)
    expect(await getStoredSequence('New Series')).to.equal(null)
  })
})
