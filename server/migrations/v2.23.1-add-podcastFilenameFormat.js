/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

/**
 * This upward migration script adds a new variable to allow saving podcast filename formats
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
const migrationVersion = '2.23.1'
const migrationName = `${migrationVersion}-add-podcastFilenameFormat-to-podcasts`
const loggerPrefix = `[${migrationVersion} migration]`
async function up({ context: { queryInterface, logger } }) {
  // Upwards migration script
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  // Run reindex nocase to fix potential corruption issues due to the bad sqlite extension introduced in v2.12.0
  logger.info(`${loggerPrefix} adding the variable`)
  await addColumn(queryInterface, logger, 'podcasts', 'podcastFilenameFormat', { type: queryInterface.sequelize.Sequelize.STRING, allowNull: true })

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This downward migration script is a no-op.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  // Downward migration script
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  logger.info(`${loggerPrefix} Dropping column from table`)
	await removeColumn(queryInterface, logger, 'podcasts', 'podcastFilenameFormat')


  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

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

async function removeColumn(queryInterface, logger, table, column) {
  logger.info(`${loggerPrefix} removing column "${column}" from table "${table}"`)
  await queryInterface.removeColumn(table, column)
  logger.info(`${loggerPrefix} removed column "${column}" from table "${table}"`)
}

module.exports = { up, down }
