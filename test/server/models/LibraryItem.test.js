const { expect } = require('chai')
const { Sequelize } = require('sequelize')

const Database = require('../../../server/Database')

describe('LibraryItem', () => {
  describe('findAllExpandedWhere', () => {
    const numEpisodes = 5
    let podcastLibraryItemId
    let episodeIds
    /** @type {string[]} */
    let loggedSql

    beforeEach(async () => {
      global.ServerSettings = {}
      loggedSql = []
      Database.sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: ':memory:',
        logging: (sql) => loggedSql.push(sql)
      })
      Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
      await Database.buildModels()

      const library = await Database.libraryModel.create({ name: 'Podcast Library', mediaType: 'podcast' })
      const libraryFolder = await Database.libraryFolderModel.create({ path: '/podcasts', libraryId: library.id })

      const podcast = await Database.podcastModel.create({ title: 'Test Podcast', tags: [], genres: [], autoDownloadEpisodes: false })

      // A large libraryFiles array, like a real podcast folder with many audio files
      const libraryFiles = []
      for (let i = 0; i < 200; i++) {
        libraryFiles.push({ ino: `${i}`, metadata: { filename: `ep${i}.mp3`, ext: '.mp3', path: `/podcasts/test/ep${i}.mp3`, relPath: `ep${i}.mp3`, size: 1000 } })
      }
      const libraryItem = await Database.libraryItemModel.create({
        libraryFiles,
        mediaId: podcast.id,
        mediaType: 'podcast',
        libraryId: library.id,
        libraryFolderId: libraryFolder.id
      })
      podcastLibraryItemId = libraryItem.id

      episodeIds = []
      for (let i = 0; i < numEpisodes; i++) {
        const episode = await Database.podcastEpisodeModel.create({
          podcastId: podcast.id,
          title: `Episode ${i}`,
          index: i,
          audioFile: { ino: `${i}`, metadata: { filename: `ep${i}.mp3`, ext: '.mp3', path: `/podcasts/test/ep${i}.mp3`, relPath: `ep${i}.mp3` } }
        })
        episodeIds.push(episode.id)
      }

      loggedSql = []
    })

    afterEach(async () => {
      Database.sequelize.options.logging = false
      await Database.sequelize.sync({ force: true })
    })

    it('should return the podcast library item with all of its episodes attached', async () => {
      const libraryItems = await Database.libraryItemModel.findAllExpandedWhere({ id: [podcastLibraryItemId] })

      expect(libraryItems).to.have.length(1)
      const libraryItem = libraryItems[0]
      expect(libraryItem.isPodcast).to.be.true
      expect(libraryItem.libraryFiles).to.have.length(200)
      expect(libraryItem.media).to.exist
      expect(libraryItem.media.podcastEpisodes).to.be.an('array').with.length(numEpisodes)
      expect(libraryItem.media.podcastEpisodes.map((ep) => ep.id)).to.have.members(episodeIds)

      const expanded = libraryItem.toOldJSONExpanded()
      expect(expanded.media.episodes).to.have.length(numEpisodes)
    })

    it('should not repeat the library item row once per episode', async () => {
      await Database.libraryItemModel.findAllExpandedWhere({ id: [podcastLibraryItemId] })

      // Re run the main SELECT (the one reading libraryItems) and count the raw rows it returns
      const mainSql = loggedSql.map((sql) => sql.replace(/^Executing \([^)]*\): /, '')).find((sql) => /^SELECT .* FROM `libraryItems` AS `libraryItem`/.test(sql))
      expect(mainSql, 'main libraryItems query not found').to.be.a('string')

      Database.sequelize.options.logging = false
      const rows = await Database.sequelize.query(mainSql, { type: Sequelize.QueryTypes.SELECT })
      expect(rows).to.have.length(1)
    })
  })
})
