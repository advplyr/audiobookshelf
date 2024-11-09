/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

/**
 * This upward migration script changes the `mediaId` column in the `libraryItems` table to be a UUID and match other tables.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  // Upwards migration script
  logger.info('[2.16.3 migration] UPGRADE BEGIN: 2.16.3-uuid-replacement')

  // Change mediaId column to using the query interface
  logger.info('[2.16.3 migration] Changing mediaId column to UUID')
  await queryInterface.changeColumn('libraryItems', 'mediaId', {
    type: 'UUID'
  })

  // Completed migration
  logger.info('[2.16.3 migration] UPGRADE END: 2.16.3-uuid-replacement')
}

/**
 * This downward migration script changes the `mediaId` column in the `libraryItems` table to be a UUIDV4 again.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  // Downward migration script
  logger.info('[2.16.3 migration] DOWNGRADE BEGIN: 2.16.3-uuid-replacement')

  // Change mediaId column to using the query interface
  logger.info('[2.16.3 migration] Changing mediaId column to UUIDV4')
  await queryInterface.changeColumn('libraryItems', 'mediaId', {
    type: 'UUIDV4'
  })

  // Completed migration
  logger.info('[2.16.3 migration] DOWNGRADE END: 2.16.3-uuid-replacement')
}

module.exports = { up, down }
