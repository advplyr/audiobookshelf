/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a Sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.20.1'
const migrationName = `${migrationVersion}-add-ipaddress-to-playbacksession`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This migration script adds the ipAddress column to the playbackSessions table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('playbackSessions')) {
    const tableDescription = await queryInterface.describeTable('playbackSessions')
    if (!tableDescription.ipAddress) {
      logger.info(`${loggerPrefix} Adding ipAddress column to playbackSessions table`)
      await queryInterface.addColumn('playbackSessions', 'ipAddress', {
        type: queryInterface.sequelize.Sequelize.DataTypes.STRING,
        allowNull: true
      })
      logger.info(`${loggerPrefix} Added ipAddress column to playbackSessions table`)
    } else {
      logger.info(`${loggerPrefix} ipAddress column already exists in playbackSessions table`)
    }
  } else {
    logger.info(`${loggerPrefix} playbackSessions table does not exist`)
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This migration script removes the ipAddress column from the playbackSessions table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('playbackSessions')) {
    const tableDescription = await queryInterface.describeTable('playbackSessions')
    if (tableDescription.ipAddress) {
      logger.info(`${loggerPrefix} Removing ipAddress column from playbackSessions table`)
      await queryInterface.removeColumn('playbackSessions', 'ipAddress')
      logger.info(`${loggerPrefix} Removed ipAddress column from playbackSessions table`)
    } else {
      logger.info(`${loggerPrefix} ipAddress column does not exist in playbackSessions table`)
    }
  } else {
    logger.info(`${loggerPrefix} playbackSessions table does not exist`)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down } 