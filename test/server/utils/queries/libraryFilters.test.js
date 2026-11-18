const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../../server/Database')
const Logger = require('../../../../server/Logger')
const libraryFilters = require('../../../../server/utils/queries/libraryFilters')
const libraryItemFilters = require('../../../../server/utils/queries/libraryItemFilters')

describe('libraryFilters.getFilteredLibraryItems with search filter', () => {
  let user

  const searchFilter = (query) => `search.${Buffer.from(query).toString('base64')}`
  const getOptions = (filterBy, mediaType, options = {}) => ({ filterBy, sortBy: 'media.metadata.title', sortDesc: false, limit: 0, offset: 0, collapseseries: false, include: [], mediaType, ...options })

  async function createLibrary(mediaType) {
    const library = await Database.libraryModel.create({ name: `${mediaType} library`, mediaType })
    const libraryFolder = await Database.libraryFolderModel.create({ path: `/${mediaType}`, libraryId: library.id })
    return { library, libraryFolder }
  }

  async function createBook({ library, libraryFolder }, title, bookData = {}) {
    const book = await Database.bookModel.create({ title, explicit: false, audioFiles: [], tags: [], narrators: [], genres: [], chapters: [], ...bookData })
    await Database.libraryItemModel.create({ path: `/book/${title}`, isFile: false, libraryFiles: [], mediaId: book.id, mediaType: 'book', libraryId: library.id, libraryFolderId: libraryFolder.id })
    return book
  }

  async function createPodcast({ library, libraryFolder }, title, author) {
    const podcast = await Database.podcastModel.create({ title, author, explicit: false, tags: [], genres: [] })
    await Database.libraryItemModel.create({ path: `/podcast/${title}`, isFile: false, libraryFiles: [], mediaId: podcast.id, mediaType: 'podcast', libraryId: library.id, libraryFolderId: libraryFolder.id })
  }

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    user = await Database.userModel.create({
      username: 'admin',
      pash: 'hash',
      token: 'token',
      type: 'admin',
      isActive: true,
      permissions: Database.userModel.getDefaultPermissionsForUserType('admin'),
      bookmarks: [],
      extraData: {}
    })

    sinon.stub(Logger, 'debug')
    sinon.stub(Logger, 'info')
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.sync({ force: true })
  })

  it('returns every book matching the search query without the search result limit', async () => {
    const libraryData = await createLibrary('book')
    for (let i = 1; i <= 15; i++) {
      await createBook(libraryData, `Star Trek ${i}`)
    }
    await createBook(libraryData, 'Prometheus', { subtitle: 'A Star Trek Novel' })
    await createBook(libraryData, 'Dune')

    const { libraryItems, count } = await libraryFilters.getFilteredLibraryItems(libraryData.library.id, user, getOptions(searchFilter('star trek'), 'book'))

    expect(count).to.equal(16)
    expect(libraryItems).to.have.lengthOf(16)
    expect(libraryItems.map((li) => li.media.title)).to.not.include('Dune')
  })

  it('matches the same books as library search', async () => {
    const libraryData = await createLibrary('book')
    await createBook(libraryData, 'Star Trek: Prometheus')
    await createBook(libraryData, 'Some Book', { subtitle: 'Prometheus Rising' })
    await createBook(libraryData, 'Another Book', { asin: 'B0PROMETHEUS' })
    await createBook(libraryData, 'Dune')

    const searchResults = await libraryItemFilters.search(user, libraryData.library, 'Prometheus', 12)
    const { libraryItems } = await libraryFilters.getFilteredLibraryItems(libraryData.library.id, user, getOptions(searchFilter('Prometheus'), 'book'))

    expect(libraryItems.map((li) => li.id).sort()).to.deep.equal(searchResults.book.map((result) => result.libraryItem.id).sort())
    expect(libraryItems).to.have.lengthOf(3)
  })

  it('does not collapse series when filtering by search', async () => {
    const libraryData = await createLibrary('book')
    const series = await Database.seriesModel.create({ name: 'Prometheus', libraryId: libraryData.library.id })
    const book1 = await createBook(libraryData, 'Star Trek Prometheus 1')
    const book2 = await createBook(libraryData, 'Star Trek Prometheus 2')
    await Database.bookSeriesModel.create({ bookId: book1.id, seriesId: series.id, sequence: '1' })
    await Database.bookSeriesModel.create({ bookId: book2.id, seriesId: series.id, sequence: '2' })

    const { count } = await libraryFilters.getFilteredLibraryItems(libraryData.library.id, user, getOptions(searchFilter('Star Trek'), 'book', { collapseseries: true }))

    expect(count).to.equal(2)
  })

  it('returns every podcast matching the search query by title or author', async () => {
    const libraryData = await createLibrary('podcast')
    await createPodcast(libraryData, 'Trek Talk', 'Someone')
    await createPodcast(libraryData, 'Other Podcast', 'Star Trek Fans')
    await createPodcast(libraryData, 'Cooking', 'Chef')

    const { libraryItems, count } = await libraryFilters.getFilteredLibraryItems(libraryData.library.id, user, getOptions(searchFilter('trek'), 'podcast'))

    expect(count).to.equal(2)
    expect(libraryItems.map((li) => li.media.title).sort()).to.deep.equal(['Other Podcast', 'Trek Talk'])
  })
})
