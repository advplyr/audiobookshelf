const util = require('util')

/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.34.0'
const migrationName = `${migrationVersion}-add-auto-generate-podcast-chapters`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This upward migration adds a boolean autoGenerateChapters column to the podcasts table and defaults it to false.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  await addColumn(queryInterface, logger, 'podcasts', 'autoGenerateChapters', { type: queryInterface.sequelize.Sequelize.BOOLEAN, allowNull: false, defaultValue: false })

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This downward migration removes the autoGenerateChapters column on the podcasts table,
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  await removeColumn(queryInterface, logger, 'podcasts', 'autoGenerateChapters')

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

/**
 * Utility function to add a column to a table. If the column already exists, it logs a message and continues.
 *
 * @param {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @param {import('../Logger')} logger - a Logger object.
 * @param {string} table - the name of the table to add the column to.
 * @param {string} column - the name of the column to add.
 * @param {Object} options - the options for the column.
 */
async function addColumn(queryInterface, logger, table, column, options) {
  logger.info(`${loggerPrefix} adding column "${column}" to table "${table}"`)
  const tableDescription = await queryInterface.describeTable(table)
  if (!tableDescription[column]) {
    await queryInterface.addColumn(table, column, options)
    logger.info(`${loggerPrefix} added column "${column}" to table "${table}"`)
  } else {
    logger.info(`${loggerPrefix} column "${column}" already exists in table "${table}"`)
  }
}

/**
 * Utility function to remove a column from a table. If the column does not exist, it logs a message and continues.
 *
 * @param {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @param {import('../Logger')} logger - a Logger object.
 * @param {string} table - the name of the table to remove the column from.
 * @param {string} column - the name of the column to remove.
 */
async function removeColumn(queryInterface, logger, table, column) {
  logger.info(`${loggerPrefix} removing column "${column}" from table "${table}"`)
  const tableDescription = await queryInterface.describeTable(table)
  if (tableDescription[column]) {
    await queryInterface.sequelize.query(`ALTER TABLE ${table} DROP COLUMN ${column}`)
    logger.info(`${loggerPrefix} removed column "${column}" from table "${table}"`)
  } else {
    logger.info(`${loggerPrefix} column "${column}" does not exist in table "${table}"`)
  }
}

module.exports = { up, down }
