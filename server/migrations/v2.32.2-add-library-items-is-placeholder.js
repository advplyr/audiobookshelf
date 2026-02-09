/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a Sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.32.2'
const migrationName = `${migrationVersion}-add-library-items-is-placeholder`
const loggerPrefix = `[${migrationVersion} migration]`

const tableName = 'libraryItems'
const columnName = 'isPlaceholder'

// Note: no index added; evaluate query patterns before adding.

/**
 * This migration script adds the isPlaceholder column to the libraryItems table and backfills nulls.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists(tableName)) {
    const tableDescription = await queryInterface.describeTable(tableName)
    if (!tableDescription[columnName]) {
      logger.info(`${loggerPrefix} Adding ${columnName} column to ${tableName} table`)
      await queryInterface.addColumn(tableName, columnName, {
        type: queryInterface.sequelize.Sequelize.DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
      })
      logger.info(`${loggerPrefix} Added ${columnName} column to ${tableName} table`)
    } else {
      logger.info(`${loggerPrefix} ${columnName} column already exists in ${tableName} table`)
    }

    await backfillNullPlaceholders({ queryInterface, logger })
  } else {
    logger.info(`${loggerPrefix} ${tableName} table does not exist`)
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This migration script removes the isPlaceholder column from the libraryItems table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists(tableName)) {
    const tableDescription = await queryInterface.describeTable(tableName)
    if (tableDescription[columnName]) {
      logger.info(`${loggerPrefix} Removing ${columnName} column from ${tableName} table`)
      await queryInterface.removeColumn(tableName, columnName)
      logger.info(`${loggerPrefix} Removed ${columnName} column from ${tableName} table`)
    } else {
      logger.info(`${loggerPrefix} ${columnName} column does not exist in ${tableName} table`)
    }
  } else {
    logger.info(`${loggerPrefix} ${tableName} table does not exist`)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

async function backfillNullPlaceholders({ queryInterface, logger }) {
  logger.info(`${loggerPrefix} Backfilling NULL ${columnName} values in ${tableName}`)
  await queryInterface.sequelize.query(`
    UPDATE ${tableName}
      SET ${columnName} = 0
    WHERE ${columnName} IS NULL;
  `)
  logger.info(`${loggerPrefix} Backfilled NULL ${columnName} values in ${tableName}`)
}

module.exports = { up, down }
