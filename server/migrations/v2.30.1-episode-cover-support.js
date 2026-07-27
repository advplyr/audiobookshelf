/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a Sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.30.1'
const migrationName = `${migrationVersion}-episode-cover-support`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This migration adds support for episode-specific cover art by adding:
 * - coverPath and imageURL columns to podcastEpisodes table
 * - episodeCoverURL column to feedEpisodes table
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  // Upgrade podcastEpisodes table
  if (await queryInterface.tableExists('podcastEpisodes')) {
    const podcastEpisodesDescription = await queryInterface.describeTable('podcastEpisodes')

    // Add coverPath column if it doesn't exist
    if (!podcastEpisodesDescription.coverPath) {
      logger.info(`${loggerPrefix} Adding coverPath column to podcastEpisodes table`)
      await queryInterface.addColumn('podcastEpisodes', 'coverPath', {
        type: queryInterface.sequelize.Sequelize.DataTypes.STRING,
        allowNull: true
      })
      logger.info(`${loggerPrefix} Added coverPath column to podcastEpisodes table`)
    } else {
      logger.info(`${loggerPrefix} coverPath column already exists in podcastEpisodes table`)
    }

    // Add imageURL column if it doesn't exist
    if (!podcastEpisodesDescription.imageURL) {
      logger.info(`${loggerPrefix} Adding imageURL column to podcastEpisodes table`)
      await queryInterface.addColumn('podcastEpisodes', 'imageURL', {
        type: queryInterface.sequelize.Sequelize.DataTypes.STRING,
        allowNull: true
      })
      logger.info(`${loggerPrefix} Added imageURL column to podcastEpisodes table`)
    } else {
      logger.info(`${loggerPrefix} imageURL column already exists in podcastEpisodes table`)
    }
  } else {
    logger.info(`${loggerPrefix} podcastEpisodes table does not exist`)
  }

  // Upgrade feedEpisodes table
  if (await queryInterface.tableExists('feedEpisodes')) {
    const feedEpisodesDescription = await queryInterface.describeTable('feedEpisodes')

    // Add episodeCoverURL column if it doesn't exist
    if (!feedEpisodesDescription.episodeCoverURL) {
      logger.info(`${loggerPrefix} Adding episodeCoverURL column to feedEpisodes table`)
      await queryInterface.addColumn('feedEpisodes', 'episodeCoverURL', {
        type: queryInterface.sequelize.Sequelize.DataTypes.STRING,
        allowNull: true
      })
      logger.info(`${loggerPrefix} Added episodeCoverURL column to feedEpisodes table`)
    } else {
      logger.info(`${loggerPrefix} episodeCoverURL column already exists in feedEpisodes table`)
    }
  } else {
    logger.info(`${loggerPrefix} feedEpisodes table does not exist`)
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This migration removes episode-specific cover art support by removing:
 * - coverPath and imageURL columns from podcastEpisodes table
 * - episodeCoverURL column from feedEpisodes table
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  // Downgrade podcastEpisodes table
  if (await queryInterface.tableExists('podcastEpisodes')) {
    const podcastEpisodesDescription = await queryInterface.describeTable('podcastEpisodes')

    // Remove coverPath column if it exists
    if (podcastEpisodesDescription.coverPath) {
      logger.info(`${loggerPrefix} Removing coverPath column from podcastEpisodes table`)
      await queryInterface.removeColumn('podcastEpisodes', 'coverPath')
      logger.info(`${loggerPrefix} Removed coverPath column from podcastEpisodes table`)
    } else {
      logger.info(`${loggerPrefix} coverPath column does not exist in podcastEpisodes table`)
    }

    // Remove imageURL column if it exists
    if (podcastEpisodesDescription.imageURL) {
      logger.info(`${loggerPrefix} Removing imageURL column from podcastEpisodes table`)
      await queryInterface.removeColumn('podcastEpisodes', 'imageURL')
      logger.info(`${loggerPrefix} Removed imageURL column from podcastEpisodes table`)
    } else {
      logger.info(`${loggerPrefix} imageURL column does not exist in podcastEpisodes table`)
    }
  } else {
    logger.info(`${loggerPrefix} podcastEpisodes table does not exist`)
  }

  // Downgrade feedEpisodes table
  if (await queryInterface.tableExists('feedEpisodes')) {
    const feedEpisodesDescription = await queryInterface.describeTable('feedEpisodes')

    // Remove episodeCoverURL column if it exists
    if (feedEpisodesDescription.episodeCoverURL) {
      logger.info(`${loggerPrefix} Removing episodeCoverURL column from feedEpisodes table`)
      await queryInterface.removeColumn('feedEpisodes', 'episodeCoverURL')
      logger.info(`${loggerPrefix} Removed episodeCoverURL column from feedEpisodes table`)
    } else {
      logger.info(`${loggerPrefix} episodeCoverURL column does not exist in feedEpisodes table`)
    }
  } else {
    logger.info(`${loggerPrefix} feedEpisodes table does not exist`)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }
