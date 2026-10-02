/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface
 * @property {import('../Logger')} logger
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context
 */

const migrationVersion = '2.36.1'
const migrationName = `${migrationVersion}-add-feed-episode-subtitle`
const loggerPrefix = `[${migrationVersion} migration]`

async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('feedEpisodes')) {
    const tableDescription = await queryInterface.describeTable('feedEpisodes')

    if (!tableDescription.subtitle) {
      logger.info(`${loggerPrefix} Adding subtitle column to feedEpisodes table`)

      await queryInterface.addColumn('feedEpisodes', 'subtitle', {
        type: queryInterface.sequelize.Sequelize.DataTypes.STRING,
        allowNull: true
      })

      logger.info(`${loggerPrefix} Added subtitle column to feedEpisodes table`)
    } else {
      logger.info(`${loggerPrefix} subtitle column already exists in feedEpisodes table`)
    }
  } else {
    logger.info(`${loggerPrefix} feedEpisodes table does not exist`)
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('feedEpisodes')) {
    const tableDescription = await queryInterface.describeTable('feedEpisodes')

    if (tableDescription.subtitle) {
      logger.info(`${loggerPrefix} Removing subtitle column from feedEpisodes table`)
      await queryInterface.removeColumn('feedEpisodes', 'subtitle')
      logger.info(`${loggerPrefix} Removed subtitle column from feedEpisodes table`)
    }
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }


