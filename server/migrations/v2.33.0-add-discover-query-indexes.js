/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface
 * @property {import('../Logger')} logger
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context
 */

const migrationVersion = '2.33.0'
const migrationName = `${migrationVersion}-add-discover-query-indexes`
const loggerPrefix = `[${migrationVersion} migration]`

const indexes = [
  {
    table: 'mediaProgresses',
    name: 'media_progresses_user_item_finished_time',
    fields: ['userId', 'mediaItemId', 'isFinished', 'currentTime']
  },
  {
    table: 'bookSeries',
    name: 'book_series_series_book',
    fields: ['seriesId', 'bookId']
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
  const existing = await showIndexNames(queryInterface, index.table)
  if (existing.some((name) => name.toLowerCase() === index.name.toLowerCase())) {
    logger.info(`${loggerPrefix} index ${index.name} already exists on ${index.table}`)
    return
  }

  logger.info(`${loggerPrefix} adding index ${index.name} on ${index.table}(${index.fields.join(', ')})`)
  await queryInterface.addIndex(index.table, {
    name: index.name,
    fields: index.fields
  })
  logger.info(`${loggerPrefix} added index ${index.name}`)
}

async function removeIndexIfExists(queryInterface, logger, index) {
  const existing = await showIndexNames(queryInterface, index.table)
  if (!existing.some((name) => name.toLowerCase() === index.name.toLowerCase())) {
    logger.info(`${loggerPrefix} index ${index.name} does not exist on ${index.table}`)
    return
  }

  logger.info(`${loggerPrefix} removing index ${index.name}`)
  await queryInterface.removeIndex(index.table, index.name)
  logger.info(`${loggerPrefix} removed index ${index.name}`)
}

/**
 * Sequelize showIndex matches the table name case-sensitively, but postgres folds
 * unquoted identifiers to lowercase, so query pg_indexes directly on postgres.
 *
 * @returns {Promise<string[]>} index names on the table
 */
async function showIndexNames(queryInterface, table) {
  if (queryInterface.sequelize.getDialect() === 'postgres') {
    const [rows] = await queryInterface.sequelize.query('SELECT indexname AS name FROM pg_indexes WHERE schemaname = current_schema() AND tablename = $1', {
      bind: [table.toLowerCase()]
    })
    return rows.map((row) => row.name)
  }
  const existing = await queryInterface.showIndex(table)
  return existing.map((row) => row.name)
}

module.exports = { up, down }
