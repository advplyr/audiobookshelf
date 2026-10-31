const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')
const Database = require('../../../server/Database')
const filters = require('../../../server/utils/queries/libraryFilters')

describe('library filter summaries', () => {
  let previousSequelize
  let previousSettings
  let previousFilterData
  let library
  let podcastLibrary
  let user
  let book
  let item
  let series
  let podcast
  let podcastItem
  let episode
  beforeEach(async () => {
    previousSequelize = Database.sequelize
    previousSettings = global.ServerSettings
    previousFilterData = Database.libraryFilterData
    global.ServerSettings = { sortingIgnorePrefix: false }
    Database.libraryFilterData = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
    library = await Database.libraryModel.create({ name: 'Books', mediaType: 'book', settings: {} })
    podcastLibrary = await Database.libraryModel.create({ name: 'Podcasts', mediaType: 'podcast', settings: {} })
    user = await Database.userModel.create({ username: 'reader', isActive: true, permissions: { accessExplicitContent: true, accessAllTags: true } })
    book = await Database.bookModel.create({ title: 'Book', audioFiles: [], tags: ['Tag10', 'Tag2'], genres: ['History'], narrators: ['Reader'], publisher: 'Publisher', publishedYear: '1995', language: 'en', explicit: false })
    item = await Database.libraryItemModel.create({ libraryId: library.id, mediaType: 'book', mediaId: book.id, size: 10, libraryFiles: [], isMissing: true })
    series = await Database.seriesModel.create({ libraryId: library.id, name: 'Series' })
    await Database.bookSeriesModel.create({ bookId: book.id, seriesId: series.id, sequence: '1' })
    const author = await Database.authorModel.create({ libraryId: library.id, name: 'Author' })
    await Database.bookAuthorModel.create({ bookId: book.id, authorId: author.id })
    podcast = await Database.podcastModel.create({ title: 'Podcast', tags: ['Tag10', 'Tag2'], genres: ['History'], language: 'en', explicit: false, numEpisodes: 1 })
    podcastItem = await Database.libraryItemModel.create({ libraryId: podcastLibrary.id, mediaType: 'podcast', mediaId: podcast.id, size: 20, libraryFiles: [] })
    episode = await Database.podcastEpisodeModel.create({ podcastId: podcast.id, title: 'Episode', audioFile: { duration: 10, metadata: {} } })
  })
  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.close()
    Database.sequelize = previousSequelize
    Database.libraryFilterData = previousFilterData
    global.ServerSettings = previousSettings
  })

  it('builds naturally sorted book filter menus and reuses fresh cached data', async () => {
    const data = await filters.getFilterData('book', library.id)
    expect(data.tags).to.deep.equal(['Tag2', 'Tag10'])
    expect(data.genres).to.deep.equal(['History'])
    expect(data.narrators).to.deep.equal(['Reader'])
    expect(data.publishedDecades).to.deep.equal(['1990'])
    expect(data).to.include({ bookCount: 1, authorCount: 1, seriesCount: 1, podcastCount: 0, numIssues: 1 })
    expect(data.authors[0].name).to.equal('Author')
    expect(data.series[0].name).to.equal('Series')
    const count = sinon.spy(Database.bookModel, 'count')
    expect(await filters.getFilterData('book', library.id)).to.equal(data)
    sinon.assert.notCalled(count)
  })

  it('refreshes expired unchanged cache entries and reloads after library item deletion', async () => {
    for (const table of ['books', 'libraryItems', 'series', 'authors']) {
      await Database.sequelize.query(`UPDATE ${table} SET updatedAt = '2000-01-01 00:00:00.000 +00:00'`)
    }
    const data = await filters.getFilterData('book', library.id)
    data.loadedAt = Date.now() - 31 * 60 * 1000
    expect(await filters.getFilterData('book', library.id)).to.equal(data)
    expect(data.loadedAt).to.be.greaterThan(Date.now() - 1000)
    await item.destroy()
    data.loadedAt = Date.now() - 31 * 60 * 1000
    const refreshed = await filters.getFilterData('book', library.id)
    expect(refreshed.bookCount).to.equal(0)
    expect(refreshed.tags).to.deep.equal([])
    expect(refreshed).not.to.equal(data)
  })

  it('builds podcast filter menus and returns recent episode shelf JSON', async () => {
    const data = await filters.getFilterData('podcast', podcastLibrary.id)
    expect(data.tags).to.deep.equal(['Tag2', 'Tag10'])
    expect(data.languages).to.deep.equal(['en'])
    expect(data).to.include({ podcastCount: 1, bookCount: 0 })
    const result = await filters.getNewestPodcastEpisodes(podcastLibrary, user, 10)
    expect(result.count).to.equal(1)
    expect(result.libraryItems[0]).to.include({ id: podcastItem.id })
    expect(result.libraryItems[0].recentEpisode.id).to.equal(episode.id)
    expect((await filters.getNewestPodcastEpisodes(library, user, 10)).count).to.equal(0)
  })

  it('serializes book progress, completion, series and author shelves', async () => {
    await Database.feedModel.create({ entityId: item.id, entityType: 'libraryItem', slug: 'feed' })
    const progress = await Database.mediaProgressModel.create({ userId: user.id, mediaItemId: book.id, mediaItemType: 'book', currentTime: 2, isFinished: false, hideFromContinueListening: false })
    const inProgress = await filters.getMediaItemsInProgress(library, user, ['rssfeed'], 10)
    expect(inProgress.items[0]).to.include({ id: item.id })
    expect(inProgress.items[0].rssFeed.id).to.be.a('string')
    await progress.update({ isFinished: true })
    expect((await filters.getMediaFinished(library, user, [], 10)).items[0].id).to.equal(item.id)
    const recent = await filters.getLibraryItemsMostRecentlyAdded(library, user, [], 10)
    expect(recent.libraryItems[0].media.size).to.equal(10)
    const seriesShelf = await filters.getSeriesMostRecentlyAdded(library, user, [], 10)
    expect(seriesShelf.series[0]).to.include({ id: series.id })
    expect(seriesShelf.series[0].books[0].id).to.equal(item.id)
    expect((await filters.getNewestAuthors(library, user, 10)).authors[0]).to.include({ name: 'Author', numBooks: 1 })
  })

  it('delegates encoded filters and preserves invalid decoding behavior', async () => {
    const result = await filters.getFilteredLibraryItems(library.id, user, { filterBy: `tags.${Buffer.from('Tag2').toString('base64')}`, sortBy: 'addedAt', sortDesc: false, limit: 10, offset: 0, collapseseries: false, include: [], mediaType: 'book' })
    expect(result.libraryItems.map((li) => li.id)).to.deep.equal([item.id])
    expect(filters.decode('%invalid')).to.equal(null)
  })
})
