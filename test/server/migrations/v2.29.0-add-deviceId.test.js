const chai = require('chai')
const sinon = require('sinon')
const { expect } = chai

const { DataTypes, Sequelize } = require('sequelize')
const Logger = require('../../../server/Logger')

const { up, down, migrationName } = require('../../../server/migrations/v2.29.0-add-deviceId')
const { stubFileUtils, getMockFileInfo } = require('../MockDatabase')

const normalizeWhitespaceAndBackticks = (str) => str.replace(/\s+/g, ' ').trim().replace(/`/g, '')

describe(`Migration ${migrationName}`, () => {
  let sequelize
  let queryInterface
  let loggerInfoStub
  let mockFileInfo, file1stats, file2stats

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    queryInterface = sequelize.getQueryInterface()
    loggerInfoStub = sinon.stub(Logger, 'info')

    mockFileInfo = getMockFileInfo()
    file1stats = mockFileInfo.get('/test/file.pdf')
    file2stats = mockFileInfo.get('/mnt/drive/file-same-ino-different-dev.pdf')

    stubFileUtils(mockFileInfo)

    await queryInterface.createTable('libraryItems', {
      id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, unique: true },
      ino: { type: DataTypes.STRING },
      path: { type: DataTypes.STRING },
      mediaId: { type: DataTypes.INTEGER, allowNull: false },
      mediaType: { type: DataTypes.STRING, allowNull: false },
      libraryId: { type: DataTypes.INTEGER, allowNull: false }
    })

    await queryInterface.createTable('authors', {
      id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, unique: true },
      name: { type: DataTypes.STRING, allowNull: false },
      lastFirst: { type: DataTypes.STRING, allowNull: false }
    })

    await queryInterface.createTable('bookAuthors', {
      id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, unique: true },
      bookId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'libraryItems', key: 'id', onDelete: 'CASCADE' } },
      authorId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'authors', key: 'id', onDelete: 'CASCADE' } },
      createdAt: { type: DataTypes.DATE, allowNull: false }
    })

    await queryInterface.createTable('podcastEpisodes', {
      id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, unique: true },
      publishedAt: { type: DataTypes.DATE, allowNull: true }
    })

    await queryInterface.bulkInsert('libraryItems', [
      { id: 1, ino: file1stats.ino, mediaId: 1, path: file1stats.path, mediaType: 'book', libraryId: 1 },
      { id: 2, ino: file2stats.ino, mediaId: 2, path: file2stats.path, mediaType: 'book', libraryId: 1 }
    ])

    await queryInterface.bulkInsert('authors', [
      { id: 1, name: 'John Doe', lastFirst: 'Doe, John' },
      { id: 2, name: 'Jane Smith', lastFirst: 'Smith, Jane' },
      { id: 3, name: 'John Smith', lastFirst: 'Smith, John' }
    ])

    await queryInterface.bulkInsert('bookAuthors', [
      { id: 1, bookId: 1, authorId: 1, createdAt: '2025-01-01 00:00:00.000 +00:00' },
      { id: 2, bookId: 2, authorId: 2, createdAt: '2025-01-02 00:00:00.000 +00:00' },
      { id: 3, bookId: 1, authorId: 3, createdAt: '2024-12-31 00:00:00.000 +00:00' }
    ])

    await queryInterface.bulkInsert('podcastEpisodes', [
      { id: 1, publishedAt: '2025-01-01 00:00:00.000 +00:00' },
      { id: 2, publishedAt: '2025-01-02 00:00:00.000 +00:00' },
      { id: 3, publishedAt: '2025-01-03 00:00:00.000 +00:00' }
    ])
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('up', () => {
    it('should add the deviceId column to the libraryItems table', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const libraryItems = await queryInterface.describeTable('libraryItems')
      expect(libraryItems.deviceId).to.exist
    })

    it('should populate the deviceId columns from the filesystem for each libraryItem', async function () {
      this.timeout(0)
      await up({ context: { queryInterface, logger: Logger } })

      const [libraryItems] = await queryInterface.sequelize.query('SELECT * FROM libraryItems')
      expect(libraryItems).to.deep.equal([
        { id: 1, ino: file1stats.ino, deviceId: file1stats.dev, mediaId: 1, path: file1stats.path, mediaType: 'book', libraryId: 1 },
        { id: 2, ino: file2stats.ino, deviceId: file2stats.dev, mediaId: 2, path: file2stats.path, mediaType: 'book', libraryId: 1 }
      ])
    })

    it('should add an index on ino and deviceId to the libraryItems table', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const indexes = await queryInterface.sequelize.query(`SELECT * FROM sqlite_master WHERE type='index'`)
      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='library_items_ino_device_id'`)
      expect(count).to.equal(1)

      const [[{ sql }]] = await queryInterface.sequelize.query(`SELECT sql FROM sqlite_master WHERE type='index' AND name='library_items_ino_device_id'`)
      expect(normalizeWhitespaceAndBackticks(sql)).to.equal(
        normalizeWhitespaceAndBackticks(`
          CREATE INDEX library_items_ino_device_id ON libraryItems (ino, deviceId)
        `)
      )
    })

    it('should be idempotent', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await up({ context: { queryInterface, logger: Logger } })

      const libraryItemsTable = await queryInterface.describeTable('libraryItems')
      expect(libraryItemsTable.deviceId).to.exist

      const [[{ count: count6 }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='library_items_ino_device_id'`)
      expect(count6).to.equal(1)

      const [libraryItems] = await queryInterface.sequelize.query(`SELECT * FROM libraryItems`)
      expect(libraryItems).to.deep.equal([
        { id: 1, ino: file1stats.ino, deviceId: file1stats.dev, path: file1stats.path, mediaId: 1, mediaType: 'book', libraryId: 1 },
        { id: 2, ino: file2stats.ino, deviceId: file2stats.dev, path: file2stats.path, mediaId: 2, mediaType: 'book', libraryId: 1 }
      ])
    })
  })

  describe('down', () => {
    it('should remove the deviceId from the libraryItems table', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const libraryItemsTable = await queryInterface.describeTable('libraryItems')
      expect(libraryItemsTable.deviceId).to.not.exist

      const [libraryItems] = await queryInterface.sequelize.query(`SELECT * FROM libraryItems`)
      expect(libraryItems).to.deep.equal([
        { id: 1, ino: file1stats.ino, mediaId: 1, path: file1stats.path, mediaType: 'book', libraryId: 1 },
        { id: 2, ino: file2stats.ino, mediaId: 2, path: file2stats.path, mediaType: 'book', libraryId: 1 }
      ])
    })

    it('should remove the index on ino, deviceId from the libraryItems table', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const [[{ count }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='library_items_ino_device_id'`)
      expect(count).to.equal(0)
    })

    it('should be idempotent', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const libraryItemsTable = await queryInterface.describeTable('libraryItems')
      expect(libraryItemsTable.libraryItems).to.not.exist

      const [libraryItems] = await queryInterface.sequelize.query(`SELECT * FROM libraryItems`)
      expect(libraryItems).to.deep.equal([
        { id: 1, ino: file1stats.ino, path: file1stats.path, mediaId: 1, mediaType: 'book', libraryId: 1 },
        { id: 2, ino: file2stats.ino, path: file2stats.path, mediaId: 2, mediaType: 'book', libraryId: 1 }
      ])

      const [[{ count: count6 }]] = await queryInterface.sequelize.query(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='library_items_ino_device_id'`)
      expect(count6).to.equal(0)
    })
  })
})
