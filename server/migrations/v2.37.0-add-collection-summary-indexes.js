/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface
 * @property {import('../Logger')} logger
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context
 */

const migrationVersion = '2.37.0'
const migrationName = `${migrationVersion}-add-collection-summary-indexes`
const loggerPrefix = `[${migrationVersion} migration]`

const indexes = [
  {
    table: 'collections',
    name: 'collections_library_id_name_nocase_id',
    sql: 'CREATE INDEX collections_library_id_name_nocase_id ON collections (libraryId, name COLLATE NOCASE, id)'
  },
  {
    table: 'collectionBooks',
    name: 'collection_books_collection_id_order_book_id',
    sql: 'CREATE INDEX collection_books_collection_id_order_book_id ON collectionBooks (collectionId, `order`, bookId)'
  }
]

async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  for (const index of indexes) {
    await addIndexIfMissing(queryInterface, logger, index)
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  for (const index of indexes) {
    await removeIndexIfExists(queryInterface, logger, index)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

async function addIndexIfMissing(queryInterface, logger, index) {
  const existing = await queryInterface.showIndex(index.table)
  if (existing.some((i) => i.name === index.name)) {
    logger.info(`${loggerPrefix} index ${index.name} already exists on ${index.table}`)
    return
  }

  logger.info(`${loggerPrefix} adding index ${index.name} on ${index.table}`)
  await queryInterface.sequelize.query(index.sql)
  logger.info(`${loggerPrefix} added index ${index.name}`)
}

async function removeIndexIfExists(queryInterface, logger, index) {
  const existing = await queryInterface.showIndex(index.table)
  if (!existing.some((i) => i.name === index.name)) {
    logger.info(`${loggerPrefix} index ${index.name} does not exist on ${index.table}`)
    return
  }

  logger.info(`${loggerPrefix} removing index ${index.name}`)
  await queryInterface.removeIndex(index.table, index.name)
  logger.info(`${loggerPrefix} removed index ${index.name}`)
}

module.exports = { up, down }
