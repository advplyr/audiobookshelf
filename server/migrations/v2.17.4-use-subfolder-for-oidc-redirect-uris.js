/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

/**
 * This upward migration adds an subfolder setting for OIDC redirect URIs.
 * It updates existing OIDC setups to set this option to None (empty subfolder), so they continue to work as before.
 * IF OIDC is not enabled, no action is taken (i.e. the subfolder is left undefined),
 * so that future OIDC setups will use the default subfolder.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  // Upwards migration script
  logger.info('[2.17.4 migration] UPGRADE BEGIN: 2.17.4-use-subfolder-for-oidc-redirect-uris')

  const serverSettings = await getServerSettings(queryInterface, logger)
  if (serverSettings.authActiveAuthMethods?.includes('openid')) {
    logger.info('[2.17.4 migration] OIDC is enabled, adding authOpenIDSubfolderForRedirectURLs to server settings')
    serverSettings.authOpenIDSubfolderForRedirectURLs = ''
    await updateServerSettings(queryInterface, logger, serverSettings)
  } else {
    logger.info('[2.17.4 migration] OIDC is not enabled, no action required')
  }

  logger.info('[2.17.4 migration] UPGRADE END: 2.17.4-use-subfolder-for-oidc-redirect-uris')
}

/**
 * This downward migration script removes the subfolder setting for OIDC redirect URIs.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  // Downward migration script
  logger.info('[2.17.4 migration] DOWNGRADE BEGIN: 2.17.4-use-subfolder-for-oidc-redirect-uris ')

  // Remove the OIDC subfolder option from the server settings
  const serverSettings = await getServerSettings(queryInterface, logger)
  if (serverSettings.authOpenIDSubfolderForRedirectURLs !== undefined) {
    logger.info('[2.17.4 migration] Removing authOpenIDSubfolderForRedirectURLs from server settings')
    delete serverSettings.authOpenIDSubfolderForRedirectURLs
    await updateServerSettings(queryInterface, logger, serverSettings)
  } else {
    logger.info('[2.17.4 migration] authOpenIDSubfolderForRedirectURLs not found in server settings, no action required')
  }

  logger.info('[2.17.4 migration] DOWNGRADE END: 2.17.4-use-subfolder-for-oidc-redirect-uris ')
}

async function getServerSettings(queryInterface, logger) {
  const result = await queryInterface.sequelize.query('SELECT value FROM settings WHERE key = "server-settings";')
  if (!result[0].length) {
    logger.error('[2.17.4 migration] Server settings not found')
    throw new Error('Server settings not found')
  }

  let serverSettings = null
  try {
    serverSettings = JSON.parse(result[0][0].value)
  } catch (error) {
    logger.error('[2.17.4 migration] Error parsing server settings:', error)
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
