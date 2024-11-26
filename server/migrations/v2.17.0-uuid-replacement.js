/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

/**
 * This upward migration script changes table columns with data type UUIDv4 to UUID to match associated models.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  // Upwards migration script
  logger.info('[2.17.0 migration] UPGRADE BEGIN: 2.17.0-uuid-replacement')

  logger.info('[2.17.0 migration] Changing libraryItems.mediaId column to UUID')
  await queryInterface.changeColumn('libraryItems', 'mediaId', {
    type: 'UUID'
  })

  logger.info('[2.17.0 migration] Changing feeds.entityId column to UUID')
  await queryInterface.changeColumn('feeds', 'entityId', {
    type: 'UUID'
  })

  if (await queryInterface.tableExists('mediaItemShares')) {
    logger.info('[2.17.0 migration] Changing mediaItemShares.mediaItemId column to UUID')
    await queryInterface.changeColumn('mediaItemShares', 'mediaItemId', {
      type: 'UUID'
    })
  } else {
    logger.info('[2.17.0 migration] mediaItemShares table does not exist, skipping column change')
  }

  logger.info('[2.17.0 migration] Changing playbackSessions.mediaItemId column to UUID')
  await queryInterface.changeColumn('playbackSessions', 'mediaItemId', {
    type: 'UUID'
  })

  logger.info('[2.17.0 migration] Changing playlistMediaItems.mediaItemId column to UUID')
  await queryInterface.changeColumn('playlistMediaItems', 'mediaItemId', {
    type: 'UUID'
  })

  logger.info('[2.17.0 migration] Changing mediaProgresses.mediaItemId column to UUID')
  await queryInterface.changeColumn('mediaProgresses', 'mediaItemId', {
    type: 'UUID'
  })

  // Completed migration
  logger.info('[2.17.0 migration] UPGRADE END: 2.17.0-uuid-replacement')
}

/**
 * This downward migration script changes table columns data type back to UUIDv4.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  // Downward migration script
  logger.info('[2.17.0 migration] DOWNGRADE BEGIN: 2.17.0-uuid-replacement')

  logger.info('[2.17.0 migration] Changing libraryItems.mediaId column to UUIDV4')
  await queryInterface.changeColumn('libraryItems', 'mediaId', {
    type: 'UUIDV4'
  })

  logger.info('[2.17.0 migration] Changing feeds.entityId column to UUIDV4')
  await queryInterface.changeColumn('feeds', 'entityId', {
    type: 'UUIDV4'
  })

  logger.info('[2.17.0 migration] Changing mediaItemShares.mediaItemId column to UUIDV4')
  await queryInterface.changeColumn('mediaItemShares', 'mediaItemId', {
    type: 'UUIDV4'
  })

  logger.info('[2.17.0 migration] Changing playbackSessions.mediaItemId column to UUIDV4')
  await queryInterface.changeColumn('playbackSessions', 'mediaItemId', {
    type: 'UUIDV4'
  })

  logger.info('[2.17.0 migration] Changing playlistMediaItems.mediaItemId column to UUIDV4')
  await queryInterface.changeColumn('playlistMediaItems', 'mediaItemId', {
    type: 'UUIDV4'
  })

  logger.info('[2.17.0 migration] Changing mediaProgresses.mediaItemId column to UUIDV4')
  await queryInterface.changeColumn('mediaProgresses', 'mediaItemId', {
    type: 'UUIDV4'
  })

  // Completed migration
  logger.info('[2.17.0 migration] DOWNGRADE END: 2.17.0-uuid-replacement')
}

module.exports = { up, down }
