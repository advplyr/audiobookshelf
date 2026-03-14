const chai = require('chai')
const sinon = require('sinon')
const { expect } = chai

const { DataTypes, Sequelize } = require('sequelize')
const Logger = require('../../../server/Logger')

const { up } = require('../../../server/migrations/v2.32.6-large-library-browse-indexes')

const TEST_POSTGRES_URL = process.env.TEST_POSTGRES_URL
const normalizeWhitespace = (str) => str.replace(/\s+/g, ' ').trim().toLowerCase()

describe('Migration v2.32.6-large-library-browse-indexes (postgres)', () => {
  if (!TEST_POSTGRES_URL) {
    it('skips because TEST_POSTGRES_URL is not set', function() {
      this.skip()
    })
    return
  }

  let sequelize
  let queryInterface

  beforeEach(async () => {
    sequelize = new Sequelize(TEST_POSTGRES_URL, {
      dialect: 'postgres',
      logging: false
    })
    queryInterface = sequelize.getQueryInterface()
    sinon.stub(Logger, 'info')

    await queryInterface.dropTable('mediaProgresses').catch(() => {})
    await queryInterface.dropTable('libraryItems').catch(() => {})
    await queryInterface.dropTable('books').catch(() => {})

    await queryInterface.createTable('books', {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true }
    })

    await queryInterface.createTable('libraryItems', {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      libraryId: { type: DataTypes.UUID, allowNull: false },
      mediaType: { type: DataTypes.STRING, allowNull: false },
      title: { type: DataTypes.TEXT, allowNull: true },
      titleIgnorePrefix: { type: DataTypes.TEXT, allowNull: true },
      authorNamesFirstLast: { type: DataTypes.TEXT, allowNull: true },
      authorNamesLastFirst: { type: DataTypes.TEXT, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: true },
      updatedAt: { type: DataTypes.DATE, allowNull: true }
    })

    await queryInterface.createTable('mediaProgresses', {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: true }
    })
  })

  afterEach(async () => {
    sinon.restore()
    if (queryInterface) {
      await queryInterface.dropTable('mediaProgresses').catch(() => {})
      await queryInterface.dropTable('libraryItems').catch(() => {})
      await queryInterface.dropTable('books').catch(() => {})
    }
    if (sequelize) {
      await sequelize.close()
    }
  })

  it('creates browse indexes with the expected names and functional order', async () => {
    await up({ context: { queryInterface, logger: Logger } })

    const [rows] = await queryInterface.sequelize.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'library_items_library_media_type_author_names_first_last_title_id',
          'library_items_library_media_type_author_names_first_last_title_ignore_prefix_id',
          'library_items_library_media_type_author_names_last_first_title_id',
          'library_items_library_media_type_author_names_last_first_title_ignore_prefix_id',
          'library_items_library_media_type_title_id',
          'library_items_library_media_type_title_ignore_prefix_id',
          'library_items_library_media_type_created_at_id',
          'library_items_library_media_type_updated_at_id',
          'media_progress_user_updated_at_id'
        )
      ORDER BY indexname ASC
    `)

    expect(rows.map((row) => row.indexname)).to.deep.equal([
      'library_items_library_media_type_author_names_first_last_title_id',
      'library_items_library_media_type_author_names_first_last_title_ignore_prefix_id',
      'library_items_library_media_type_author_names_last_first_title_id',
      'library_items_library_media_type_author_names_last_first_title_ignore_prefix_id',
      'library_items_library_media_type_created_at_id',
      'library_items_library_media_type_title_id',
      'library_items_library_media_type_title_ignore_prefix_id',
      'library_items_library_media_type_updated_at_id',
      'media_progress_user_updated_at_id'
    ])

    expect(normalizeWhitespace(rows.find((row) => row.indexname === 'library_items_library_media_type_author_names_first_last_title_id').indexdef)).to.include('lower("authornamesfirstlast"), lower("title"), "id"')
    expect(normalizeWhitespace(rows.find((row) => row.indexname === 'library_items_library_media_type_author_names_first_last_title_ignore_prefix_id').indexdef)).to.include('lower("authornamesfirstlast"), lower("titleignoreprefix"), "id"')
    expect(normalizeWhitespace(rows.find((row) => row.indexname === 'library_items_library_media_type_author_names_last_first_title_id').indexdef)).to.include('lower("authornameslastfirst"), lower("title"), "id"')
    expect(normalizeWhitespace(rows.find((row) => row.indexname === 'library_items_library_media_type_author_names_last_first_title_ignore_prefix_id').indexdef)).to.include('lower("authornameslastfirst"), lower("titleignoreprefix"), "id"')
    expect(normalizeWhitespace(rows.find((row) => row.indexname === 'library_items_library_media_type_title_id').indexdef)).to.include('lower("title"), "id"')
    expect(normalizeWhitespace(rows.find((row) => row.indexname === 'library_items_library_media_type_title_ignore_prefix_id').indexdef)).to.include('lower("titleignoreprefix"), "id"')
    expect(normalizeWhitespace(rows.find((row) => row.indexname === 'library_items_library_media_type_created_at_id').indexdef)).to.include('("libraryid", "mediatype", "createdat", "id")')
    expect(normalizeWhitespace(rows.find((row) => row.indexname === 'library_items_library_media_type_updated_at_id').indexdef)).to.include('("libraryid", "mediatype", "updatedat", "id")')
    expect(normalizeWhitespace(rows.find((row) => row.indexname === 'media_progress_user_updated_at_id').indexdef)).to.include('("userid", "updatedat", "id")')
  })
})
