/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a Sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.37.2'
const migrationName = `${migrationVersion}-add-genres-feeds`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This migration script adds genres column to the feeds table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('feeds')) {
    const tableDescription = await queryInterface.describeTable('feeds')

    if (!tableDescription.genres) {
      logger.info(`${loggerPrefix} Adding genres column to feeds table`)
      await queryInterface.addColumn('feeds', 'genres', {
        type: queryInterface.sequelize.Sequelize.DataTypes.JSON,
        allowNull: true
      })
    } else {
      logger.info(`${loggerPrefix} genres column already exists in feeds table`)
    }

  } else {
    logger.info(`${loggerPrefix} feeds table does not exist`)
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This migration script removes the genres columns from the feeds table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('feeds')) {
    const tableDescription = await queryInterface.describeTable('feeds')

    if (tableDescription.genres) {
      logger.info(`${loggerPrefix} Removing genres column from feeds table`)
      await queryInterface.removeColumn('feeds', 'genres')
    } else {
      logger.info(`${loggerPrefix} genres column does not exist in feeds table`)
    }

  } else {
    logger.info(`${loggerPrefix} feeds table does not exist`)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }
