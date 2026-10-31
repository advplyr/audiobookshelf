const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')
const Database = require('../../../server/Database')
const filters = require('../../../server/utils/queries/libraryItemFilters')
const bookFilters = require('../../../server/utils/queries/libraryItemsBookFilters')
const podcastFilters = require('../../../server/utils/queries/libraryItemsPodcastFilters')

describe('library item filters', () => {
  let previousSequelize
  let previousSettings
  let library
  let otherLibrary
  let bookItem
  let podcastItem
  beforeEach(async () => {
    previousSequelize = Database.sequelize
    previousSettings = global.ServerSettings
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
    library = await Database.libraryModel.create({ name: 'Library', mediaType: 'book' })
    otherLibrary = await Database.libraryModel.create({ name: 'Other', mediaType: 'podcast' })
    const book = await Database.bookModel.create({ title: 'Book', tags: ['Favorite'], genres: ['History'], narrators: ['Reader'] })
    const podcast = await Database.podcastModel.create({ title: 'Podcast', tags: ['Favorite'], genres: ['History'] })
    bookItem = await Database.libraryItemModel.create({ libraryId: library.id, mediaId: book.id, mediaType: 'book', size: 10 })
    podcastItem = await Database.libraryItemModel.create({ libraryId: otherLibrary.id, mediaId: podcast.id, mediaType: 'podcast', size: 20 })
  })
  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.close()
    Database.sequelize = previousSequelize
    global.ServerSettings = previousSettings
  })

  it('expands both media types for matching tags and genres', async () => {
    for (const items of [await filters.getAllLibraryItemsWithTags(['Favorite']), await filters.getAllLibraryItemsWithGenres(['History'])]) {
      expect(items.map((item) => item.id)).to.have.members([bookItem.id, podcastItem.id])
      expect(items.find((item) => item.id === bookItem.id).media.authors).to.deep.equal([])
      expect(items.find((item) => item.id === podcastItem.id).media.podcastEpisodes).to.deep.equal([])
    }
    expect(await filters.getAllLibraryItemsWithTags(['Absent'])).to.deep.equal([])
    expect(await filters.getAllLibraryItemsWithGenres(['Absent'])).to.deep.equal([])
  })

  it('scopes narrator matches and size ordering to the requested library', async () => {
    expect((await filters.getAllLibraryItemsWithNarrators(['Reader'], library.id)).map((item) => item.id)).to.deep.equal([bookItem.id])
    expect(await filters.getAllLibraryItemsWithNarrators(['Reader'], otherLibrary.id)).to.deep.equal([])
    const secondBook = await Database.bookModel.create({ title: 'Larger' })
    const secondItem = await Database.libraryItemModel.create({ libraryId: library.id, mediaId: secondBook.id, mediaType: 'book', size: 30 })
    expect(await filters.getLargestItems(library.id, 1)).to.deep.equal([{ id: secondItem.id, title: 'Larger', size: 30 }])
    expect(await filters.getLargestItems(otherLibrary.id, 5)).to.deep.equal([{ id: podcastItem.id, title: 'Podcast', size: 20 }])
  })

  it('delegates searches to the matching media query with the initial offset', async () => {
    const user = {}
    const bookResult = { book: [], narrators: [], authors: [], tags: [], genres: [], series: [] }
    const podcastResult = { podcast: [], tags: [], genres: [], episodes: [] }
    const books = sinon.stub(bookFilters, 'search').resolves(bookResult)
    const podcasts = sinon.stub(podcastFilters, 'search').resolves(podcastResult)
    expect(await filters.search(user, library, 'query', 5)).to.equal(bookResult)
    expect(await filters.search(user, otherLibrary, 'query', 5)).to.equal(podcastResult)
    sinon.assert.calledOnceWithExactly(books, user, library, 'query', 5, 0)
    sinon.assert.calledOnceWithExactly(podcasts, user, otherLibrary, 'query', 5, 0)
  })
})
