/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a Sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.38.0'
const migrationName = `${migrationVersion}-add-episode-cover`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This migration script adds episode cover columns in podcastEpisodes and feedEpisodes.
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

    if (!tableDescription.imageURL) {
      logger.info(`${loggerPrefix} Adding imageURL column to podcastEpisodes table`)
      await queryInterface.addColumn('podcastEpisodes', 'imageURL', {
        type: queryInterface.sequelize.Sequelize.DataTypes.STRING,
        allowNull: true
      })
    } else {
      logger.info(`${loggerPrefix} imageURL column already exists in podcastEpisodes table`)
    }
  } else {
    logger.info(`${loggerPrefix} podcastEpisodes table does not exist`)
  }

  if (await queryInterface.tableExists('feedEpisodes')) {
    const tableDescription = await queryInterface.describeTable('feedEpisodes')

    if (!tableDescription.coverPath) {
      logger.info(`${loggerPrefix} Adding coverPath column to feedEpisodes table`)
      await queryInterface.addColumn('feedEpisodes', 'coverPath', {
        type: queryInterface.sequelize.Sequelize.DataTypes.STRING,
        allowNull: true
      })
    } else {
      logger.info(`${loggerPrefix} coverPath column already exists in feedEpisodes table`)
    }
  } else {
    logger.info(`${loggerPrefix} feedEpisodes table does not exist`)
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This migration script removes episode cover columns in podcastEpisodes and feedEpisodes.
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
      await removeColumn(queryInterface, 'podcastEpisodes', 'coverPath')
    } else {
      logger.info(`${loggerPrefix} coverPath column does not exist in podcastEpisodes table`)
    }

    if (tableDescription.imageURL) {
      logger.info(`${loggerPrefix} Removing imageURL column from podcastEpisodes table`)
      await removeColumn(queryInterface, 'podcastEpisodes', 'imageURL')
    } else {
      logger.info(`${loggerPrefix} imageURL column does not exist in podcastEpisodes table`)
    }
  } else {
    logger.info(`${loggerPrefix} podcastEpisodes table does not exist`)
  }

  if (await queryInterface.tableExists('feedEpisodes')) {
    const tableDescription = await queryInterface.describeTable('feedEpisodes')

    if (tableDescription.coverPath) {
      logger.info(`${loggerPrefix} Removing coverPath column from feedEpisodes table`)
      await removeColumn(queryInterface, 'feedEpisodes', 'coverPath')
    } else {
      logger.info(`${loggerPrefix} coverPath column does not exist in feedEpisodes table`)
    }
  } else {
    logger.info(`${loggerPrefix} feedEpisodes table does not exist`)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

/**
 * Remove a column without rebuilding the SQLite table and losing its indexes.
 * @param {import('sequelize').QueryInterface} queryInterface
 * @param {string} table
 * @param {string} column
 */
async function removeColumn(queryInterface, table, column) {
  await queryInterface.sequelize.query(`ALTER TABLE ${table} DROP COLUMN ${column}`)
}

module.exports = { up, down }
