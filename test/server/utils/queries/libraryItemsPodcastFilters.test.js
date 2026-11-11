const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../../server/Database')
const LibraryController = require('../../../../server/controllers/LibraryController')
const libraryItemsPodcastFilters = require('../../../../server/utils/queries/libraryItemsPodcastFilters')

describe('libraryItemsPodcastFilters.getRecentEpisodes', () => {
  let library
  const user = {
    id: 'a2b4a5f2-34c3-4d5a-9d8e-3bd1b1e8d4c1',
    canAccessExplicitContent: true,
    permissions: { accessAllTags: true }
  }

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    library = await Database.libraryModel.create({ name: 'Podcasts', mediaType: 'podcast' })
    const libraryFolder = await Database.libraryFolderModel.create({ path: '/podcasts', libraryId: library.id })
    const podcast = await Database.podcastModel.create({ title: 'Test Podcast', tags: [], genres: [], autoDownloadEpisodes: false })
    await Database.libraryItemModel.create({
      libraryFiles: [],
      mediaId: podcast.id,
      mediaType: 'podcast',
      libraryId: library.id,
      libraryFolderId: libraryFolder.id
    })

    for (let i = 1; i <= 3; i++) {
      await Database.podcastEpisodeModel.create({
        podcastId: podcast.id,
        title: `Episode ${i}`,
        index: i,
        publishedAt: new Date(2026, 0, i),
        audioFile: { ino: `${i}`, metadata: { filename: `ep${i}.mp3`, ext: '.mp3', path: `/ep${i}.mp3`, relPath: `ep${i}.mp3` } }
      })
    }
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.sync({ force: true })
  })

  it('returns every episode, newest first, when the limit is 0', async () => {
    const episodes = await libraryItemsPodcastFilters.getRecentEpisodes(user, library, 0, 0)

    expect(episodes.map((ep) => ep.title)).to.deep.equal(['Episode 3', 'Episode 2', 'Episode 1'])
  })

  it('applies the limit and offset when a limit is given', async () => {
    const episodes = await libraryItemsPodcastFilters.getRecentEpisodes(user, library, 2, 2)

    expect(episodes.map((ep) => ep.title)).to.deep.equal(['Episode 1'])
  })

  describe('GET /libraries/:id/recent-episodes', () => {
    async function getRecentEpisodes(query) {
      const req = { query, user, library }
      const res = { json: sinon.spy(), sendStatus: sinon.spy() }
      await LibraryController.getRecentEpisodes(req, res)
      return res.json.firstCall.args[0]
    }

    it('returns every episode when no limit is passed', async () => {
      const payload = await getRecentEpisodes({})

      expect(payload.limit).to.equal(0)
      expect(payload.episodes).to.have.length(3)
    })

    it('reads limit and page from the query string as numbers', async () => {
      const payload = await getRecentEpisodes({ limit: '2', page: '1' })

      expect(payload.limit).to.equal(2)
      expect(payload.page).to.equal(1)
      expect(payload.episodes.map((ep) => ep.title)).to.deep.equal(['Episode 1'])
    })
  })
})
