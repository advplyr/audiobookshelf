const chai = require('chai')
const sinon = require('sinon')
const { expect } = chai

const { DataTypes, Sequelize } = require('sequelize')
const Logger = require('../../../server/Logger')

const { up, down } = require('../../../server/migrations/v2.19.4-improve-podcast-queries')

describe('Migration v2.19.4-improve-podcast-queries', () => {
  let sequelize
  let queryInterface
  let loggerInfoStub

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    queryInterface = sequelize.getQueryInterface()
    loggerInfoStub = sinon.stub(Logger, 'info')

    await queryInterface.createTable('libraryItems', {
      id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, unique: true },
      mediaId: { type: DataTypes.INTEGER, allowNull: false },
      title: { type: DataTypes.STRING, allowNull: true },
      titleIgnorePrefix: { type: DataTypes.STRING, allowNull: true }
    })
    await queryInterface.createTable('podcasts', {
      id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, unique: true },
      title: { type: DataTypes.STRING, allowNull: false },
      titleIgnorePrefix: { type: DataTypes.STRING, allowNull: false }
    })

    await queryInterface.createTable('podcastEpisodes', {
      id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, unique: true },
      podcastId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'podcasts', key: 'id', onDelete: 'CASCADE' } }
    })

    await queryInterface.createTable('mediaProgresses', {
      id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, unique: true },
      userId: { type: DataTypes.INTEGER, allowNull: false },
      mediaItemId: { type: DataTypes.INTEGER, allowNull: false },
      mediaItemType: { type: DataTypes.STRING, allowNull: false },
      isFinished: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
    })

    await queryInterface.bulkInsert('libraryItems', [
      { id: 1, mediaId: 1, title: null, titleIgnorePrefix: null },
      { id: 2, mediaId: 2, title: null, titleIgnorePrefix: null }
    ])

    await queryInterface.bulkInsert('podcasts', [
      { id: 1, title: 'The Podcast 1', titleIgnorePrefix: 'Podcast 1, The' },
      { id: 2, title: 'The Podcast 2', titleIgnorePrefix: 'Podcast 2, The' }
    ])

    await queryInterface.bulkInsert('podcastEpisodes', [
      { id: 1, podcastId: 1 },
      { id: 2, podcastId: 1 },
      { id: 3, podcastId: 2 }
    ])

    await queryInterface.bulkInsert('mediaProgresses', [
      { id: 1, userId: 1, mediaItemId: 1, mediaItemType: 'podcastEpisode', isFinished: 1 },
      { id: 2, userId: 1, mediaItemId: 2, mediaItemType: 'podcastEpisode', isFinished: 0 },
      { id: 3, userId: 1, mediaItemId: 3, mediaItemType: 'podcastEpisode', isFinished: 1 },
      { id: 4, userId: 2, mediaItemId: 1, mediaItemType: 'podcastEpisode', isFinished: 0 },
      { id: 5, userId: 2, mediaItemId: 2, mediaItemType: 'podcastEpisode', isFinished: 1 },
      { id: 6, userId: 2, mediaItemId: 3, mediaItemType: 'podcastEpisode', isFinished: 0 },
      { id: 7, userId: 1, mediaItemId: 1, mediaItemType: 'book', isFinished: 1 },
      { id: 8, userId: 1, mediaItemId: 2, mediaItemType: 'book', isFinished: 0 }
    ])
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('up', () => {
    it('should add numEpisodes column to podcasts', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const [podcasts] = await queryInterface.sequelize.query('SELECT * FROM podcasts')
      expect(podcasts).to.deep.equal([
        { id: 1, numEpisodes: 2, title: 'The Podcast 1', titleIgnorePrefix: 'Podcast 1, The' },
        { id: 2, numEpisodes: 1, title: 'The Podcast 2', titleIgnorePrefix: 'Podcast 2, The' }
      ])

      // Make sure podcastEpisodes are not affected due to ON DELETE CASCADE
      const [podcastEpisodes] = await queryInterface.sequelize.query('SELECT * FROM podcastEpisodes')
      expect(podcastEpisodes).to.deep.equal([
        { id: 1, podcastId: 1 },
        { id: 2, podcastId: 1 },
        { id: 3, podcastId: 2 }
      ])
    })

    it('should add podcastId column to mediaProgresses', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const [mediaProgresses] = await queryInterface.sequelize.query('SELECT * FROM mediaProgresses')
      expect(mediaProgresses).to.deep.equal([
        { id: 1, userId: 1, mediaItemId: 1, mediaItemType: 'podcastEpisode', podcastId: 1, isFinished: 1 },
        { id: 2, userId: 1, mediaItemId: 2, mediaItemType: 'podcastEpisode', podcastId: 1, isFinished: 0 },
        { id: 3, userId: 1, mediaItemId: 3, mediaItemType: 'podcastEpisode', podcastId: 2, isFinished: 1 },
        { id: 4, userId: 2, mediaItemId: 1, mediaItemType: 'podcastEpisode', podcastId: 1, isFinished: 0 },
        { id: 5, userId: 2, mediaItemId: 2, mediaItemType: 'podcastEpisode', podcastId: 1, isFinished: 1 },
        { id: 6, userId: 2, mediaItemId: 3, mediaItemType: 'podcastEpisode', podcastId: 2, isFinished: 0 },
        { id: 7, userId: 1, mediaItemId: 1, mediaItemType: 'book', podcastId: null, isFinished: 1 },
        { id: 8, userId: 1, mediaItemId: 2, mediaItemType: 'book', podcastId: null, isFinished: 0 }
      ])
    })

    it('should copy title and titleIgnorePrefix from podcasts to libraryItems', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const [libraryItems] = await queryInterface.sequelize.query('SELECT * FROM libraryItems')
      expect(libraryItems).to.deep.equal([
        { id: 1, mediaId: 1, title: 'The Podcast 1', titleIgnorePrefix: 'Podcast 1, The' },
        { id: 2, mediaId: 2, title: 'The Podcast 2', titleIgnorePrefix: 'Podcast 2, The' }
      ])
    })

    it('should add trigger to update title in libraryItems', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_title_from_podcasts_title'`)
      expect(count).to.equal(1)
    })

    it('should add trigger to update titleIgnorePrefix in libraryItems', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_title_ignore_prefix_from_podcasts_title_ignore_prefix'`)
      expect(count).to.equal(1)
    })

    it('should be idempotent', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await up({ context: { queryInterface, logger: Logger } })

      const [podcasts] = await queryInterface.sequelize.query('SELECT * FROM podcasts')
      expect(podcasts).to.deep.equal([
        { id: 1, numEpisodes: 2, title: 'The Podcast 1', titleIgnorePrefix: 'Podcast 1, The' },
        { id: 2, numEpisodes: 1, title: 'The Podcast 2', titleIgnorePrefix: 'Podcast 2, The' }
      ])

      const [mediaProgresses] = await queryInterface.sequelize.query('SELECT * FROM mediaProgresses')
      expect(mediaProgresses).to.deep.equal([
        { id: 1, userId: 1, mediaItemId: 1, mediaItemType: 'podcastEpisode', podcastId: 1, isFinished: 1 },
        { id: 2, userId: 1, mediaItemId: 2, mediaItemType: 'podcastEpisode', podcastId: 1, isFinished: 0 },
        { id: 3, userId: 1, mediaItemId: 3, mediaItemType: 'podcastEpisode', podcastId: 2, isFinished: 1 },
        { id: 4, userId: 2, mediaItemId: 1, mediaItemType: 'podcastEpisode', podcastId: 1, isFinished: 0 },
        { id: 5, userId: 2, mediaItemId: 2, mediaItemType: 'podcastEpisode', podcastId: 1, isFinished: 1 },
        { id: 6, userId: 2, mediaItemId: 3, mediaItemType: 'podcastEpisode', podcastId: 2, isFinished: 0 },
        { id: 7, userId: 1, mediaItemId: 1, mediaItemType: 'book', podcastId: null, isFinished: 1 },
        { id: 8, userId: 1, mediaItemId: 2, mediaItemType: 'book', podcastId: null, isFinished: 0 }
      ])

      const [libraryItems] = await queryInterface.sequelize.query('SELECT * FROM libraryItems')
      expect(libraryItems).to.deep.equal([
        { id: 1, mediaId: 1, title: 'The Podcast 1', titleIgnorePrefix: 'Podcast 1, The' },
        { id: 2, mediaId: 2, title: 'The Podcast 2', titleIgnorePrefix: 'Podcast 2, The' }
      ])

      const [[{ count: count1 }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_title_from_podcasts_title'`)
      expect(count1).to.equal(1)

      const [[{ count: count2 }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_title_ignore_prefix_from_podcasts_title_ignore_prefix'`)
      expect(count2).to.equal(1)
    })
  })

  describe('down', () => {
    it('should remove numEpisodes column from podcasts', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      try {
        await down({ context: { queryInterface, logger: Logger } })
      } catch (error) {
        console.log(error)
      }

      const [podcasts] = await queryInterface.sequelize.query('SELECT * FROM podcasts')
      expect(podcasts).to.deep.equal([
        { id: 1, title: 'The Podcast 1', titleIgnorePrefix: 'Podcast 1, The' },
        { id: 2, title: 'The Podcast 2', titleIgnorePrefix: 'Podcast 2, The' }
      ])

      // Make sure podcastEpisodes are not affected due to ON DELETE CASCADE
      const [podcastEpisodes] = await queryInterface.sequelize.query('SELECT * FROM podcastEpisodes')
      expect(podcastEpisodes).to.deep.equal([
        { id: 1, podcastId: 1 },
        { id: 2, podcastId: 1 },
        { id: 3, podcastId: 2 }
      ])
    })

    it('should remove podcastId column from mediaProgresses', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const [mediaProgresses] = await queryInterface.sequelize.query('SELECT * FROM mediaProgresses')
      expect(mediaProgresses).to.deep.equal([
        { id: 1, userId: 1, mediaItemId: 1, mediaItemType: 'podcastEpisode', isFinished: 1 },
        { id: 2, userId: 1, mediaItemId: 2, mediaItemType: 'podcastEpisode', isFinished: 0 },
        { id: 3, userId: 1, mediaItemId: 3, mediaItemType: 'podcastEpisode', isFinished: 1 },
        { id: 4, userId: 2, mediaItemId: 1, mediaItemType: 'podcastEpisode', isFinished: 0 },
        { id: 5, userId: 2, mediaItemId: 2, mediaItemType: 'podcastEpisode', isFinished: 1 },
        { id: 6, userId: 2, mediaItemId: 3, mediaItemType: 'podcastEpisode', isFinished: 0 },
        { id: 7, userId: 1, mediaItemId: 1, mediaItemType: 'book', isFinished: 1 },
        { id: 8, userId: 1, mediaItemId: 2, mediaItemType: 'book', isFinished: 0 }
      ])
    })

    it('should remove trigger to update title in libraryItems', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_title_from_podcasts_title'`)
      expect(count).to.equal(0)
    })

    it('should remove trigger to update titleIgnorePrefix in libraryItems', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_title_ignore_prefix_from_podcasts_title_ignore_prefix'`)
      expect(count).to.equal(0)
    })

    it('should be idempotent', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const [podcasts] = await queryInterface.sequelize.query('SELECT * FROM podcasts')
      expect(podcasts).to.deep.equal([
        { id: 1, title: 'The Podcast 1', titleIgnorePrefix: 'Podcast 1, The' },
        { id: 2, title: 'The Podcast 2', titleIgnorePrefix: 'Podcast 2, The' }
      ])

      const [mediaProgresses] = await queryInterface.sequelize.query('SELECT * FROM mediaProgresses')
      expect(mediaProgresses).to.deep.equal([
        { id: 1, userId: 1, mediaItemId: 1, mediaItemType: 'podcastEpisode', isFinished: 1 },
        { id: 2, userId: 1, mediaItemId: 2, mediaItemType: 'podcastEpisode', isFinished: 0 },
        { id: 3, userId: 1, mediaItemId: 3, mediaItemType: 'podcastEpisode', isFinished: 1 },
        { id: 4, userId: 2, mediaItemId: 1, mediaItemType: 'podcastEpisode', isFinished: 0 },
        { id: 5, userId: 2, mediaItemId: 2, mediaItemType: 'podcastEpisode', isFinished: 1 },
        { id: 6, userId: 2, mediaItemId: 3, mediaItemType: 'podcastEpisode', isFinished: 0 },
        { id: 7, userId: 1, mediaItemId: 1, mediaItemType: 'book', isFinished: 1 },
        { id: 8, userId: 1, mediaItemId: 2, mediaItemType: 'book', isFinished: 0 }
      ])

      const [libraryItems] = await queryInterface.sequelize.query('SELECT * FROM libraryItems')
      expect(libraryItems).to.deep.equal([
        { id: 1, mediaId: 1, title: 'The Podcast 1', titleIgnorePrefix: 'Podcast 1, The' },
        { id: 2, mediaId: 2, title: 'The Podcast 2', titleIgnorePrefix: 'Podcast 2, The' }
      ])

      const [[{ count: count1 }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_title_from_podcasts_title'`)
      expect(count1).to.equal(0)

      const [[{ count: count2 }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_title_ignore_prefix_from_podcasts_title_ignore_prefix'`)
      expect(count2).to.equal(0)
    })
  })
})
