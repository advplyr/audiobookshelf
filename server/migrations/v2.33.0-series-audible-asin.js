/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a Sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.33.0'
const migrationName = `${migrationVersion}-series-audible-asin`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This migration adds the audibleSeriesAsin column to the Series table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  // Check if Series table exists
  let tableDescription
  try {
    tableDescription = await queryInterface.describeTable('Series')
  } catch (error) {
    logger.info(`${loggerPrefix} Series table does not exist. Migration not needed.`)
    return
  }

  // Add audibleSeriesAsin column if it doesn't exist
  if (!tableDescription.audibleSeriesAsin) {
    logger.info(`${loggerPrefix} Adding audibleSeriesAsin column to Series table`)
    await queryInterface.addColumn('Series', 'audibleSeriesAsin', {
      type: 'STRING',
      allowNull: true
    })
  } else {
    logger.info(`${loggerPrefix} audibleSeriesAsin column already exists`)
  }

  // Add index for audibleSeriesAsin lookups (optional, for future metadata provider use)
  const indexes = await queryInterface.showIndex('Series')
  const indexExists = indexes.some((index) => index.name === 'series_audible_asin_index')

  if (!indexExists) {
    logger.info(`${loggerPrefix} Adding index on audibleSeriesAsin column`)
    try {
      await queryInterface.addIndex('Series', {
        fields: ['audibleSeriesAsin'],
        name: 'series_audible_asin_index'
      })
    } catch (error) {
      logger.error(`${loggerPrefix} Failed to add index: ${error.message}`)
      // Non-fatal - column still added successfully
    }
  } else {
    logger.info(`${loggerPrefix} Index on audibleSeriesAsin already exists`)
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This migration removes the audibleSeriesAsin column from the Series table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  // Check if Series table exists
  let tableDescription
  try {
    tableDescription = await queryInterface.describeTable('Series')
  } catch (error) {
    logger.info(`${loggerPrefix} Series table does not exist. Downgrade not needed.`)
    return
  }

  // Remove index first
  const indexes = await queryInterface.showIndex('Series')
  const indexExists = indexes.some((index) => index.name === 'series_audible_asin_index')

  if (indexExists) {
    logger.info(`${loggerPrefix} Removing index on audibleSeriesAsin column`)
    try {
      await queryInterface.removeIndex('Series', 'series_audible_asin_index')
    } catch (error) {
      logger.error(`${loggerPrefix} Failed to remove index: ${error.message}`)
    }
  }

  // Remove column if it exists
  if (tableDescription.audibleSeriesAsin) {
    logger.info(`${loggerPrefix} Removing audibleSeriesAsin column from Series table`)
    await queryInterface.removeColumn('Series', 'audibleSeriesAsin')
  } else {
    logger.info(`${loggerPrefix} audibleSeriesAsin column does not exist`)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }
