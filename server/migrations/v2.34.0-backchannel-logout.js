/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a Sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.34.0'
const migrationName = `${migrationVersion}-backchannel-logout`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This migration adds oidcSessionId column to sessions table and
 * authOpenIDBackchannelLogoutEnabled to server settings.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  // Add oidcSessionId column to sessions table
  if (await queryInterface.tableExists('sessions')) {
    const tableDescription = await queryInterface.describeTable('sessions')
    if (!tableDescription.oidcSessionId) {
      logger.info(`${loggerPrefix} Adding oidcSessionId column to sessions table`)
      await queryInterface.addColumn('sessions', 'oidcSessionId', {
        type: queryInterface.sequelize.Sequelize.DataTypes.STRING,
        allowNull: true
      })
      logger.info(`${loggerPrefix} Added oidcSessionId column to sessions table`)
      // Add index for backchannel logout lookups by oidcSessionId
      await queryInterface.addIndex('sessions', ['oidcSessionId'], {
        name: 'sessions_oidc_session_id'
      })
      logger.info(`${loggerPrefix} Added index on oidcSessionId column`)
    } else {
      logger.info(`${loggerPrefix} oidcSessionId column already exists in sessions table`)
    }
  } else {
    logger.info(`${loggerPrefix} sessions table does not exist`)
  }

  // Initialize authOpenIDBackchannelLogoutEnabled in server settings
  const serverSettings = await getServerSettings(queryInterface, logger)

  if (serverSettings.authOpenIDBackchannelLogoutEnabled === undefined) {
    serverSettings.authOpenIDBackchannelLogoutEnabled = false
    logger.info(`${loggerPrefix} Initialized authOpenIDBackchannelLogoutEnabled to false`)
  } else {
    logger.info(`${loggerPrefix} authOpenIDBackchannelLogoutEnabled already exists in server settings`)
  }

  await updateServerSettings(queryInterface, logger, serverSettings)

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This migration removes oidcSessionId column from sessions table and
 * removes authOpenIDBackchannelLogoutEnabled from server settings.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  // Remove oidcSessionId column from sessions table
  if (await queryInterface.tableExists('sessions')) {
    const tableDescription = await queryInterface.describeTable('sessions')
    if (tableDescription.oidcSessionId) {
      logger.info(`${loggerPrefix} Removing oidcSessionId index and column from sessions table`)
      try {
        await queryInterface.removeIndex('sessions', 'sessions_oidc_session_id')
      } catch {
        logger.info(`${loggerPrefix} Index sessions_oidc_session_id did not exist`)
      }
      await queryInterface.removeColumn('sessions', 'oidcSessionId')
      logger.info(`${loggerPrefix} Removed oidcSessionId column from sessions table`)
    } else {
      logger.info(`${loggerPrefix} oidcSessionId column does not exist in sessions table`)
    }
  } else {
    logger.info(`${loggerPrefix} sessions table does not exist`)
  }

  // Remove authOpenIDBackchannelLogoutEnabled from server settings
  const serverSettings = await getServerSettings(queryInterface, logger)
  if (serverSettings.authOpenIDBackchannelLogoutEnabled !== undefined) {
    delete serverSettings.authOpenIDBackchannelLogoutEnabled
    await updateServerSettings(queryInterface, logger, serverSettings)
    logger.info(`${loggerPrefix} Removed authOpenIDBackchannelLogoutEnabled from server settings`)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

async function getServerSettings(queryInterface, logger) {
  const result = await queryInterface.sequelize.query('SELECT value FROM settings WHERE key = "server-settings";')
  if (!result[0].length) {
    logger.error(`${loggerPrefix} Server settings not found`)
    throw new Error('Server settings not found')
  }

  let serverSettings = null
  try {
    serverSettings = JSON.parse(result[0][0].value)
  } catch (error) {
    logger.error(`${loggerPrefix} Error parsing server settings:`, error)
    throw error
  }

  return serverSettings
}

async function updateServerSettings(queryInterface, logger, serverSettings) {
  await queryInterface.sequelize.query('UPDATE settings SET value = :value WHERE key = "server-settings";', {
    replacements: {
      value: JSON.stringify(serverSettings)
    }
  })
}

module.exports = { up, down }
