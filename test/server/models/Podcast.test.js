const { expect } = require('chai')
const { Sequelize } = require('sequelize')

const Database = require('../../../server/Database')

describe('Podcast auto-download filters', () => {
  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
  })

  afterEach(async () => {
    await Database.sequelize.close()
  })

  describe('checkFeedEpisodePassesAutoDownloadFilters', () => {
    it('should pass every episode when no filter is set', () => {
      const podcast = Database.podcastModel.build({ autoDownloadMinDuration: null, autoDownloadExcludeTerms: null })

      expect(podcast.checkFeedEpisodePassesAutoDownloadFilters({ title: 'Trailer', durationSeconds: 30 })).to.be.true
    })

    it('should reject episodes shorter than the minimum duration', () => {
      const podcast = Database.podcastModel.build({ autoDownloadMinDuration: 600 })

      expect(podcast.checkFeedEpisodePassesAutoDownloadFilters({ title: 'Teaser', durationSeconds: 120 })).to.be.false
      expect(podcast.checkFeedEpisodePassesAutoDownloadFilters({ title: 'Full show', durationSeconds: 600 })).to.be.true
    })

    it('should keep episodes without a known duration', () => {
      const podcast = Database.podcastModel.build({ autoDownloadMinDuration: 600 })

      expect(podcast.checkFeedEpisodePassesAutoDownloadFilters({ title: 'Episode 1', durationSeconds: null })).to.be.true
    })

    it('should reject episodes whose title contains an excluded term, ignoring case', () => {
      const podcast = Database.podcastModel.build({ autoDownloadExcludeTerms: ['[teaser]', 'Revisited'] })

      expect(podcast.checkFeedEpisodePassesAutoDownloadFilters({ title: 'Episode 12 [TEASER]', durationSeconds: 3600 })).to.be.false
      expect(podcast.checkFeedEpisodePassesAutoDownloadFilters({ title: 'Best of: revisited', durationSeconds: 3600 })).to.be.false
      expect(podcast.checkFeedEpisodePassesAutoDownloadFilters({ title: 'Episode 12', durationSeconds: 3600 })).to.be.true
    })
  })

  describe('updateFromRequest', () => {
    it('should update the filters and normalize the excluded terms', async () => {
      const podcast = await Database.podcastModel.create({ title: 'Test Podcast', autoDownloadExcludeTerms: [] })

      const hasUpdates = await podcast.updateFromRequest({ autoDownloadMinDuration: 300, autoDownloadExcludeTerms: [' Trailer ', '', 'Trailer', 'Bonus'] })

      expect(hasUpdates).to.be.true
      expect(podcast.autoDownloadMinDuration).to.equal(300)
      expect(podcast.autoDownloadExcludeTerms).to.deep.equal(['Trailer', 'Bonus'])
    })

    it('should not report updates when the excluded terms are unchanged', async () => {
      const podcast = await Database.podcastModel.create({ title: 'Test Podcast', autoDownloadExcludeTerms: ['Trailer'] })

      const hasUpdates = await podcast.updateFromRequest({ autoDownloadExcludeTerms: ['Trailer'] })

      expect(hasUpdates).to.be.false
    })
  })
})
