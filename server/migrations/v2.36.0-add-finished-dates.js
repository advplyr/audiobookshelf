/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.36.0'
const migrationName = `${migrationVersion}-add-finished-dates`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This upward migration adds a finishedDates JSON column to the mediaProgresses table
 * and populates it from the existing finishedAt value so that every finish event is kept
 * as history (re-listens/re-reads append to this array).
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  // Upwards migration script
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  const tableDescription = await queryInterface.describeTable('mediaProgresses')
  if (!tableDescription.finishedDates) {
    logger.info(`${loggerPrefix} adding column "finishedDates" to table "mediaProgresses"`)
    await queryInterface.addColumn('mediaProgresses', 'finishedDates', { type: queryInterface.sequelize.Sequelize.JSON, allowNull: true })
    logger.info(`${loggerPrefix} added column "finishedDates" to table "mediaProgresses"`)
  } else {
    logger.info(`${loggerPrefix} column "finishedDates" already exists in table "mediaProgresses"`)
  }

  await populateFinishedDates(queryInterface, logger)

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This downward migration removes the finishedDates column from the mediaProgresses table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  // Downward migration script
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  const tableDescription = await queryInterface.describeTable('mediaProgresses')
  if (tableDescription.finishedDates) {
    logger.info(`${loggerPrefix} removing column "finishedDates" from table "mediaProgresses"`)
    await queryInterface.removeColumn('mediaProgresses', 'finishedDates')
    logger.info(`${loggerPrefix} removed column "finishedDates" from table "mediaProgresses"`)
  } else {
    logger.info(`${loggerPrefix} column "finishedDates" does not exist in table "mediaProgresses"`)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

/**
 * Populates the finishedDates column with a single-element array containing the existing
 * finishedAt timestamp (in milliseconds since epoch) for rows that are missing it.
 * Idempotent: only touches rows where finishedDates is still null.
 *
 * @param {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @param {import('../Logger')} logger - a Logger object.
 */
async function populateFinishedDates(queryInterface, logger) {
  const [rows] = await queryInterface.sequelize.query(`SELECT id, finishedAt FROM mediaProgresses WHERE finishedAt IS NOT NULL AND finishedDates IS NULL`)
  logger.info(`${loggerPrefix} populating finishedDates column for ${rows.length} rows in mediaProgresses table`)

  await queryInterface.sequelize.transaction(async (transaction) => {
    for (const row of rows) {
      const finishedAtMs = new Date(row.finishedAt).valueOf()
      if (isNaN(finishedAtMs)) {
        logger.error(`${loggerPrefix} invalid finishedAt value "${row.finishedAt}" for mediaProgress ${row.id}, skipping`)
        continue
      }
      await queryInterface.sequelize.query(`UPDATE mediaProgresses SET finishedDates = :finishedDates WHERE id = :id`, {
        replacements: { finishedDates: JSON.stringify([finishedAtMs]), id: row.id },
        transaction
      })
    }
  })

  logger.info(`${loggerPrefix} populated finishedDates column in mediaProgresses table`)
}

module.exports = { up, down }
