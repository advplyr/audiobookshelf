const util = require('util')
const { Sequelize, DataTypes } = require('sequelize')
const fileUtils = require('../utils/fileUtils')
const LibraryItem = require('../models/LibraryItem')

/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.30.0'
const migrationName = `${migrationVersion}-add-deviceId`
const loggerPrefix = `[${migrationVersion} migration]`

// Migration constants
const libraryItemsTableName = 'libraryItems'
const columns = [{ name: 'deviceId', spec: { type: DataTypes.STRING, allowNull: true } }]
const columnNames = columns.map((column) => column.name).join(', ')

/**
 * This upward migration adds a deviceId column to the libraryItems table and populates it.
 * It also creates an index on the ino, deviceId columns.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  const helper = new MigrationHelper(queryInterface, logger)

  // Upwards migration script
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  // Add authorNames columns to libraryItems table
  await helper.addColumns()

  // Populate authorNames columns with the author names for each libraryItem
  // TODO
  await helper.populateColumnsFromSource()

  // Create indexes on the authorNames columns
  await helper.addIndexes()

  // Add index on ino and deviceId to the podcastEpisodes table
  await helper.addIndex('libraryItems', ['ino', 'deviceId'])

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This downward migration removes a deviceId column to the libraryItems table, *
 * It also removes the index on ino and deviceId from the libraryItems table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  // Downward migration script
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  const helper = new MigrationHelper(queryInterface, logger)

  // Remove index on publishedAt from the podcastEpisodes table
  await helper.removeIndex('libraryItems', ['ino', 'deviceId'])

  // Remove indexes on the authorNames columns
  await helper.removeIndexes()

  // Remove authorNames columns from libraryItems table
  await helper.removeColumns()

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

class MigrationHelper {
  constructor(queryInterface, logger) {
    this.queryInterface = queryInterface
    this.logger = logger
  }

  async addColumn(table, column, options) {
    this.logger.info(`${loggerPrefix} adding column "${column}" to table "${table}"`)
    const tableDescription = await this.queryInterface.describeTable(table)
    if (!tableDescription[column]) {
      await this.queryInterface.addColumn(table, column, options)
      this.logger.info(`${loggerPrefix} added column "${column}" to table "${table}"`)
    } else {
      this.logger.info(`${loggerPrefix} column "${column}" already exists in table "${table}"`)
    }
  }

  async addColumns() {
    this.logger.info(`${loggerPrefix} adding ${columnNames} columns to ${libraryItemsTableName} table`)
    for (const column of columns) {
      await this.addColumn(libraryItemsTableName, column.name, column.spec)
    }
    this.logger.info(`${loggerPrefix} added ${columnNames} columns to ${libraryItemsTableName} table`)
  }

  async removeColumn(table, column) {
    this.logger.info(`${loggerPrefix} removing column "${column}" from table "${table}"`)
    const tableDescription = await this.queryInterface.describeTable(table)
    if (tableDescription[column]) {
      await this.queryInterface.sequelize.query(`ALTER TABLE ${table} DROP COLUMN ${column}`)
      this.logger.info(`${loggerPrefix} removed column "${column}" from table "${table}"`)
    } else {
      this.logger.info(`${loggerPrefix} column "${column}" does not exist in table "${table}"`)
    }
  }

  async removeColumns() {
    this.logger.info(`${loggerPrefix} removing ${columnNames} columns from ${libraryItemsTableName} table`)
    for (const column of columns) {
      await this.removeColumn(libraryItemsTableName, column.name)
    }
    this.logger.info(`${loggerPrefix} removed ${columnNames} columns from ${libraryItemsTableName} table`)
  }
  // populate from existing files on filesystem
  async populateColumnsFromSource() {
    this.logger.info(`${loggerPrefix} populating ${columnNames} columns in ${libraryItemsTableName} table`)

    // list all libraryItems
    /** @type {[[LibraryItem], any]} */
    const [libraryItems, metadata] = await this.queryInterface.sequelize.query('SELECT * FROM libraryItems')
    // load file stats for all libraryItems
    libraryItems.forEach(async (item) => {
      const deviceId = await fileUtils.getDeviceId(item.path)
      // set deviceId for each libraryItem
      await this.queryInterface.sequelize.query(
        `UPDATE :libraryItemsTableName
        SET (deviceId) = (:deviceId)
        WHERE id = :id`,
        {
          replacements: {
            libraryItemsTableName: libraryItemsTableName,
            deviceId: deviceId,
            id: item.id
          }
        }
      )
    })

    this.logger.info(`${loggerPrefix} populated ${columnNames} columns in ${libraryItems} table`)
  }

  async addIndex(tableName, columns) {
    const columnString = columns.map((column) => util.inspect(column)).join(', ')
    const indexName = convertToSnakeCase(`${tableName}_${columns.map((column) => (typeof column === 'string' ? column : column.name)).join('_')}`)
    try {
      this.logger.info(`${loggerPrefix} adding index on [${columnString}] to table ${tableName}. index name: ${indexName}"`)
      await this.queryInterface.addIndex(tableName, columns)
      this.logger.info(`${loggerPrefix} added index on [${columnString}] to table ${tableName}. index name: ${indexName}"`)
    } catch (error) {
      if (error.name === 'SequelizeDatabaseError' && error.message.includes('already exists')) {
        this.logger.info(`${loggerPrefix} index [${columnString}] for table "${tableName}" already exists`)
      } else {
        throw error
      }
    }
  }

  async addIndexes() {
    for (const column of columns) {
      await this.addIndex(libraryItemsTableName, ['libraryId', 'mediaType', { name: column.name, collate: 'NOCASE' }])
    }
  }

  async removeIndex(tableName, columns) {
    this.logger.info(`${loggerPrefix} removing index [${columns.join(', ')}] from table "${tableName}"`)
    await this.queryInterface.removeIndex(tableName, columns)
    this.logger.info(`${loggerPrefix} removed index [${columns.join(', ')}] from table "${tableName}"`)
  }

  async removeIndexes() {
    for (const column of columns) {
      await this.removeIndex(libraryItemsTableName, ['libraryId', 'mediaType', column.name])
    }
  }
}
/**
 * Utility function to convert a string to snake case, e.g. "titleIgnorePrefix" -> "title_ignore_prefix"
 *
 * @param {string} str - the string to convert to snake case.
 * @returns {string} - the string in snake case.
 */
function convertToSnakeCase(str) {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase()
}

module.exports = { up, down, migrationName }
