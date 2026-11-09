const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')

describe('Book author and series updates', () => {
  /** @type {import('../../../server/models/Library')} */
  let library
  /** @type {import('../../../server/models/Book')} */
  let book

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
    book = await Database.bookModel.create({ title: 'Test Book', audioFiles: [], tags: [], narrators: [], genres: [], chapters: [] })
    book.authors = []
    book.series = []
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.sync({ force: true })
  })

  it('does not throw when the bookSeries link already exists', async () => {
    const series = await Database.seriesModel.create({ name: 'Crescent City', libraryId: library.id })
    await Database.bookSeriesModel.create({ bookId: book.id, seriesId: series.id, sequence: '3' })

    const result = await book.updateSeriesFromRequest([{ name: 'Crescent City', sequence: '3' }], library.id)

    expect(result.hasUpdates).to.be.false
    const links = await Database.bookSeriesModel.findAll({ where: { bookId: book.id, seriesId: series.id } })
    expect(links).to.have.lengthOf(1)
  })

  it('reuses an existing series when create hits the name unique constraint', async () => {
    const series = await Database.seriesModel.create({ name: 'Crescent City', libraryId: library.id })
    sinon.stub(Database.seriesModel, 'getByNameAndLibrary').resolves(null)

    const result = await book.updateSeriesFromRequest([{ name: 'Crescent City', sequence: '3' }], library.id)

    expect(result.seriesAdded).to.have.lengthOf(1)
    expect(result.seriesAdded[0].id).to.equal(series.id)
    const seriesRows = await Database.seriesModel.findAll({ where: { libraryId: library.id, name: 'Crescent City' } })
    expect(seriesRows).to.have.lengthOf(1)
    const links = await Database.bookSeriesModel.findAll({ where: { bookId: book.id, seriesId: series.id } })
    expect(links).to.have.lengthOf(1)
  })

  it('does not throw when the bookAuthor link already exists', async () => {
    const author = await Database.authorModel.create({ name: 'Sarah Maas', libraryId: library.id })
    await Database.bookAuthorModel.create({ bookId: book.id, authorId: author.id })

    const result = await book.updateAuthorsFromRequest(['Sarah Maas'], library.id)

    expect(result.authorsAdded).to.have.lengthOf(0)
    const links = await Database.bookAuthorModel.findAll({ where: { bookId: book.id, authorId: author.id } })
    expect(links).to.have.lengthOf(1)
  })
})
