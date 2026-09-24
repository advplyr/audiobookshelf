/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a Sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.37.0'
const migrationName = `${migrationVersion}-add-podcast-auto-download-filters`
const loggerPrefix = `[${migrationVersion} migration]`

const columnNames = ['autoDownloadMinDuration', 'autoDownloadExcludeTerms']

/**
 * This migration script adds the autoDownloadMinDuration and autoDownloadExcludeTerms columns to the podcasts table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('podcasts')) {
    const tableDescription = await queryInterface.describeTable('podcasts')
    const DataTypes = queryInterface.sequelize.Sequelize.DataTypes
    const columnTypes = {
      autoDownloadMinDuration: DataTypes.INTEGER,
      autoDownloadExcludeTerms: DataTypes.JSON
    }

    for (const columnName of columnNames) {
      if (!tableDescription[columnName]) {
        logger.info(`${loggerPrefix} Adding ${columnName} column to podcasts table`)
        await queryInterface.addColumn('podcasts', columnName, {
          type: columnTypes[columnName],
          allowNull: true
        })
      } else {
        logger.info(`${loggerPrefix} ${columnName} column already exists in podcasts table`)
      }
    }
  } else {
    logger.info(`${loggerPrefix} podcasts table does not exist`)
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This migration script removes the autoDownloadMinDuration and autoDownloadExcludeTerms columns from the podcasts table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('podcasts')) {
    const tableDescription = await queryInterface.describeTable('podcasts')

    for (const columnName of columnNames) {
      if (tableDescription[columnName]) {
        logger.info(`${loggerPrefix} Removing ${columnName} column from podcasts table`)
        await queryInterface.removeColumn('podcasts', columnName)
      } else {
        logger.info(`${loggerPrefix} ${columnName} column does not exist in podcasts table`)
      }
    }
  } else {
    logger.info(`${loggerPrefix} podcasts table does not exist`)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }
