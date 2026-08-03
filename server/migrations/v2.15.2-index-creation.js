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
  const bookAuthorsIndexes = await queryInterface.showIndex('bookAuthors')
  if (!hasIndex(bookAuthorsIndexes, 'bookAuthor_authorId')) {
    await addIndexIfMissing(queryInterface, 'bookAuthors', ['authorId'], 'bookAuthor_authorId', logger)
  } else {
    logger.info('[2.15.2 migration] Index bookAuthor_authorId already exists')
  }

  // Create index for bookSeries
  logger.info('[2.15.2 migration] Creating index for bookSeries')
  const bookSeriesIndexes = await queryInterface.showIndex('bookSeries')
  if (!hasIndex(bookSeriesIndexes, 'bookSeries_seriesId')) {
    await addIndexIfMissing(queryInterface, 'bookSeries', ['seriesId'], 'bookSeries_seriesId', logger)
  } else {
    logger.info('[2.15.2 migration] Index bookSeries_seriesId already exists')
  }

  // Delete existing podcastEpisode index
  logger.info('[2.15.2 migration] Deleting existing podcastEpisode index')
  await removeIndexIfExists(queryInterface, 'podcastEpisodes', 'podcast_episodes_created_at', logger)

  // Create index for podcastEpisode and createdAt
  logger.info('[2.15.2 migration] Creating index for podcastEpisode and createdAt')
  const podcastEpisodesIndexes = await queryInterface.showIndex('podcastEpisodes')
  if (!hasIndex(podcastEpisodesIndexes, 'podcastEpisode_createdAt_podcastId')) {
    await addIndexIfMissing(queryInterface, 'podcastEpisodes', ['createdAt', 'podcastId'], 'podcastEpisode_createdAt_podcastId', logger)
  } else {
    logger.info('[2.15.2 migration] Index podcastEpisode_createdAt_podcastId already exists')
  }

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
  await removeIndexIfExists(queryInterface, 'podcastEpisodes', 'podcastEpisode_createdAt_podcastId', logger)

  // Create index for podcastEpisode and createdAt
  logger.info('[2.15.2 migration] Creating original index for podcastEpisode createdAt')
  await queryInterface.addIndex('podcastEpisodes', ['createdAt'], {
    name: 'podcast_episodes_created_at'
  })

  // Finished migration
  logger.info('[2.15.2 migration] DOWNGRADE END: 2.15.2-index-creation')
}

module.exports = { up, down }

async function removeIndexIfExists(queryInterface, tableName, indexName, logger) {
  const indexes = await queryInterface.showIndex(tableName)
  const hasIndexWithName = hasIndex(indexes, indexName)

  if (!hasIndexWithName) {
    logger.info(`[2.15.2 migration] Index ${indexName} does not exist, skipping removeIndex`)
    return
  }

  await queryInterface.removeIndex(tableName, indexName)
}

function hasIndex(indexes, indexName) {
  const expected = String(indexName || '').toLowerCase()
  return indexes.some((index) => String(index?.name || index?.indexName || '').toLowerCase() === expected)
}

async function addIndexIfMissing(queryInterface, tableName, fields, indexName, logger) {
  try {
    await queryInterface.addIndex(tableName, fields, { name: indexName })
  } catch (error) {
    const alreadyExists =
      (error?.name === 'SequelizeDatabaseError' && /already exists/i.test(error?.message || '')) ||
      error?.original?.code === '42P07'
    if (!alreadyExists) throw error

    logger.info(`[2.15.2 migration] Index ${indexName} already exists`)
  }
}
