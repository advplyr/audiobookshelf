const chai = require('chai')
const sinon = require('sinon')
const { expect } = chai

const { DataTypes, Sequelize } = require('sequelize')
const Logger = require('../../../server/Logger')

const { up, down } = require('../../../server/migrations/v2.32.2-add-library-items-is-placeholder')

describe('Migration v2.32.2-add-library-items-is-placeholder', () => {
  let sequelize
  let queryInterface

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    queryInterface = sequelize.getQueryInterface()
    sinon.stub(Logger, 'info')
  })

  afterEach(() => {
    sinon.restore()
  })

  const baseLibraryItemsSchema = {
    id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, unique: true },
    libraryId: { type: DataTypes.INTEGER, allowNull: false },
    mediaType: { type: DataTypes.STRING, allowNull: false },
    mediaId: { type: DataTypes.INTEGER, allowNull: false },
    createdAt: { type: DataTypes.DATE, allowNull: false }
  }

  describe('up', () => {
    it('should add isPlaceholder with default false and backfill existing rows', async () => {
      await queryInterface.createTable('libraryItems', baseLibraryItemsSchema)

      await queryInterface.bulkInsert('libraryItems', [
        { id: 1, libraryId: 1, mediaType: 'book', mediaId: 10, createdAt: '2025-01-01 00:00:00.000 +00:00' },
        { id: 2, libraryId: 2, mediaType: 'book', mediaId: 11, createdAt: '2025-01-02 00:00:00.000 +00:00' }
      ])

      await up({ context: { queryInterface, logger: Logger } })

      const [libraryItems] = await queryInterface.sequelize.query('SELECT * FROM libraryItems ORDER BY id')
      expect(libraryItems).to.deep.equal([
        { id: 1, libraryId: 1, mediaType: 'book', mediaId: 10, createdAt: '2025-01-01 00:00:00.000 +00:00', isPlaceholder: 0 },
        { id: 2, libraryId: 2, mediaType: 'book', mediaId: 11, createdAt: '2025-01-02 00:00:00.000 +00:00', isPlaceholder: 0 }
      ])
    })

    it('should backfill null values when the column already exists', async () => {
      await queryInterface.createTable('libraryItems', {
        ...baseLibraryItemsSchema,
        isPlaceholder: { type: DataTypes.BOOLEAN, allowNull: true }
      })

      await queryInterface.bulkInsert('libraryItems', [
        { id: 1, libraryId: 1, mediaType: 'book', mediaId: 12, createdAt: '2025-01-03 00:00:00.000 +00:00', isPlaceholder: null },
        { id: 2, libraryId: 2, mediaType: 'book', mediaId: 13, createdAt: '2025-01-04 00:00:00.000 +00:00', isPlaceholder: 1 }
      ])

      await up({ context: { queryInterface, logger: Logger } })

      const [libraryItems] = await queryInterface.sequelize.query('SELECT * FROM libraryItems ORDER BY id')
      expect(libraryItems).to.deep.equal([
        { id: 1, libraryId: 1, mediaType: 'book', mediaId: 12, createdAt: '2025-01-03 00:00:00.000 +00:00', isPlaceholder: 0 },
        { id: 2, libraryId: 2, mediaType: 'book', mediaId: 13, createdAt: '2025-01-04 00:00:00.000 +00:00', isPlaceholder: 1 }
      ])
    })
  })

  describe('down', () => {
    it('should remove isPlaceholder from libraryItems', async () => {
      await queryInterface.createTable('libraryItems', baseLibraryItemsSchema)
      await up({ context: { queryInterface, logger: Logger } })

      await down({ context: { queryInterface, logger: Logger } })

      const tableDescription = await queryInterface.describeTable('libraryItems')
      expect(tableDescription.isPlaceholder).to.equal(undefined)
    })
  })
})
