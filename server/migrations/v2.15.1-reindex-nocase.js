/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

/**
 * This upward migration script fixes old database corruptions due to the a bad sqlite extension introduced in v2.12.0.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  // Upwards migration script
  logger.info('[2.15.1 migration] UPGRADE BEGIN: 2.15.1-reindex-nocase ')

  // Run reindex nocase to fix potential corruption issues due to the bad sqlite extension introduced in v2.12.0
  logger.info('[2.15.1 migration] Reindexing NOCASE indices to fix potential hidden corruption issues')
  await queryInterface.sequelize.query('REINDEX NOCASE;')

  logger.info('[2.15.1 migration] UPGRADE END: 2.15.1-reindex-nocase ')
}

/**
 * This downward migration script is a no-op.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  // Downward migration script
  logger.info('[2.15.1 migration] DOWNGRADE BEGIN: 2.15.1-reindex-nocase ')

  // This migration is a no-op
  logger.info('[2.15.1 migration] No action required for downgrade')

  logger.info('[2.15.1 migration] DOWNGRADE END: 2.15.1-reindex-nocase ')
}

module.exports = { up, down }
