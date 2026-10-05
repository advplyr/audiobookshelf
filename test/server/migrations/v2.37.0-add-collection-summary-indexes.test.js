const { expect } = require('chai')
const { DataTypes, Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')
const MigrationManager = require('../../../server/managers/MigrationManager')
const { up, down } = require('../../../server/migrations/v2.37.0-add-collection-summary-indexes')

function normalizeIndexSql(sql) {
  return sql.replace(/[`"\[\]]/g, '').replace(/\s+/g, ' ').trim()
}

function expectSummaryIndexDefinitions(definitions) {
  expect(definitions.map(({ name }) => name)).to.deep.equal(['collection_books_collection_id_order_book_id', 'collections_library_id_name_nocase_id'])
  const sqlByName = Object.fromEntries(definitions.map(({ name, sql }) => [name, normalizeIndexSql(sql)]))
  expect(sqlByName.collection_books_collection_id_order_book_id).to.match(/^CREATE INDEX collection_books_collection_id_order_book_id ON collectionBooks \(collectionId, order, bookId\)$/i)
  expect(sqlByName.collections_library_id_name_nocase_id).to.match(/^CREATE INDEX collections_library_id_name_nocase_id ON collections \(libraryId, name COLLATE NOCASE, id\)$/i)
}

describe('Migration v2.37.0-add-collection-summary-indexes', () => {
  let sequelize
  let queryInterface

  beforeEach(async () => {
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false
    })
    queryInterface = sequelize.getQueryInterface()
    sinon.stub(Logger, 'info')

    await queryInterface.createTable('collections', {
      id: { type: DataTypes.STRING, primaryKey: true },
      libraryId: DataTypes.STRING,
      name: DataTypes.STRING
    })
    await queryInterface.createTable('collectionBooks', {
      id: { type: DataTypes.STRING, primaryKey: true },
      collectionId: DataTypes.STRING,
      bookId: DataTypes.STRING,
      order: DataTypes.INTEGER
    })
    await queryInterface.createTable('books', {
      id: { type: DataTypes.STRING, primaryKey: true },
      explicit: DataTypes.BOOLEAN,
      coverPath: DataTypes.STRING
    })
    await queryInterface.createTable('libraryItems', {
      id: { type: DataTypes.STRING, primaryKey: true },
      mediaId: DataTypes.STRING,
      mediaType: DataTypes.STRING
    })
  })

  afterEach(async () => {
    sinon.restore()
    await sequelize.close()
  })

  it('adds exact definitions idempotently and removes them idempotently', async () => {
    await up({ context: { queryInterface, logger: Logger } })
    await up({ context: { queryInterface, logger: Logger } })

    const [definitions] = await sequelize.query(
      "SELECT name, sql FROM sqlite_master WHERE type = 'index' AND name IN ('collections_library_id_name_nocase_id', 'collection_books_collection_id_order_book_id') ORDER BY name"
    )
    expectSummaryIndexDefinitions(definitions)

    await down({ context: { queryInterface, logger: Logger } })
    await down({ context: { queryInterface, logger: Logger } })

    const collectionIndexes = await queryInterface.showIndex('collections')
    expect(collectionIndexes.some((index) => index.name === 'collections_library_id_name_nocase_id')).to.equal(false)
  })

  it('is selected by representative final collection and membership query plans', async () => {
    await up({ context: { queryInterface, logger: Logger } })

    const [collectionPlan] = await sequelize.query(
      "EXPLAIN QUERY PLAN SELECT c.id FROM collections c WHERE c.libraryId = 'library' AND EXISTS (SELECT 1 FROM collectionBooks cb JOIN books b ON b.id = cb.bookId WHERE cb.collectionId = c.id AND b.explicit = 0) ORDER BY c.name COLLATE NOCASE, c.id LIMIT 20"
    )
    const [membershipPlan] = await sequelize.query(
      "EXPLAIN QUERY PLAN WITH rankedPreviews AS (SELECT cb.collectionId, li.id, b.coverPath, ROW_NUMBER() OVER (PARTITION BY cb.collectionId ORDER BY cb.`order` ASC, cb.bookId ASC) AS previewRank FROM collectionBooks cb JOIN books b ON b.id = cb.bookId JOIN libraryItems li ON li.mediaId = b.id AND li.mediaType = 'book' WHERE cb.collectionId IN ('collection-a', 'collection-b') AND b.explicit = 0) SELECT collectionId, id, coverPath FROM rankedPreviews WHERE previewRank <= 2 ORDER BY collectionId ASC, previewRank ASC"
    )

    expect(collectionPlan.map((row) => row.detail).join('\n')).to.include('collections_library_id_name_nocase_id')
    expect(membershipPlan.map((row) => row.detail).join('\n')).to.include('collection_books_collection_id_order_book_id')
  })

  it('creates exact definitions and uses them for a fresh Database.buildModels schema', async () => {
    await sequelize.close()
    Database.sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false
    })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    sequelize = Database.sequelize
    queryInterface = sequelize.getQueryInterface()
    await Database.buildModels()

    const [definitions] = await sequelize.query(
      "SELECT name, sql FROM sqlite_master WHERE type = 'index' AND name IN ('collections_library_id_name_nocase_id', 'collection_books_collection_id_order_book_id') ORDER BY name"
    )
    expectSummaryIndexDefinitions(definitions)

    const [collectionPlan] = await sequelize.query(
      "EXPLAIN QUERY PLAN SELECT c.id FROM collections c WHERE c.libraryId = 'library' ORDER BY c.name COLLATE NOCASE, c.id LIMIT 20"
    )
    const [membershipPlan] = await sequelize.query(
      "EXPLAIN QUERY PLAN SELECT cb.collectionId, cb.bookId FROM collectionBooks cb WHERE cb.collectionId IN ('collection-a', 'collection-b') ORDER BY cb.collectionId, cb.`order`, cb.bookId"
    )
    const [previewJoinPlan] = await sequelize.query(
      "EXPLAIN QUERY PLAN SELECT li.id FROM libraryItems li WHERE li.libraryId = 'library' AND li.mediaId = 'book' AND li.mediaType = 'book'"
    )
    expect(collectionPlan.map((row) => row.detail).join('\n')).to.include('collections_library_id_name_nocase_id')
    expect(membershipPlan.map((row) => row.detail).join('\n')).to.include('collection_books_collection_id_order_book_id')
    expect(previewJoinPlan.map((row) => row.detail).join('\n')).to.include('library_items_library_id_media_id_media_type')

    await up({ context: { queryInterface, logger: Logger } })
  })

  it('is eligible when upgrading database version 2.36.0 to server version 2.37.0', () => {
    const migrationManager = new MigrationManager(sequelize, false, '/tmp')
    migrationManager.databaseVersion = '2.36.0'
    migrationManager.serverVersion = '2.37.0'
    const migrationName = 'v2.37.0-add-collection-summary-indexes.js'

    expect(migrationManager.findMigrationsToRun([{ name: migrationName }], [], 'up')).to.deep.equal([migrationName])
  })
})
