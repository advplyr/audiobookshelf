const chai = require('chai')
const sinon = require('sinon')
const { expect } = chai

const { DataTypes, Sequelize } = require('sequelize')
const Logger = require('../../../server/Logger')

const { up } = require('../../../server/migrations/v2.32.6-large-library-browse-indexes')

const normalizeWhitespace = (str) => str.replace(/\s+/g, ' ').trim().replace(/`/g, '')

describe('Migration v2.32.6-large-library-browse-indexes (sqlite)', () => {
  let sequelize
  let queryInterface

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    queryInterface = sequelize.getQueryInterface()
    sinon.stub(Logger, 'info')

    await queryInterface.createTable('books', {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true }
    })

    await queryInterface.createTable('libraryItems', {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      libraryId: { type: DataTypes.UUID, allowNull: false },
      mediaType: { type: DataTypes.STRING, allowNull: false },
      title: { type: DataTypes.TEXT, allowNull: true },
      titleIgnorePrefix: { type: DataTypes.TEXT, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: true }
    })

    await queryInterface.createTable('mediaProgresses', {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: true }
    })
  })

  afterEach(async () => {
    sinon.restore()
    await sequelize.close()
  })

  it('creates browse indexes for title and progress keyset traversal', async () => {
    await up({ context: { queryInterface, logger: Logger } })

    const [[{ count: titleExactIndexCount }]] = await queryInterface.sequelize.query(
      "SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='library_items_library_media_type_title_id'"
    )
    expect(titleExactIndexCount).to.equal(1)

    const [[{ sql: titleExactIndexSql }]] = await queryInterface.sequelize.query(
      "SELECT sql FROM sqlite_master WHERE type='index' AND name='library_items_library_media_type_title_id'"
    )
    expect(normalizeWhitespace(titleExactIndexSql)).to.equal(
      normalizeWhitespace('CREATE INDEX library_items_library_media_type_title_id ON libraryItems (libraryId, mediaType, title COLLATE NOCASE, id)')
    )

    const [[{ count: titleIndexCount }]] = await queryInterface.sequelize.query(
      "SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='library_items_library_media_type_title_ignore_prefix_id'"
    )
    expect(titleIndexCount).to.equal(1)

    const [[{ sql: titleIndexSql }]] = await queryInterface.sequelize.query(
      "SELECT sql FROM sqlite_master WHERE type='index' AND name='library_items_library_media_type_title_ignore_prefix_id'"
    )
    expect(normalizeWhitespace(titleIndexSql)).to.equal(
      normalizeWhitespace('CREATE INDEX library_items_library_media_type_title_ignore_prefix_id ON libraryItems (libraryId, mediaType, titleIgnorePrefix COLLATE NOCASE, id)')
    )

    const [[{ sql: createdAtIndexSql }]] = await queryInterface.sequelize.query(
      "SELECT sql FROM sqlite_master WHERE type='index' AND name='library_items_library_media_type_created_at_id'"
    )
    expect(normalizeWhitespace(createdAtIndexSql)).to.equal(
      normalizeWhitespace('CREATE INDEX library_items_library_media_type_created_at_id ON libraryItems (libraryId, mediaType, createdAt, id)')
    )

    const [[{ sql: progressIndexSql }]] = await queryInterface.sequelize.query(
      "SELECT sql FROM sqlite_master WHERE type='index' AND name='media_progress_user_updated_at_id'"
    )
    expect(normalizeWhitespace(progressIndexSql)).to.equal(
      normalizeWhitespace('CREATE INDEX media_progress_user_updated_at_id ON mediaProgresses (userId, updatedAt, id)')
    )
  })

  it('is idempotent', async () => {
    await up({ context: { queryInterface, logger: Logger } })
    await up({ context: { queryInterface, logger: Logger } })

    const indexes = [
      'library_items_library_media_type_title_id',
      'library_items_library_media_type_title_ignore_prefix_id',
      'library_items_library_media_type_created_at_id',
      'media_progress_user_updated_at_id'
    ]

    for (const indexName of indexes) {
      const [[{ count }]] = await queryInterface.sequelize.query(
        `SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='${indexName}'`
      )
      expect(count, indexName).to.equal(1)
    }
  })
})
