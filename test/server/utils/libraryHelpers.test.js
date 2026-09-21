const { expect } = require('chai')
const { Sequelize } = require('sequelize')

const Database = require('../../../server/Database')
const libraryHelpers = require('../../../server/utils/libraryHelpers')

describe('libraryHelpers.handleCollapseSubseries', () => {
  let library
  let libraryFolder
  let filteredSeries
  let user

  beforeEach(async () => {
    global.ServerSettings = { sortingIgnorePrefix: false }
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    Database.serverSettings = { sortingIgnorePrefix: false }
    library = await Database.libraryModel.create({
      name: 'Test Library',
      mediaType: 'book',
      settings: { hideSingleBookSeries: false }
    })
    libraryFolder = await Database.libraryFolderModel.create({ path: '/test-lib', libraryId: library.id })
    filteredSeries = await Database.seriesModel.create({ name: 'Filtered Series', libraryId: library.id })
    user = {
      checkCanAccessLibraryItem: () => true
    }
  })

  afterEach(async () => {
    await Database.sequelize.close()
  })

  async function createBook({ title, authorNames = [], publishedYear = null, sequence, subseries }) {
    const book = await Database.bookModel.create({
      title,
      publishedYear,
      audioFiles: [],
      tags: [],
      narrators: [],
      genres: [],
      chapters: []
    })
    const libraryItem = await Database.libraryItemModel.create({
      path: `/test-lib/${title.toLowerCase().replaceAll(' ', '-')}`,
      libraryFiles: [],
      mediaId: book.id,
      mediaType: 'book',
      libraryId: library.id,
      libraryFolderId: libraryFolder.id
    })

    for (const name of authorNames) {
      const author = await Database.authorModel.create({ name, libraryId: library.id })
      await Database.bookAuthorModel.create({ bookId: book.id, authorId: author.id })
    }

    await Database.bookSeriesModel.create({ bookId: book.id, seriesId: filteredSeries.id, sequence })

    if (subseries) {
      await Database.bookSeriesModel.create({ bookId: book.id, seriesId: subseries.series.id, sequence: subseries.sequence })
    }

    return { book, libraryItem }
  }

  async function createFixture({ includeSubseries = false } = {}) {
    const subseries = includeSubseries
      ? await Database.seriesModel.create({ name: 'The Collapsed Subseries', libraryId: library.id })
      : null

    const books = {}
    books.zed = await createBook({
      title: 'Zed Book',
      authorNames: ['Zed Alpha'],
      publishedYear: '2020',
      sequence: '1',
      subseries: subseries ? { series: subseries, sequence: '1' } : null
    })
    books.aaron = await createBook({
      title: 'Aaron Book',
      authorNames: ['Aaron Zebra'],
      publishedYear: '1999',
      sequence: '2',
      subseries: subseries ? { series: subseries, sequence: '2' } : null
    })
    books.noAuthor = await createBook({
      title: 'No Author',
      publishedYear: null,
      sequence: '3'
    })
    books.middle = await createBook({
      title: 'Middle Book',
      authorNames: ['Bob Beta', 'Cara Gamma'],
      publishedYear: '2010',
      sequence: '4'
    })

    return { books, subseries }
  }

  function makePayload(overrides = {}) {
    return {
      results: [],
      total: undefined,
      limit: 0,
      page: 0,
      sortBy: undefined,
      sortDesc: false,
      ...overrides
    }
  }

  function getTitles(results) {
    return results.map((item) => item.media.metadata.title)
  }

  it('sorts a filtered series by first-last author name', async () => {
    await createFixture()

    const payload = makePayload({ sortBy: 'media.metadata.authorName' })
    const results = await libraryHelpers.handleCollapseSubseries(payload, filteredSeries.id, user, library)

    expect(getTitles(results)).to.deep.equal(['No Author', 'Aaron Book', 'Middle Book', 'Zed Book'])
  })

  it('sorts a filtered series by last-first author name', async () => {
    await createFixture()

    const payload = makePayload({ sortBy: 'media.metadata.authorNameLF' })
    const results = await libraryHelpers.handleCollapseSubseries(payload, filteredSeries.id, user, library)

    expect(getTitles(results)).to.deep.equal(['No Author', 'Zed Book', 'Middle Book', 'Aaron Book'])
  })

  it('sorts a filtered series by published year in both directions', async () => {
    await createFixture()

    const ascendingPayload = makePayload({ sortBy: 'media.metadata.publishedYear' })
    const ascendingResults = await libraryHelpers.handleCollapseSubseries(ascendingPayload, filteredSeries.id, user, library)
    expect(getTitles(ascendingResults)).to.deep.equal(['Aaron Book', 'Middle Book', 'Zed Book', 'No Author'])

    const descendingPayload = makePayload({ sortBy: 'media.metadata.publishedYear', sortDesc: true })
    const descendingResults = await libraryHelpers.handleCollapseSubseries(descendingPayload, filteredSeries.id, user, library)
    expect(getTitles(descendingResults)).to.deep.equal(['No Author', 'Zed Book', 'Middle Book', 'Aaron Book'])
  })

  it('keeps ordinary books and collapsed subseries in the expected order', async () => {
    const { subseries } = await createFixture({ includeSubseries: true })

    const authorPayload = makePayload({ sortBy: 'media.metadata.authorName' })
    const authorResults = await libraryHelpers.handleCollapseSubseries(authorPayload, filteredSeries.id, user, library)
    expect(authorPayload.total).to.equal(3)
    expect(getTitles(authorResults)).to.deep.equal(['No Author', 'Middle Book', 'Zed Book'])
    expect(authorResults[2].collapsedSeries).to.deep.include({
      name: subseries.name,
      numBooks: 2
    })

    const sequencePayload = makePayload({ sortBy: 'sequence' })
    const sequenceResults = await libraryHelpers.handleCollapseSubseries(sequencePayload, filteredSeries.id, user, library)
    expect(getTitles(sequenceResults)).to.deep.equal(['Zed Book', 'No Author', 'Middle Book'])

    const titlePayload = makePayload({ sortBy: 'media.metadata.title' })
    const titleResults = await libraryHelpers.handleCollapseSubseries(titlePayload, filteredSeries.id, user, library)
    expect(getTitles(titleResults)).to.deep.equal(['Middle Book', 'No Author', 'Zed Book'])

    const pagePayload = makePayload({ sortBy: 'media.metadata.title', limit: 2, page: 1 })
    const pageResults = await libraryHelpers.handleCollapseSubseries(pagePayload, filteredSeries.id, user, library)
    expect(pagePayload.total).to.equal(3)
    expect(pageResults).to.have.length(1)
    expect(pageResults[0].collapsedSeries.name).to.equal(subseries.name)
    expect(pageResults[0].media.metadata.series).to.deep.include({
      id: filteredSeries.id,
      name: filteredSeries.name,
      sequence: '1'
    })
  })
})
