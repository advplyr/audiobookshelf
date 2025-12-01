/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.30.1'
const migrationName = `${migrationVersion}-add-is-authenticated-feed`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This upward migration adds the isAuthenticatedFeed column to the podcasts table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  // Upwards migration script
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  const DataTypes = queryInterface.sequelize.Sequelize.DataTypes

  // Check if column exists
  const tableDescription = await queryInterface.describeTable('podcasts')
  if (tableDescription.isAuthenticatedFeed) {
    logger.info(`${loggerPrefix} column "isAuthenticatedFeed" already exists in "podcasts" table`)
  } else {
    // Add column
    logger.info(`${loggerPrefix} adding column "isAuthenticatedFeed" to "podcasts" table`)
    await queryInterface.addColumn('podcasts', 'isAuthenticatedFeed', {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    })
    logger.info(`${loggerPrefix} added column "isAuthenticatedFeed" to "podcasts" table`)
  }

  logger.info(`${loggerPrefix} UPGRADE COMPLETE: ${migrationName}`)
}

/**
 * This downward migration removes the isAuthenticatedFeed column from the podcasts table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  // Downwards migration script
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  // Check if column exists
  const tableDescription = await queryInterface.describeTable('podcasts')
  if (!tableDescription.isAuthenticatedFeed) {
    logger.info(`${loggerPrefix} column "isAuthenticatedFeed" does not exist in "podcasts" table`)
  } else {
    // Remove column
    logger.info(`${loggerPrefix} removing column "isAuthenticatedFeed" from "podcasts" table`)
    await queryInterface.removeColumn('podcasts', 'isAuthenticatedFeed')
    logger.info(`${loggerPrefix} removed column "isAuthenticatedFeed" from "podcasts" table`)
  }

  logger.info(`${loggerPrefix} DOWNGRADE COMPLETE: ${migrationName}`)
}

module.exports = { up, down }
