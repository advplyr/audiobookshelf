const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')
const Scanner = require('../../../server/scanner/Scanner')

describe('Scanner.quickMatchBookBuildUpdatePayload', () => {
  /** @type {import('../../../server/models/Library')} */
  let library
  /** @type {import('../../../server/models/LibraryItem')} */
  let libraryItem
  /** @type {import('../../../server/models/Book')} */
  let book

  const apiRouterCtx = {
    checkRemoveAuthorsWithNoBooks: sinon.stub().resolves(),
    checkRemoveEmptySeries: sinon.stub().resolves()
  }

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
    book = await Database.bookModel.create({ title: 'Test Book', audioFiles: [], tags: [], narrators: [], genres: [], chapters: [] })
    libraryItem = await Database.libraryItemModel.create({
      libraryFiles: [],
      mediaId: book.id,
      mediaType: 'book',
      libraryId: library.id,
      libraryFolderId: libraryFolder.id
    })
    libraryItem.media = book
    // Stale in-memory associations: DB may already have links from a concurrent quick match
    book.authors = []
    book.series = []
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.sync({ force: true })
  })

  it('does not throw when bookSeries link already exists from a concurrent quick match', async () => {
    const series = await Database.seriesModel.create({ name: 'Crescent City', libraryId: library.id })
    await Database.bookSeriesModel.create({ bookId: book.id, seriesId: series.id, sequence: '3' })

    const result = await Scanner.quickMatchBookBuildUpdatePayload(
      apiRouterCtx,
      libraryItem,
      {
        series: [{ series: 'Crescent City', sequence: '3' }]
      },
      {}
    )

    expect(result.hasSeriesUpdates).to.be.true
    expect(libraryItem.media.series).to.have.lengthOf(1)
    expect(libraryItem.media.series[0].id).to.equal(series.id)
    expect(libraryItem.media.series[0].bookSeries).to.exist
    expect(libraryItem.media.series[0].bookSeries.sequence).to.equal('3')

    const links = await Database.bookSeriesModel.findAll({ where: { bookId: book.id, seriesId: series.id } })
    expect(links).to.have.lengthOf(1)
  })

  it('does not throw when bookAuthor link already exists from a concurrent quick match', async () => {
    const author = await Database.authorModel.create({ name: 'Sarah Maas', libraryId: library.id })
    await Database.bookAuthorModel.create({ bookId: book.id, authorId: author.id })

    const result = await Scanner.quickMatchBookBuildUpdatePayload(
      apiRouterCtx,
      libraryItem,
      {
        author: ['Sarah Maas']
      },
      {}
    )

    expect(result.hasAuthorUpdates).to.be.true
    expect(libraryItem.media.authors).to.have.lengthOf(1)
    expect(libraryItem.media.authors[0].id).to.equal(author.id)

    const links = await Database.bookAuthorModel.findAll({ where: { bookId: book.id, authorId: author.id } })
    expect(links).to.have.lengthOf(1)
  })
})
