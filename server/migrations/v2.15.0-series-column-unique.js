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
  logger.info('[2.15.0 migration] UPGRADE BEGIN: 2.15.0-series-column-unique ')

  // Run reindex nocase to fix potential corruption issues due to the bad sqlite extension introduced in v2.12.0
  logger.info('[2.15.0 migration] Reindexing NOCASE indices to fix potential hidden corruption issues')
  await queryInterface.sequelize.query('REINDEX NOCASE;')

  // Check if the unique index already exists
  const seriesIndexes = await queryInterface.showIndex('Series')
  if (seriesIndexes.some((index) => index.name === 'unique_series_name_per_library')) {
    logger.info('[2.15.0 migration] Unique index on Series.name and Series.libraryId already exists')
    logger.info('[2.15.0 migration] UPGRADE END: 2.15.0-series-column-unique ')
    return
  }

  // The steps taken to deduplicate the series are as follows:
  // 1. Find all duplicate series in the `Series` table.
  // 2. Iterate over the duplicate series and find all book IDs that are associated with the duplicate series in `bookSeries` table.
  //    2.a For each book ID, check if the ID occurs multiple times for the duplicate series.
  //    2.b If so, keep only one of the rows that has this bookId and seriesId.
  // 3. Update `bookSeries` table to point to the most recent series.
  // 4. Delete the older series.

  // Use the queryInterface to get the series table and find duplicates in the `name` and `libraryId` column
  const [duplicates] = await queryInterface.sequelize.query(`
    SELECT name, libraryId
    FROM Series
    GROUP BY name, libraryId
    HAVING COUNT(name) > 1
  `)

  // Print out how many duplicates were found
  logger.info(`[2.15.0 migration] Found ${duplicates.length} duplicate series`)

  // Iterate over each duplicate series
  for (const duplicate of duplicates) {
    // Report the series name that is being deleted
    logger.info(`[2.15.0 migration] Deduplicating series "${duplicate.name}" in library ${duplicate.libraryId}`)

    // Determine any duplicate book IDs in the `bookSeries` table for the same series
    const [duplicateBookIds] = await queryInterface.sequelize.query(
      `
        SELECT bookId
        FROM BookSeries
        WHERE seriesId IN (
          SELECT id
          FROM Series
          WHERE name = :name AND libraryId = :libraryId
        )
        GROUP BY bookId
        HAVING COUNT(bookId) > 1
        `,
      {
        replacements: {
          name: duplicate.name,
          libraryId: duplicate.libraryId
        }
      }
    )

    // Iterate over the duplicate book IDs if there is at least one and only keep the first row that has this bookId and seriesId
    for (const { bookId } of duplicateBookIds) {
      logger.info(`[2.15.0 migration] Deduplicating bookId ${bookId} in series "${duplicate.name}" of library ${duplicate.libraryId}`)
      // Get all rows of `BookSeries` table that have the same `bookId` and `seriesId`. Sort by `sequence` with nulls sorted last
      const [duplicateBookSeries] = await queryInterface.sequelize.query(
        `
            SELECT id
            FROM BookSeries
            WHERE bookId = :bookId
            AND seriesId IN (
              SELECT id
              FROM Series
              WHERE name = :name AND libraryId = :libraryId
            )
            ORDER BY sequence NULLS LAST
            `,
        {
          replacements: {
            bookId,
            name: duplicate.name,
            libraryId: duplicate.libraryId
          }
        }
      )

      // remove the first element from the array
      duplicateBookSeries.shift()

      // Delete the remaining duplicate rows
      if (duplicateBookSeries.length > 0) {
        const [deletedBookSeries] = await queryInterface.sequelize.query(
          `
              DELETE FROM BookSeries
              WHERE id IN (:ids)
              `,
          {
            replacements: {
              ids: duplicateBookSeries.map((row) => row.id)
            }
          }
        )
      }
      logger.info(`[2.15.0 migration] Finished cleanup of bookId ${bookId} in series "${duplicate.name}" of library ${duplicate.libraryId}`)
    }

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

  logger.info(`[2.15.0 migration] Deduplication complete`)

  // Create a unique index based on the name and library ID for the `Series` table
  await queryInterface.addIndex('Series', ['name', 'libraryId'], {
    unique: true,
    name: 'unique_series_name_per_library'
  })
  logger.info('[2.15.0 migration] Added unique index on Series.name and Series.libraryId')

  logger.info('[2.15.0 migration] UPGRADE END: 2.15.0-series-column-unique ')
}

/**
 * This removes the unique index on the `Series` table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  // Downward migration script
  logger.info('[2.15.0 migration] DOWNGRADE BEGIN: 2.15.0-series-column-unique ')

  // Remove the unique index
  await queryInterface.removeIndex('Series', 'unique_series_name_per_library')
  logger.info('[2.15.0 migration] Removed unique index on Series.name and Series.libraryId')

  logger.info('[2.15.0 migration] DOWNGRADE END: 2.15.0-series-column-unique ')
}

module.exports = { up, down }
