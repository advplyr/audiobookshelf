/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.31.1'
const migrationName = `${migrationVersion}-update-metadata-json-with-id`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This upward migration creates a sessions table and apiKeys table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { logger } }) {
  // Upwards migration script
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)
  // Re-save all metadata json files, the id field will be added
  const libraryItems = await Database.libraryItemModel.findAll()
  for (const libraryItem of libraryItems) {
    await libraryItem.saveMetadataFile()
  }
  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This downward migration script removes the sessions table and apiKeys table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { logger } }) {
  // Downward migration script
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)
  // Re-save all metadata json files, the id field will be removed
  const libraryItems = await Database.libraryItemModel.findAll()
  for (const libraryItem of libraryItems) {
    await libraryItem.saveMetadataFile()
  }
  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }
