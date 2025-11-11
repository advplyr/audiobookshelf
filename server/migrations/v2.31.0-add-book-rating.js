/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a Sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.31.0'
const migrationName = `${migrationVersion}-add-book-rating`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This migration script adds the rating column to the books table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('books')) {
    const tableDescription = await queryInterface.describeTable('books')
    if (!tableDescription.rating) {
      logger.info(`${loggerPrefix} Adding rating column to books table`)
      await queryInterface.addColumn('books', 'rating', {
        type: queryInterface.sequelize.Sequelize.DataTypes.FLOAT,
        allowNull: true
      })
      logger.info(`${loggerPrefix} Added rating column to books table`)
    } else {
      logger.info(`${loggerPrefix} rating column already exists in books table`)
    }
  } else {
    logger.info(`${loggerPrefix} books table does not exist`)
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This migration script removes the rating column from the books table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('books')) {
    const tableDescription = await queryInterface.describeTable('books')
    if (tableDescription.rating) {
      logger.info(`${loggerPrefix} Removing rating column from books table`)
      await queryInterface.removeColumn('books', 'rating')
      logger.info(`${loggerPrefix} Removed rating column from books table`)
    } else {
      logger.info(`${loggerPrefix} rating column does not exist in books table`)
    }
  } else {
    logger.info(`${loggerPrefix} books table does not exist`)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }

