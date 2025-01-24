/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.18.2'
const migrationName = `${migrationVersion}-feeds-add-reverseorder`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This migration script adds the reverseOrder column to the Feeds table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('Feeds')) {
    const tableDescription = await queryInterface.describeTable('Feeds')
    if (!tableDescription.reverseOrder) {
      logger.info(`${loggerPrefix} Adding reverseOrder column to Feeds table`)
      await queryInterface.addColumn('Feeds', 'reverseOrder', {
        type: queryInterface.sequelize.Sequelize.DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
      })
      logger.info(`${loggerPrefix} Added reverseOrder column to Feeds table`)
    } else {
      logger.info(`${loggerPrefix} reverseOrder column already exists in Feeds table`)
    }
  } else {
    logger.info(`${loggerPrefix} Feeds table does not exist`)
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This migration script removes the reverseOrder column from the Feeds table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('Feeds')) {
    const tableDescription = await queryInterface.describeTable('Feeds')
    if (tableDescription.reverseOrder) {
      logger.info(`${loggerPrefix} Removing reverseOrder column from Feeds table`)
      await queryInterface.removeColumn('Feeds', 'reverseOrder')
      logger.info(`${loggerPrefix} Removed reverseOrder column from Feeds table`)
    } else {
      logger.info(`${loggerPrefix} reverseOrder column does not exist in Feeds table`)
    }
  } else {
    logger.info(`${loggerPrefix} Feeds table does not exist`)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }
