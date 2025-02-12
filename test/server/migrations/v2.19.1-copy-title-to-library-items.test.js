const chai = require('chai')
const sinon = require('sinon')
const { expect } = chai

const { DataTypes, Sequelize } = require('sequelize')
const Logger = require('../../../server/Logger')

const { up, down } = require('../../../server/migrations/v2.19.1-copy-title-to-library-items')

describe('Migration v2.19.1-copy-title-to-library-items', () => {
  let sequelize
  let queryInterface
  let loggerInfoStub

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    queryInterface = sequelize.getQueryInterface()
    loggerInfoStub = sinon.stub(Logger, 'info')

    await queryInterface.createTable('books', {
      id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, unique: true },
      title: { type: DataTypes.STRING, allowNull: true },
      titleIgnorePrefix: { type: DataTypes.STRING, allowNull: true }
    })

    await queryInterface.createTable('libraryItems', {
      id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, unique: true },
      libraryId: { type: DataTypes.INTEGER, allowNull: false },
      mediaType: { type: DataTypes.STRING, allowNull: false },
      mediaId: { type: DataTypes.INTEGER, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false }
    })

    await queryInterface.bulkInsert('books', [
      { id: 1, title: 'The Book 1', titleIgnorePrefix: 'Book 1, The' },
      { id: 2, title: 'Book 2', titleIgnorePrefix: 'Book 2' }
    ])

    await queryInterface.bulkInsert('libraryItems', [
      { id: 1, libraryId: 1, mediaType: 'book', mediaId: 1, createdAt: '2025-01-01 00:00:00.000 +00:00' },
      { id: 2, libraryId: 2, mediaType: 'book', mediaId: 2, createdAt: '2025-01-02 00:00:00.000 +00:00' }
    ])
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('up', () => {
    it('should copy title and titleIgnorePrefix to libraryItems', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const [libraryItems] = await queryInterface.sequelize.query('SELECT * FROM libraryItems')
      expect(libraryItems).to.deep.equal([
        { id: 1, libraryId: 1, mediaType: 'book', mediaId: 1, title: 'The Book 1', titleIgnorePrefix: 'Book 1, The', createdAt: '2025-01-01 00:00:00.000 +00:00' },
        { id: 2, libraryId: 2, mediaType: 'book', mediaId: 2, title: 'Book 2', titleIgnorePrefix: 'Book 2', createdAt: '2025-01-02 00:00:00.000 +00:00' }
      ])
    })

    it('should add index on title to libraryItems', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='library_items_library_id_media_type_title_ignore_prefix'`)
      expect(count).to.equal(1)
    })

    it('should add trigger to books.title to update libraryItems.title', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_title'`)
      expect(count).to.equal(1)
    })

    it('should add index on titleIgnorePrefix to libraryItems', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='library_items_library_id_media_type_title_ignore_prefix'`)
      expect(count).to.equal(1)
    })

    it('should add trigger to books.titleIgnorePrefix to update libraryItems.titleIgnorePrefix', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_title_ignore_prefix'`)
      expect(count).to.equal(1)
    })

    it('should add index on createdAt to libraryItems', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='library_items_library_id_media_type_created_at'`)
      expect(count).to.equal(1)
    })
  })

  describe('down', () => {
    it('should remove title and titleIgnorePrefix from libraryItems', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const [libraryItems] = await queryInterface.sequelize.query('SELECT * FROM libraryItems')
      expect(libraryItems).to.deep.equal([
        { id: 1, libraryId: 1, mediaType: 'book', mediaId: 1, createdAt: '2025-01-01 00:00:00.000 +00:00' },
        { id: 2, libraryId: 2, mediaType: 'book', mediaId: 2, createdAt: '2025-01-02 00:00:00.000 +00:00' }
      ])
    })

    it('should remove title trigger from books', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_title'`)
      expect(count).to.equal(0)
    })

    it('should remove titleIgnorePrefix trigger from books', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_title_ignore_prefix'`)
      expect(count).to.equal(0)
    })

    it('should remove index on titleIgnorePrefix from libraryItems', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='library_items_library_id_media_type_title_ignore_prefix'`)
      expect(count).to.equal(0)
    })

    it('should remove index on title from libraryItems', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='library_items_library_id_media_type_title'`)
      expect(count).to.equal(0)
    })

    it('should remove index on createdAt from libraryItems', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='library_items_library_id_media_type_created_at'`)
      expect(count).to.equal(0)
    })
  })
})
