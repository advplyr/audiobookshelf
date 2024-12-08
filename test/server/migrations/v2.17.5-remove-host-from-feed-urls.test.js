const { expect } = require('chai')
const sinon = require('sinon')
const { up, down } = require('../../../server/migrations/v2.17.5-remove-host-from-feed-urls')
const { Sequelize, DataTypes } = require('sequelize')
const Logger = require('../../../server/Logger')

const defineModels = (sequelize) => {
  const Feeds = sequelize.define('Feeds', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    feedUrl: { type: DataTypes.STRING },
    imageUrl: { type: DataTypes.STRING },
    siteUrl: { type: DataTypes.STRING },
    serverAddress: { type: DataTypes.STRING }
  })

  const FeedEpisodes = sequelize.define('FeedEpisodes', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    feedId: { type: DataTypes.UUID },
    siteUrl: { type: DataTypes.STRING },
    enclosureUrl: { type: DataTypes.STRING }
  })

  return { Feeds, FeedEpisodes }
}

describe('Migration v2.17.4-use-subfolder-for-oidc-redirect-uris', () => {
  let queryInterface, logger, context
  let sequelize
  let Feeds, FeedEpisodes
  const feed1Id = '00000000-0000-4000-a000-000000000001'
  const feed2Id = '00000000-0000-4000-a000-000000000002'
  const feedEpisode1Id = '00000000-4000-a000-0000-000000000011'
  const feedEpisode2Id = '00000000-4000-a000-0000-000000000012'
  const feedEpisode3Id = '00000000-4000-a000-0000-000000000021'

  before(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    queryInterface = sequelize.getQueryInterface()
    ;({ Feeds, FeedEpisodes } = defineModels(sequelize))
    await sequelize.sync()
  })

  after(async () => {
    await sequelize.close()
  })

  beforeEach(async () => {
    // Reset tables before each test
    await Feeds.destroy({ where: {}, truncate: true })
    await FeedEpisodes.destroy({ where: {}, truncate: true })

    logger = {
      info: sinon.stub(),
      error: sinon.stub()
    }
    context = { queryInterface, logger }
  })

  describe('up', () => {
    it('should remove serverAddress from URLs in Feeds and FeedEpisodes tables', async () => {
      await Feeds.bulkCreate([
        { id: feed1Id, feedUrl: 'http://server1.com/feed1', imageUrl: 'http://server1.com/img1', siteUrl: 'http://server1.com/site1', serverAddress: 'http://server1.com' },
        { id: feed2Id, feedUrl: 'http://server2.com/feed2', imageUrl: 'http://server2.com/img2', siteUrl: 'http://server2.com/site2', serverAddress: 'http://server2.com' }
      ])

      await FeedEpisodes.bulkCreate([
        { id: feedEpisode1Id, feedId: feed1Id, siteUrl: 'http://server1.com/episode11', enclosureUrl: 'http://server1.com/enclosure11' },
        { id: feedEpisode2Id, feedId: feed1Id, siteUrl: 'http://server1.com/episode12', enclosureUrl: 'http://server1.com/enclosure12' },
        { id: feedEpisode3Id, feedId: feed2Id, siteUrl: 'http://server2.com/episode21', enclosureUrl: 'http://server2.com/enclosure21' }
      ])

      await up({ context })
      const feeds = await Feeds.findAll({ raw: true })
      const feedEpisodes = await FeedEpisodes.findAll({ raw: true })

      expect(logger.info.calledWith('[2.17.5 migration] UPGRADE BEGIN: 2.17.5-remove-host-from-feed-urls')).to.be.true
      expect(logger.info.calledWith('[2.17.5 migration] Removing serverAddress from Feeds table URLs')).to.be.true

      expect(feeds[0].feedUrl).to.equal('/feed1')
      expect(feeds[0].imageUrl).to.equal('/img1')
      expect(feeds[0].siteUrl).to.equal('/site1')
      expect(feeds[1].feedUrl).to.equal('/feed2')
      expect(feeds[1].imageUrl).to.equal('/img2')
      expect(feeds[1].siteUrl).to.equal('/site2')

      expect(logger.info.calledWith('[2.17.5 migration] Removed serverAddress from Feeds table URLs')).to.be.true
      expect(logger.info.calledWith('[2.17.5 migration] Removing serverAddress from FeedEpisodes table URLs')).to.be.true

      expect(feedEpisodes[0].siteUrl).to.equal('/episode11')
      expect(feedEpisodes[0].enclosureUrl).to.equal('/enclosure11')
      expect(feedEpisodes[1].siteUrl).to.equal('/episode12')
      expect(feedEpisodes[1].enclosureUrl).to.equal('/enclosure12')
      expect(feedEpisodes[2].siteUrl).to.equal('/episode21')
      expect(feedEpisodes[2].enclosureUrl).to.equal('/enclosure21')

      expect(logger.info.calledWith('[2.17.5 migration] Removed serverAddress from FeedEpisodes table URLs')).to.be.true
      expect(logger.info.calledWith('[2.17.5 migration] UPGRADE END: 2.17.5-remove-host-from-feed-urls')).to.be.true
    })

    it('should handle null URLs in Feeds and FeedEpisodes tables', async () => {
      await Feeds.bulkCreate([{ id: feed1Id, feedUrl: 'http://server1.com/feed1', imageUrl: null, siteUrl: 'http://server1.com/site1', serverAddress: 'http://server1.com' }])

      await FeedEpisodes.bulkCreate([{ id: feedEpisode1Id, feedId: feed1Id, siteUrl: null, enclosureUrl: 'http://server1.com/enclosure11' }])

      await up({ context })
      const feeds = await Feeds.findAll({ raw: true })
      const feedEpisodes = await FeedEpisodes.findAll({ raw: true })

      expect(feeds[0].feedUrl).to.equal('/feed1')
      expect(feeds[0].imageUrl).to.be.null
      expect(feeds[0].siteUrl).to.equal('/site1')
      expect(feedEpisodes[0].siteUrl).to.be.null
      expect(feedEpisodes[0].enclosureUrl).to.equal('/enclosure11')
    })

    it('should handle null serverAddress in Feeds table', async () => {
      await Feeds.bulkCreate([{ id: feed1Id, feedUrl: 'http://server1.com/feed1', imageUrl: 'http://server1.com/img1', siteUrl: 'http://server1.com/site1', serverAddress: null }])
      await FeedEpisodes.bulkCreate([{ id: feedEpisode1Id, feedId: feed1Id, siteUrl: 'http://server1.com/episode11', enclosureUrl: 'http://server1.com/enclosure11' }])

      await up({ context })
      const feeds = await Feeds.findAll({ raw: true })
      const feedEpisodes = await FeedEpisodes.findAll({ raw: true })

      expect(feeds[0].feedUrl).to.equal('http://server1.com/feed1')
      expect(feeds[0].imageUrl).to.equal('http://server1.com/img1')
      expect(feeds[0].siteUrl).to.equal('http://server1.com/site1')
      expect(feedEpisodes[0].siteUrl).to.equal('http://server1.com/episode11')
      expect(feedEpisodes[0].enclosureUrl).to.equal('http://server1.com/enclosure11')
    })
  })

  describe('down', () => {
    it('should add serverAddress back to URLs in Feeds and FeedEpisodes tables', async () => {
      await Feeds.bulkCreate([
        { id: feed1Id, feedUrl: '/feed1', imageUrl: '/img1', siteUrl: '/site1', serverAddress: 'http://server1.com' },
        { id: feed2Id, feedUrl: '/feed2', imageUrl: '/img2', siteUrl: '/site2', serverAddress: 'http://server2.com' }
      ])

      await FeedEpisodes.bulkCreate([
        { id: feedEpisode1Id, feedId: feed1Id, siteUrl: '/episode11', enclosureUrl: '/enclosure11' },
        { id: feedEpisode2Id, feedId: feed1Id, siteUrl: '/episode12', enclosureUrl: '/enclosure12' },
        { id: feedEpisode3Id, feedId: feed2Id, siteUrl: '/episode21', enclosureUrl: '/enclosure21' }
      ])

      await down({ context })
      const feeds = await Feeds.findAll({ raw: true })
      const feedEpisodes = await FeedEpisodes.findAll({ raw: true })

      expect(logger.info.calledWith('[2.17.5 migration] DOWNGRADE BEGIN: 2.17.5-remove-host-from-feed-urls')).to.be.true
      expect(logger.info.calledWith('[2.17.5 migration] Adding serverAddress back to Feeds table URLs')).to.be.true

      expect(feeds[0].feedUrl).to.equal('http://server1.com/feed1')
      expect(feeds[0].imageUrl).to.equal('http://server1.com/img1')
      expect(feeds[0].siteUrl).to.equal('http://server1.com/site1')
      expect(feeds[1].feedUrl).to.equal('http://server2.com/feed2')
      expect(feeds[1].imageUrl).to.equal('http://server2.com/img2')
      expect(feeds[1].siteUrl).to.equal('http://server2.com/site2')

      expect(logger.info.calledWith('[2.17.5 migration] Added serverAddress back to Feeds table URLs')).to.be.true
      expect(logger.info.calledWith('[2.17.5 migration] Adding serverAddress back to FeedEpisodes table URLs')).to.be.true

      expect(feedEpisodes[0].siteUrl).to.equal('http://server1.com/episode11')
      expect(feedEpisodes[0].enclosureUrl).to.equal('http://server1.com/enclosure11')
      expect(feedEpisodes[1].siteUrl).to.equal('http://server1.com/episode12')
      expect(feedEpisodes[1].enclosureUrl).to.equal('http://server1.com/enclosure12')
      expect(feedEpisodes[2].siteUrl).to.equal('http://server2.com/episode21')
      expect(feedEpisodes[2].enclosureUrl).to.equal('http://server2.com/enclosure21')

      expect(logger.info.calledWith('[2.17.5 migration] DOWNGRADE END: 2.17.5-remove-host-from-feed-urls')).to.be.true
    })

    it('should handle null URLs in Feeds and FeedEpisodes tables', async () => {
      await Feeds.bulkCreate([{ id: feed1Id, feedUrl: '/feed1', imageUrl: null, siteUrl: '/site1', serverAddress: 'http://server1.com' }])
      await FeedEpisodes.bulkCreate([{ id: feedEpisode1Id, feedId: feed1Id, siteUrl: null, enclosureUrl: '/enclosure11' }])

      await down({ context })
      const feeds = await Feeds.findAll({ raw: true })
      const feedEpisodes = await FeedEpisodes.findAll({ raw: true })

      expect(feeds[0].feedUrl).to.equal('http://server1.com/feed1')
      expect(feeds[0].imageUrl).to.be.null
      expect(feeds[0].siteUrl).to.equal('http://server1.com/site1')
      expect(feedEpisodes[0].siteUrl).to.be.null
      expect(feedEpisodes[0].enclosureUrl).to.equal('http://server1.com/enclosure11')
    })

    it('should handle null serverAddress in Feeds table', async () => {
      await Feeds.bulkCreate([{ id: feed1Id, feedUrl: '/feed1', imageUrl: '/img1', siteUrl: '/site1', serverAddress: null }])
      await FeedEpisodes.bulkCreate([{ id: feedEpisode1Id, feedId: feed1Id, siteUrl: '/episode11', enclosureUrl: '/enclosure11' }])

      await down({ context })
      const feeds = await Feeds.findAll({ raw: true })
      const feedEpisodes = await FeedEpisodes.findAll({ raw: true })

      expect(feeds[0].feedUrl).to.equal('/feed1')
      expect(feeds[0].imageUrl).to.equal('/img1')
      expect(feeds[0].siteUrl).to.equal('/site1')
      expect(feedEpisodes[0].siteUrl).to.equal('/episode11')
      expect(feedEpisodes[0].enclosureUrl).to.equal('/enclosure11')
    })
  })
})
