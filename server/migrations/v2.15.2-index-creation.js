/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

/**
 * This upward migration script adds indexes to speed up queries on the `BookAuthor`, `BookSeries`, and `podcastEpisodes` tables.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  // Upwards migration script
  logger.info('[2.15.2 migration] UPGRADE BEGIN: 2.15.2-index-creation')

  // Create index for bookAuthors
  logger.info('[2.15.2 migration] Creating index for bookAuthors')
  await queryInterface.addIndex('bookAuthors', ['authorId'], {
    name: 'bookAuthor_authorId'
  })

  // Create index for bookSeries
  logger.info('[2.15.2 migration] Creating index for bookSeries')
  await queryInterface.addIndex('bookSeries', ['seriesId'], {
    name: 'bookSeries_seriesId'
  })

  // Delete existing podcastEpisode index
  logger.info('[2.15.2 migration] Deleting existing podcastEpisode index')
  await queryInterface.removeIndex('podcastEpisodes', 'podcast_episodes_created_at')

  // Create index for podcastEpisode and createdAt
  logger.info('[2.15.2 migration] Creating index for podcastEpisode and createdAt')
  await queryInterface.addIndex('podcastEpisodes', ['createdAt', 'podcastId'], {
    name: 'podcastEpisode_createdAt_podcastId'
  })

  // Completed migration
  logger.info('[2.15.2 migration] UPGRADE END: 2.15.2-index-creation')
}

/**
 * This downward migration script removes the newly created indexes and re-adds the old index on the `podcastEpisodes` table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  // Downward migration script
  logger.info('[2.15.2 migration] DOWNGRADE BEGIN: 2.15.2-index-creation')

  // Remove index for bookAuthors
  logger.info('[2.15.2 migration] Removing index for bookAuthors')
  await queryInterface.removeIndex('bookAuthors', 'bookAuthor_authorId')

  // Remove index for bookSeries
  logger.info('[2.15.2 migration] Removing index for bookSeries')
  await queryInterface.removeIndex('bookSeries', 'bookSeries_seriesId')

  // Delete existing podcastEpisode index
  logger.info('[2.15.2 migration] Deleting existing podcastEpisode index')
  await queryInterface.removeIndex('podcastEpisodes', 'podcastEpisode_createdAt_podcastId')

  // Create index for podcastEpisode and createdAt
  logger.info('[2.15.2 migration] Creating original index for podcastEpisode createdAt')
  await queryInterface.addIndex('podcastEpisodes', ['createdAt'], {
    name: 'podcast_episodes_created_at'
  })

  // Finished migration
  logger.info('[2.15.2 migration] DOWNGRADE END: 2.15.2-index-creation')
}

module.exports = { up, down }
