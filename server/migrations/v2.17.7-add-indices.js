/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.17.7'
const migrationName = `${migrationVersion}-add-indices`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This upward migration adds some indices to the libraryItems and books tables to improve query performance
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  // Upwards migration script
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  await addIndex(queryInterface, logger, 'libraryItems', ['libraryId', 'mediaType', 'size'])
  await addIndex(queryInterface, logger, 'books', ['duration'])

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This downward migration script removes the indices added in the upward migration script
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  // Downward migration script
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  await removeIndex(queryInterface, logger, 'libraryItems', ['libraryId', 'mediaType', 'size'])
  await removeIndex(queryInterface, logger, 'books', ['duration'])

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

/**
 * Utility function to add an index to a table. If the index already exists, it logs a message and continues.
 *
 * @param {import('sequelize').QueryInterface} queryInterface
 * @param {import ('../Logger')} logger
 * @param {string} tableName
 * @param {string[]} columns
 */
async function addIndex(queryInterface, logger, tableName, columns) {
  try {
    logger.info(`${loggerPrefix} adding index [${columns.join(', ')}] to table "${tableName}"`)
    await queryInterface.addIndex(tableName, columns)
    logger.info(`${loggerPrefix} added index [${columns.join(', ')}] to table "${tableName}"`)
  } catch (error) {
    if (error.name === 'SequelizeDatabaseError' && error.message.includes('already exists')) {
      logger.info(`${loggerPrefix} index [${columns.join(', ')}] for table "${tableName}" already exists`)
    } else {
      throw error
    }
  }
}

/**
 * Utility function to remove an index from a table.
 * Sequelize implemets it using DROP INDEX IF EXISTS, so it won't throw an error if the index doesn't exist.
 *
 * @param {import('sequelize').QueryInterface} queryInterface
 * @param {import ('../Logger')} logger
 * @param {string} tableName
 * @param {string[]} columns
 */
async function removeIndex(queryInterface, logger, tableName, columns) {
  logger.info(`${loggerPrefix} removing index [${columns.join(', ')}] from table "${tableName}"`)
  await queryInterface.removeIndex(tableName, columns)
  logger.info(`${loggerPrefix} removed index [${columns.join(', ')}] from table "${tableName}"`)
}

module.exports = { up, down }
