/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a Sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.33.0'
const migrationName = `${migrationVersion}-oidc-scopes-and-group-map`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This migration adds oidcIdToken column to sessions table and computes
 * authOpenIDScopes / authOpenIDGroupMap from existing OIDC config.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  // 2a: Add oidcIdToken column to sessions table
  if (await queryInterface.tableExists('sessions')) {
    const tableDescription = await queryInterface.describeTable('sessions')
    if (!tableDescription.oidcIdToken) {
      logger.info(`${loggerPrefix} Adding oidcIdToken column to sessions table`)
      await queryInterface.addColumn('sessions', 'oidcIdToken', {
        type: queryInterface.sequelize.Sequelize.DataTypes.TEXT,
        allowNull: true
      })
      logger.info(`${loggerPrefix} Added oidcIdToken column to sessions table`)
    } else {
      logger.info(`${loggerPrefix} oidcIdToken column already exists in sessions table`)
    }
  } else {
    logger.info(`${loggerPrefix} sessions table does not exist`)
  }

  // 2b: Compute authOpenIDScopes from existing config
  // NOTE: This preserves backward compatibility by appending claim names as scopes.
  // In OIDC, claim names and scope names are not always the same (e.g., a "groups" claim
  // might be included via the "openid" scope). Users may need to adjust scopes after upgrade.
  const serverSettings = await getServerSettings(queryInterface, logger)

  if (serverSettings.authOpenIDScopes === undefined) {
    let scope = 'openid profile email'
    if (serverSettings.authOpenIDGroupClaim) {
      scope += ' ' + serverSettings.authOpenIDGroupClaim
    }
    if (serverSettings.authOpenIDAdvancedPermsClaim) {
      scope += ' ' + serverSettings.authOpenIDAdvancedPermsClaim
    }
    serverSettings.authOpenIDScopes = scope.trim()
    logger.info(`${loggerPrefix} Computed authOpenIDScopes: "${serverSettings.authOpenIDScopes}"`)
  } else {
    logger.info(`${loggerPrefix} authOpenIDScopes already exists in server settings`)
  }

  if (serverSettings.authOpenIDGroupMap === undefined) {
    serverSettings.authOpenIDGroupMap = {}
    logger.info(`${loggerPrefix} Initialized authOpenIDGroupMap`)
  } else {
    logger.info(`${loggerPrefix} authOpenIDGroupMap already exists in server settings`)
  }

  await updateServerSettings(queryInterface, logger, serverSettings)

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This migration removes oidcIdToken column from sessions table and
 * removes authOpenIDScopes / authOpenIDGroupMap from server settings.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  // Remove oidcIdToken column from sessions table
  if (await queryInterface.tableExists('sessions')) {
    const tableDescription = await queryInterface.describeTable('sessions')
    if (tableDescription.oidcIdToken) {
      logger.info(`${loggerPrefix} Removing oidcIdToken column from sessions table`)
      await queryInterface.removeColumn('sessions', 'oidcIdToken')
      logger.info(`${loggerPrefix} Removed oidcIdToken column from sessions table`)
    } else {
      logger.info(`${loggerPrefix} oidcIdToken column does not exist in sessions table`)
    }
  } else {
    logger.info(`${loggerPrefix} sessions table does not exist`)
  }

  // Remove authOpenIDScopes and authOpenIDGroupMap from server settings
  const serverSettings = await getServerSettings(queryInterface, logger)
  let changed = false
  if (serverSettings.authOpenIDScopes !== undefined) {
    delete serverSettings.authOpenIDScopes
    changed = true
    logger.info(`${loggerPrefix} Removed authOpenIDScopes from server settings`)
  }
  if (serverSettings.authOpenIDGroupMap !== undefined) {
    delete serverSettings.authOpenIDGroupMap
    changed = true
    logger.info(`${loggerPrefix} Removed authOpenIDGroupMap from server settings`)
  }
  if (changed) {
    await updateServerSettings(queryInterface, logger, serverSettings)
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
