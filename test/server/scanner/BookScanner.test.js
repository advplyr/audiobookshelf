const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')
const BookScanner = require('../../../server/scanner/BookScanner')
const LibraryScan = require('../../../server/scanner/LibraryScan')

describe('BookScanner.rescanExistingBookLibraryItem', () => {
  /** @type {import('../../../server/models/Library')} */
  let library
  /** @type {import('../../../server/models/LibraryItem')} */
  let libraryItem
  /** @type {import('../../../server/models/Book')} */
  let book
  /** @type {LibraryScan} */
  let libraryScan

  const librarySettings = { audiobooksOnly: true }

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'debug')
    sinon.stub(Logger, 'warn')
    sinon.stub(Logger, 'error')

    library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
    const libraryFolder = await Database.libraryFolderModel.create({ path: '/test', libraryId: library.id })
    book = await Database.bookModel.create({ title: 'Test Book', audioFiles: [], tags: [], narrators: [], genres: [], chapters: [], coverPath: '/cover.jpg' })
    libraryItem = await Database.libraryItemModel.create({
      libraryFiles: [],
      mediaId: book.id,
      mediaType: 'book',
      libraryId: library.id,
      libraryFolderId: libraryFolder.id
    })
    libraryItem.isMissing = true
    libraryItem.isFile = true
    // Stale associations: the rows exist in the database, but this scan's loaded book does not see them
    sinon.stub(libraryItem, 'getMedia').callsFake(async () => {
      book.authors = []
      book.series = []
      book.audioFiles = []
      book.coverPath = '/cover.jpg'
      return book
    })

    libraryScan = new LibraryScan()
    libraryScan.library = library
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.sync({ force: true })
  })

  function scanData() {
    return {
      hasAudioFileChanges: false,
      audioLibraryFiles: [],
      imageLibraryFiles: [],
      imageLibraryFilesRemoved: [],
      imageLibraryFilesModified: [],
      ebookLibraryFiles: [],
      ebookLibraryFilesModified: [],
      libraryId: library.id
    }
  }

  it('does not throw when the bookSeries link already exists', async () => {
    const series = await Database.seriesModel.create({ name: 'Crescent City', libraryId: library.id })
    await Database.bookSeriesModel.create({ bookId: book.id, seriesId: series.id, sequence: '3' })
    sinon.stub(BookScanner, 'getBookMetadataFromScanData').resolves({
      title: 'Test Book',
      authors: [],
      series: [{ name: 'Crescent City', sequence: '3' }]
    })

    const result = await BookScanner.rescanExistingBookLibraryItem(libraryItem, scanData(), librarySettings, libraryScan)

    expect(result.wasUpdated).to.be.true
    const links = await Database.bookSeriesModel.findAll({ where: { bookId: book.id, seriesId: series.id } })
    expect(links).to.have.lengthOf(1)
  })

  it('reuses an existing series when create hits the name unique constraint', async () => {
    const series = await Database.seriesModel.create({ name: 'Crescent City', libraryId: library.id })
    sinon.stub(Database, 'getSeriesIdByName').resolves(null)
    sinon.stub(BookScanner, 'getBookMetadataFromScanData').resolves({
      title: 'Test Book',
      authors: [],
      series: [{ name: 'Crescent City', sequence: '3' }]
    })

    await BookScanner.rescanExistingBookLibraryItem(libraryItem, scanData(), librarySettings, libraryScan)

    const seriesRows = await Database.seriesModel.findAll({ where: { libraryId: library.id, name: 'Crescent City' } })
    expect(seriesRows).to.have.lengthOf(1)
    const links = await Database.bookSeriesModel.findAll({ where: { bookId: book.id, seriesId: series.id } })
    expect(links).to.have.lengthOf(1)
  })

  it('does not throw when the bookAuthor link already exists', async () => {
    const author = await Database.authorModel.create({ name: 'Sarah Maas', libraryId: library.id })
    await Database.bookAuthorModel.create({ bookId: book.id, authorId: author.id })
    sinon.stub(BookScanner, 'getBookMetadataFromScanData').resolves({
      title: 'Test Book',
      authors: ['Sarah Maas'],
      series: []
    })

    await BookScanner.rescanExistingBookLibraryItem(libraryItem, scanData(), librarySettings, libraryScan)

    const links = await Database.bookAuthorModel.findAll({ where: { bookId: book.id, authorId: author.id } })
    expect(links).to.have.lengthOf(1)
  })
})
