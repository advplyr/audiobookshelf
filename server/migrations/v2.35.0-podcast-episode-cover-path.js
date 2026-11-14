/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a Sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.35.0'
const migrationName = `${migrationVersion}-podcast-episode-cover-path`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This migration script adds the coverPath column to podcastEpisodes and feedEpisodes tables.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('podcastEpisodes')) {
    const tableDescription = await queryInterface.describeTable('podcastEpisodes')
    if (!tableDescription.coverPath) {
      logger.info(`${loggerPrefix} Adding coverPath column to podcastEpisodes table`)
      await queryInterface.addColumn('podcastEpisodes', 'coverPath', {
        type: queryInterface.sequelize.Sequelize.DataTypes.STRING,
        allowNull: true
      })
    } else {
      logger.info(`${loggerPrefix} coverPath column already exists in podcastEpisodes table`)
    }
  }

  if (await queryInterface.tableExists('feedEpisodes')) {
    const feedTableDescription = await queryInterface.describeTable('feedEpisodes')
    if (!feedTableDescription.coverPath) {
      logger.info(`${loggerPrefix} Adding coverPath column to feedEpisodes table`)
      await queryInterface.addColumn('feedEpisodes', 'coverPath', {
        type: queryInterface.sequelize.Sequelize.DataTypes.STRING,
        allowNull: true
      })
    } else {
      logger.info(`${loggerPrefix} coverPath column already exists in feedEpisodes table`)
    }
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This migration script removes the coverPath column from podcastEpisodes and feedEpisodes tables.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('podcastEpisodes')) {
    const tableDescription = await queryInterface.describeTable('podcastEpisodes')
    if (tableDescription.coverPath) {
      logger.info(`${loggerPrefix} Removing coverPath column from podcastEpisodes table`)
      await queryInterface.removeColumn('podcastEpisodes', 'coverPath')
    }
  }

  if (await queryInterface.tableExists('feedEpisodes')) {
    const feedTableDescription = await queryInterface.describeTable('feedEpisodes')
    if (feedTableDescription.coverPath) {
      logger.info(`${loggerPrefix} Removing coverPath column from feedEpisodes table`)
      await queryInterface.removeColumn('feedEpisodes', 'coverPath')
    }
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }
