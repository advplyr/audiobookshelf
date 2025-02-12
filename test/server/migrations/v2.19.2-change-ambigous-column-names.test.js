const chai = require('chai')
const sinon = require('sinon')
const { expect } = chai

const { DataTypes, Sequelize } = require('sequelize')
const Logger = require('../../../server/Logger')

const { up, down } = require('../../../server/migrations/v2.19.2-change-ambigous-column-names')

describe('Migration v2.19.2-change-ambigous-column-names', () => {
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
      title: { type: DataTypes.STRING, allowNull: true },
      titleIgnorePrefix: { type: DataTypes.STRING, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false }
    })

    await queryInterface.bulkInsert('books', [
      { id: 1, title: 'The Book 1', titleIgnorePrefix: 'Book 1, The' },
      { id: 2, title: 'Book 2', titleIgnorePrefix: 'Book 2' }
    ])

    await queryInterface.bulkInsert('libraryItems', [
      { id: 1, libraryId: 1, mediaType: 'book', mediaId: 1, title: 'The Book 1', titleIgnorePrefix: 'Book 1, The', createdAt: '2025-01-01 00:00:00.000 +00:00' },
      { id: 2, libraryId: 2, mediaType: 'book', mediaId: 2, title: 'Book 2', titleIgnorePrefix: 'Book 2', createdAt: '2025-01-02 00:00:00.000 +00:00' }
    ])

    // Add indexes to the libraryItems table
    await queryInterface.addIndex('libraryItems', ['libraryId', 'mediaType', 'title'])
    await queryInterface.addIndex('libraryItems', ['libraryId', 'mediaType', 'titleIgnorePrefix'])

    // Add triggers to the books table
    await queryInterface.sequelize.query(`
      CREATE TRIGGER update_library_items_title
        AFTER UPDATE OF title ON books
        FOR EACH ROW
        BEGIN
          UPDATE libraryItems
            SET title = NEW.title
          WHERE libraryItems.mediaId = NEW.id;
        END;
    `)

    await queryInterface.sequelize.query(`
      CREATE TRIGGER update_library_items_title_ignore_prefix
        AFTER UPDATE OF titleIgnorePrefix ON books
        FOR EACH ROW
        BEGIN
          UPDATE libraryItems
            SET titleIgnorePrefix = NEW.titleIgnorePrefix
          WHERE libraryItems.mediaId = NEW.id;
        END;
    `)
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('up', () => {
    it('should replace title and titleIgnorePrefix with titleCopy and titleIgnorePrefixCopy columns in libraryItems', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const [libraryItems] = await queryInterface.sequelize.query('SELECT * FROM libraryItems')
      expect(libraryItems).to.deep.equal([
        { id: 1, libraryId: 1, mediaType: 'book', mediaId: 1, titleCopy: 'The Book 1', titleIgnorePrefixCopy: 'Book 1, The', createdAt: '2025-01-01 00:00:00.000 +00:00' },
        { id: 2, libraryId: 2, mediaType: 'book', mediaId: 2, titleCopy: 'Book 2', titleIgnorePrefixCopy: 'Book 2', createdAt: '2025-01-02 00:00:00.000 +00:00' }
      ])
    })

    it('should add index on titleCopy to libraryItems', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='library_items_library_id_media_type_title_copy'`)
      expect(count).to.equal(1)
    })

    it('should add trigger to books.title to update libraryItems.titleCopy', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_title_copy'`)
      expect(count).to.equal(1)
    })

    it('should add index on titleIgnorePrefixCopy to libraryItems', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='library_items_library_id_media_type_title_ignore_prefix_copy'`)
      expect(count).to.equal(1)
    })

    it('should add trigger to books.titleIgnorePrefix to update libraryItems.titleIgnorePrefixCopy', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_title_ignore_prefix_copy'`)
      expect(count).to.equal(1)
    })

    it('should remove title index from libraryItems', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='library_items_library_id_media_type_title'`)
      expect(count).to.equal(0)
    })

    it('should remove titleIgnorePrefix index from libraryItems', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='library_items_library_id_media_type_title_ignore_prefix'`)
      expect(count).to.equal(0)
    })

    it('should remove title trigger from books', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_title'`)
      expect(count).to.equal(0)
    })

    it('should remove titleIgnorePrefix trigger from books', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_title_ignore_prefix'`)
      expect(count).to.equal(0)
    })
  })

  describe('down', () => {
    it('should remove titleCopy and titleIgnorePrefixCopy from libraryItems', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const [libraryItems] = await queryInterface.sequelize.query('SELECT * FROM libraryItems')
      expect(libraryItems).to.deep.equal([
        { id: 1, libraryId: 1, mediaType: 'book', title: 'The Book 1', titleIgnorePrefix: 'Book 1, The', mediaId: 1, createdAt: '2025-01-01 00:00:00.000 +00:00' },
        { id: 2, libraryId: 2, mediaType: 'book', title: 'Book 2', titleIgnorePrefix: 'Book 2', mediaId: 2, createdAt: '2025-01-02 00:00:00.000 +00:00' }
      ])
    })

    it('should remove titleCopy trigger from books', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_title_copy'`)
      expect(count).to.equal(0)
    })

    it('should remove titleIgnorePrefixCopy trigger from books', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_title_ignore_prefix_copy'`)
      expect(count).to.equal(0)
    })

    it('should remove index on titleIgnorePrefixCopy from libraryItems', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='library_items_library_id_media_type_title_ignore_prefix_copy'`)
      expect(count).to.equal(0)
    })

    it('should remove index on titleCopy from libraryItems', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='library_items_library_id_media_type_title_copy'`)
      expect(count).to.equal(0)
    })

    it('should add back title and titleIgnorePrefix columns to libraryItems', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const [libraryItems] = await queryInterface.sequelize.query('SELECT * FROM libraryItems')
      expect(libraryItems).to.deep.equal([
        { id: 1, libraryId: 1, mediaType: 'book', mediaId: 1, title: 'The Book 1', titleIgnorePrefix: 'Book 1, The', createdAt: '2025-01-01 00:00:00.000 +00:00' },
        { id: 2, libraryId: 2, mediaType: 'book', mediaId: 2, title: 'Book 2', titleIgnorePrefix: 'Book 2', createdAt: '2025-01-02 00:00:00.000 +00:00' }
      ])
    })

    it('should add back title trigger to books', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_title'`)
      expect(count).to.equal(1)
    })

    it('should add back titleIgnorePrefix trigger to books', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger' AND name='update_library_items_title_ignore_prefix'`)
      expect(count).to.equal(1)
    })

    it('should add back title index to libraryItems', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='library_items_library_id_media_type_title'`)
      expect(count).to.equal(1)
    })

    it('should add back titleIgnorePrefix index to libraryItems', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='library_items_library_id_media_type_title_ignore_prefix'`)
      expect(count).to.equal(1)
    })
  })
})
