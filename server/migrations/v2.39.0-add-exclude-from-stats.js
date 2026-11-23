/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a Sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 * @returns {Promise<void>}
 */

const migrationVersion = '2.39.0'
const migrationName = `${migrationVersion}-add-exclude-from-stats`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This migration script adds the excludeFromStats column to the libraryItem table.
 * When set, listening sessions and media progress for the item are not included in the user's listening stats.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>}
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  const tableDescription = await queryInterface.describeTable('libraryItem')
  if (!tableDescription.excludeFromStats) {
    logger.info(`${loggerPrefix} Adding excludeFromStats column to libraryItem table`)
    await queryInterface.addColumn('libraryItem', 'excludeFromStats', {
      type: queryInterface.sequelize.Sequelize.DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    })
  } else {
    logger.info(`${loggerPrefix} excludeFromStats column already exists in libraryItem table`)
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This migration script removes the excludeFromStats column from the libraryItem table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>}
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  const tableDescription = await queryInterface.describeTable('libraryItem')
  if (tableDescription.excludeFromStats) {
    logger.info(`${loggerPrefix} Removing excludeFromStats column from libraryItem table`)
    await queryInterface.removeColumn('libraryItem', 'excludeFromStats')
  } else {
    logger.info(`${loggerPrefix} excludeFromStats column does not exist in libraryItem table`)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }
