const Logger = require('../Logger')

/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

/**
 * This upward migration script cleans any duplicate series in the `Series` table and
 * adds a unique index on the `name` and `libraryId` columns.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  // Upwards migration script
  logger.info('UPGRADE BEGIN: 2.13.5-series-column-unique ')

  // Use the queryInterface to get the series table and find duplicates in the `name` column
  const [duplicates] = await queryInterface.sequelize.query(`
    SELECT name, libraryId, MAX(updatedAt) AS latestUpdatedAt, COUNT(name) AS count
    FROM Series
    GROUP BY name, libraryId
    HAVING COUNT(name) > 1
  `)

  // Print out how many duplicates were found
  logger.info(`[2.13.5 migration] Found ${duplicates.length} duplicate series`)

  // Iterate over each duplicate series
  for (const duplicate of duplicates) {
    // Report the series name that is being deleted
    logger.info(`[2.13.5 migration] Deduplicating series "${duplicate.name}" in library ${duplicate.libraryId}`)

    // Get all the most recent series which matches the `name` and `libraryId`
    const [mostRecentSeries] = await queryInterface.sequelize.query(
      `
        SELECT id
        FROM Series
        WHERE name = :name AND libraryId = :libraryId
        ORDER BY updatedAt DESC
        LIMIT 1
        `,
      {
        replacements: {
          name: duplicate.name,
          libraryId: duplicate.libraryId
        },
        type: queryInterface.sequelize.QueryTypes.SELECT
      }
    )

    if (mostRecentSeries) {
      // Update all BookSeries records for this series to point to the most recent series
      const [seriesUpdated] = await queryInterface.sequelize.query(
        `
          UPDATE BookSeries
          SET seriesId = :mostRecentSeriesId
          WHERE seriesId IN (
            SELECT id
            FROM Series
            WHERE name = :name AND libraryId = :libraryId
            AND id != :mostRecentSeriesId
          )
          `,
        {
          replacements: {
            name: duplicate.name,
            libraryId: duplicate.libraryId,
            mostRecentSeriesId: mostRecentSeries.id
          }
        }
      )

      // Delete the older series
      const seriesDeleted = await queryInterface.sequelize.query(
        `
          DELETE FROM Series
          WHERE name = :name AND libraryId = :libraryId
          AND id != :mostRecentSeriesId
          `,
        {
          replacements: {
            name: duplicate.name,
            libraryId: duplicate.libraryId,
            mostRecentSeriesId: mostRecentSeries.id
          }
        }
      )
    }
  }

  logger.info(`[2.13.5 migration] Deduplication complete`)

  // Create a unique index based on the name and library ID for the `Series` table
  await queryInterface.addIndex('Series', ['name', 'libraryId'], {
    unique: true,
    name: 'unique_series_name_per_library'
  })
  logger.info('Added unique index on Series.name and Series.libraryId')

  logger.info('UPGRADE END: 2.13.5-series-column-unique ')
}

/**
 * This removes the unique index on the `Series` table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  // Downward migration script
  logger.info('DOWNGRADE BEGIN: 2.13.5-series-column-unique ')

  // Remove the unique index
  await queryInterface.removeIndex('Series', 'unique_series_name_per_library')
  logger.info('Removed unique index on Series.name and Series.libraryId')

  logger.info('DOWNGRADE END: 2.13.5-series-column-unique ')
}

module.exports = { up, down }
