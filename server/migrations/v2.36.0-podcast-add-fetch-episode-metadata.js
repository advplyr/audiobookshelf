/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a Sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.36.0'
const migrationName = `${migrationVersion}-podcast-add-fetch-episode-metadata`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This migration script adds the fetchEpisodeMetadata column to the podcasts table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('podcasts')) {
    const tableDescription = await queryInterface.describeTable('podcasts')
    if (!tableDescription.fetchEpisodeMetadata) {
      logger.info(`${loggerPrefix} Adding fetchEpisodeMetadata column to podcasts table`)
      await queryInterface.addColumn('podcasts', 'fetchEpisodeMetadata', {
        type: queryInterface.sequelize.Sequelize.DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
      })
      logger.info(`${loggerPrefix} Added fetchEpisodeMetadata column to podcasts table`)
    } else {
      logger.info(`${loggerPrefix} fetchEpisodeMetadata column already exists in podcasts table`)
    }
  } else {
    logger.info(`${loggerPrefix} podcasts table does not exist`)
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This migration script removes the fetchEpisodeMetadata column from the podcasts table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('podcasts')) {
    const tableDescription = await queryInterface.describeTable('podcasts')
    if (tableDescription.fetchEpisodeMetadata) {
      logger.info(`${loggerPrefix} Removing fetchEpisodeMetadata column from podcasts table`)
      await queryInterface.removeColumn('podcasts', 'fetchEpisodeMetadata')
      logger.info(`${loggerPrefix} Removed fetchEpisodeMetadata column from podcasts table`)
    } else {
      logger.info(`${loggerPrefix} fetchEpisodeMetadata column does not exist in podcasts table`)
    }
  } else {
    logger.info(`${loggerPrefix} podcasts table does not exist`)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }
