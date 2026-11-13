const chai = require('chai')
const { expect } = chai
const { Sequelize } = require('sequelize')

const Database = require('../../../../server/Database')
const libraryItemsPodcastFilters = require('../../../../server/utils/queries/libraryItemsPodcastFilters')

describe('libraryItemsPodcastFilters search', () => {
  let library
  let folder
  let user

  async function createPodcast(title, episodes) {
    const podcast = await Database.podcastModel.create({ title })
    await Database.libraryItemModel.create({
      mediaType: 'podcast',
      mediaId: podcast.id,
      libraryId: library.id,
      libraryFolderId: folder.id,
      path: `/data/podcasts/${title}`,
      libraryFiles: []
    })
    for (const episode of episodes) {
      const ep = await Database.podcastEpisodeModel.create({ podcastId: podcast.id, title: episode.title })
      await Database.libraryItemModel.create({
        mediaType: 'episode',
        mediaId: ep.id,
        libraryId: library.id,
        libraryFolderId: folder.id,
        path: `/data/podcasts/${title}/${episode.filename}`,
        libraryFiles: [{ metadata: { path: `/data/podcasts/${title}/${episode.filename}`, filename: episode.filename, ext: `.${episode.filename.split('.').pop()}` } }]
      })
    }
    return podcast
  }

  beforeEach(async () => {
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    global.ServerSettings = { sortingPrefixes: [], titlePostfixExclusions: [] }
    await Database.buildModels()
    await Database.sequelize.sync({ force: true })

    library = await Database.libraryModel.create({ name: 'Podcast Library', mediaType: 'podcast' })
    folder = await Database.libraryFolderModel.create({ path: '/test', libraryId: library.id })
    user = { canAccessExplicitContent: true, permissions: { accessAllTags: true } }

    await createPodcast('Test Podcast', [{ title: 'Episode One', filename: 'ep-one.mp3' }])
    await createPodcast('Other Show', [{ title: 'Episode Two', filename: 'episode-two.m4a' }])
  })

  it('returns the parent podcast when an episode file path matches', async () => {
    const results = await libraryItemsPodcastFilters.search(user, library, 'ep-one.mp3', 12, 0)
    const titles = results.podcast.map((r) => r.libraryItem.media.metadata.title)
    expect(titles).to.deep.equal(['Test Podcast'])
  })

  it('returns a podcast matching title and episode file exactly once', async () => {
    await createPodcast('ep-one.mp3 Favorites', [{ title: 'Rerun', filename: 'rerun-ep-one.mp3' }])
    const results = await libraryItemsPodcastFilters.search(user, library, 'ep-one.mp3', 12, 0)
    const titles = results.podcast.map((r) => r.libraryItem.media.metadata.title)
    expect(titles.filter((t) => t === 'ep-one.mp3 Favorites').length).to.equal(1)
  })

  it('does not change results for metadata-only queries', async () => {
    const results = await libraryItemsPodcastFilters.search(user, library, 'Show', 12, 0)
    const titles = results.podcast.map((r) => r.libraryItem.media.metadata.title)
    expect(titles).to.deep.equal(['Other Show'])
  })

  it('returns empty podcast bucket when a file-shape query matches nothing', async () => {
    const results = await libraryItemsPodcastFilters.search(user, library, 'nomatch.mp3', 12, 0)
    expect(results.podcast).to.deep.equal([])
  })
})
