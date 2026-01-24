/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a Sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.33.0'
const migrationName = `${migrationVersion}-add-last-refresh-token`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This migration script adds lastRefreshToken and lastRefreshTokenExpiresAt columns to the sessions table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('sessions')) {
    const tableDescription = await queryInterface.describeTable('sessions')

    if (!tableDescription.lastRefreshToken) {
      logger.info(`${loggerPrefix} Adding lastRefreshToken column to sessions table`)
      await queryInterface.addColumn('sessions', 'lastRefreshToken', {
        type: queryInterface.sequelize.Sequelize.DataTypes.STRING,
        allowNull: true
      })
    } else {
      logger.info(`${loggerPrefix} lastRefreshToken column already exists in sessions table`)
    }

    if (!tableDescription.lastRefreshTokenExpiresAt) {
      logger.info(`${loggerPrefix} Adding lastRefreshTokenExpiresAt column to sessions table`)
      await queryInterface.addColumn('sessions', 'lastRefreshTokenExpiresAt', {
        type: queryInterface.sequelize.Sequelize.DataTypes.DATE,
        allowNull: true
      })
    } else {
      logger.info(`${loggerPrefix} lastRefreshTokenExpiresAt column already exists in sessions table`)
    }
  } else {
    logger.info(`${loggerPrefix} sessions table does not exist`)
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This migration script removes the lastRefreshToken and lastRefreshTokenExpiresAt columns from the sessions table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('sessions')) {
    const tableDescription = await queryInterface.describeTable('sessions')

    if (tableDescription.lastRefreshToken) {
      logger.info(`${loggerPrefix} Removing lastRefreshToken column from sessions table`)
      await queryInterface.removeColumn('sessions', 'lastRefreshToken')
    } else {
      logger.info(`${loggerPrefix} lastRefreshToken column does not exist in sessions table`)
    }

    if (tableDescription.lastRefreshTokenExpiresAt) {
      logger.info(`${loggerPrefix} Removing lastRefreshTokenExpiresAt column from sessions table`)
      await queryInterface.removeColumn('sessions', 'lastRefreshTokenExpiresAt')
    } else {
      logger.info(`${loggerPrefix} lastRefreshTokenExpiresAt column does not exist in sessions table`)
    }
  } else {
    logger.info(`${loggerPrefix} sessions table does not exist`)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }
