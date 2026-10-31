const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')
const Database = require('../../../server/Database')
const filters = require('../../../server/utils/queries/libraryItemsPodcastFilters')

describe('podcast filters', () => {
  let previousSequelize
  let previousSettings
  let library
  let user
  let podcast
  let item
  let firstEpisode
  let secondEpisode
  beforeEach(async () => {
    previousSequelize = Database.sequelize
    previousSettings = global.ServerSettings
    global.ServerSettings = { sortingIgnorePrefix: false }
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
    filters.clearCountCache('test', 'setup')
    library = await Database.libraryModel.create({ name: 'Library', mediaType: 'podcast' })
    user = await Database.userModel.create({ username: 'reader', isActive: true, permissions: { accessExplicitContent: true, accessAllTags: true } })
    podcast = await Database.podcastModel.create({ title: 'History Podcast', titleIgnorePrefix: 'History Podcast', author: 'Historian', tags: ['History'], genres: ['History'], explicit: false, numEpisodes: 2 })
    item = await Database.libraryItemModel.create({ libraryId: library.id, mediaId: podcast.id, mediaType: 'podcast', size: 30, libraryFiles: [] })
    firstEpisode = await Database.podcastEpisodeModel.create({ podcastId: podcast.id, title: 'History First', publishedAt: new Date(2020, 0, 1), audioFile: { duration: 10, metadata: {} } })
    secondEpisode = await Database.podcastEpisodeModel.create({ podcastId: podcast.id, title: 'History Second', publishedAt: new Date(2020, 0, 2), audioFile: { duration: 20, metadata: {} } })
    await Database.mediaProgressModel.create({ userId: user.id, mediaItemId: firstEpisode.id, mediaItemType: 'podcastEpisode', podcastId: podcast.id, isFinished: true, currentTime: 10, hideFromContinueListening: false })
    await Database.mediaProgressModel.create({ userId: user.id, mediaItemId: secondEpisode.id, mediaItemType: 'podcastEpisode', podcastId: podcast.id, isFinished: false, currentTime: 5, hideFromContinueListening: false })
    user = await Database.userModel.getUserById(user.id)
  })
  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.close()
    Database.sequelize = previousSequelize
    global.ServerSettings = previousSettings
  })

  it('caches unfiltered counts and preserves unbounded pagination and incomplete episodes', async () => {
    const count = sinon.spy(Database.podcastModel, 'count')
    for (let i = 0; i < 2; i++) {
      const result = await filters.getFilteredLibraryItems(library.id, user, null, null, 'media.metadata.title', false, ['numepisodesincomplete'], 0, 0)
      expect(result.count).to.equal(1)
      expect(result.libraryItems[0]).to.include({ id: item.id, numEpisodesIncomplete: 1 })
      expect(result.libraryItems[0].media.title).to.equal('History Podcast')
    }
    sinon.assert.calledOnce(count)
  })

  it('applies tag permissions and metadata filters to podcast lists', async () => {
    const result = await filters.getFilteredLibraryItems(library.id, user, 'genres', 'History', 'addedAt', false, [], 10, 0)
    expect(result.libraryItems.map((li) => li.id)).to.deep.equal([item.id])
    user.permissions = { accessExplicitContent: true, accessAllTags: false, selectedTagsNotAccessible: true, itemTagsSelected: ['History'] }
    const restricted = await filters.getFilteredLibraryItems(library.id, user, null, null, 'addedAt', false, [], 10, 0)
    expect(restricted.count).to.equal(0)
    expect(restricted.libraryItems).to.deep.equal([])
  })

  it('returns in-progress episodes and respects hidden home page progress', async () => {
    const result = await filters.getFilteredPodcastEpisodes(library.id, user, 'progress', 'in-progress', 'progress', true, 10, 0, true)
    expect(result.count).to.equal(1)
    expect(result.libraryItems[0].recentEpisode.id).to.equal(secondEpisode.id)
    const progress = user.mediaProgresses.find((mp) => mp.mediaItemId === secondEpisode.id)
    await progress.update({ hideFromContinueListening: true })
    expect((await filters.getFilteredPodcastEpisodes(library.id, user, 'progress', 'in-progress', 'progress', true, 10, 0, true)).count).to.equal(0)
    const recent = await filters.getRecentEpisodes(user, library, 10, 0)
    expect(recent.map((ep) => ep.id)).to.deep.equal([secondEpisode.id])
    expect(recent[0]).to.include({ libraryId: library.id })
    expect(recent[0].podcast.metadata.title).to.equal('History Podcast')
  })

  it('searches titles, episodes and JSON metadata with legacy result groups', async () => {
    const result = await filters.search(user, library, 'History', 10, 0)
    expect(result.podcast.map((match) => match.libraryItem.id)).to.deep.equal([item.id])
    expect(result.episodes).to.have.length(2)
    expect(result.episodes.map((match) => match.libraryItem.recentEpisode.id)).to.have.members([firstEpisode.id, secondEpisode.id])
    expect(result.tags).to.deep.equal([{ name: 'History', numItems: 1 }])
    expect(result.genres).to.deep.equal([{ name: 'History', numItems: 1 }])
  })

  it('reads duration, size and genre aggregates from SQLite projections', async () => {
    expect(await filters.getPodcastLibraryStats(library.id)).to.deep.equal({ totalSize: 30, totalDuration: 30, totalItems: 1, numAudioFiles: 2 })
    expect(await filters.getGenresWithCount(library.id)).to.deep.equal([{ genre: 'History', count: 1 }])
    expect(await filters.getLongestPodcasts(library.id, 1)).to.deep.equal([{ id: item.id, title: 'History Podcast', duration: 30 }])
  })
})
