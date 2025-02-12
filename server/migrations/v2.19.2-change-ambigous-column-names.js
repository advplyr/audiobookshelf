const util = require('util')

/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.19.2'
const migrationName = `${migrationVersion}-change-ambigous-column-names`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This upward migration changes the ambiguous column names in libraryItems added in v2.19.1
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  // Upwards migration script
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  // Remove ambiguous columns added in v2.19.1 (including triggers and indexes)
  await removeIndex(queryInterface, logger, 'libraryItems', ['libraryId', 'mediaType', 'title'])
  await removeTrigger(queryInterface, logger, 'libraryItems', 'title')
  await removeColumn(queryInterface, logger, 'libraryItems', 'title')

  await removeIndex(queryInterface, logger, 'libraryItems', ['libraryId', 'mediaType', 'titleIgnorePrefix'])
  await removeTrigger(queryInterface, logger, 'libraryItems', 'titleIgnorePrefix')
  await removeColumn(queryInterface, logger, 'libraryItems', 'titleIgnorePrefix')

  // Add new columns with unambiguous names (including triggers and indexes)
  await addColumn(queryInterface, logger, 'libraryItems', 'titleCopy', { type: queryInterface.sequelize.Sequelize.STRING, allowNull: true })
  await copyColumn(queryInterface, logger, 'books', 'title', 'id', 'libraryItems', 'titleCopy', 'mediaId')
  await addTrigger(queryInterface, logger, 'books', 'title', 'id', 'libraryItems', 'titleCopy', 'mediaId')
  await addIndex(queryInterface, logger, 'libraryItems', ['libraryId', 'mediaType', { name: 'titleCopy', collate: 'NOCASE' }])

  await addColumn(queryInterface, logger, 'libraryItems', 'titleIgnorePrefixCopy', { type: queryInterface.sequelize.Sequelize.STRING, allowNull: true })
  await copyColumn(queryInterface, logger, 'books', 'titleIgnorePrefix', 'id', 'libraryItems', 'titleIgnorePrefixCopy', 'mediaId')
  await addTrigger(queryInterface, logger, 'books', 'titleIgnorePrefix', 'id', 'libraryItems', 'titleIgnorePrefixCopy', 'mediaId')
  await addIndex(queryInterface, logger, 'libraryItems', ['libraryId', 'mediaType', { name: 'titleIgnorePrefixCopy', collate: 'NOCASE' }])

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This downward migration script removes the titleCopy and titleIgnorePrefixCopy columns from the libraryItems table,
 * and restores the title and titleIgnorePrefix columns, including associated triggers and indexes.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  // Downward migration script
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  // Remove v2.19.2 new columns (including triggers and indexes)
  await removeIndex(queryInterface, logger, 'libraryItems', ['libraryId', 'mediaType', 'titleIgnorePrefixCopy'])
  await removeTrigger(queryInterface, logger, 'libraryItems', 'titleIgnorePrefixCopy')
  await removeColumn(queryInterface, logger, 'libraryItems', 'titleIgnorePrefixCopy')

  await removeIndex(queryInterface, logger, 'libraryItems', ['libraryId', 'mediaType', 'titleCopy'])
  await removeTrigger(queryInterface, logger, 'libraryItems', 'titleCopy')
  await removeColumn(queryInterface, logger, 'libraryItems', 'titleCopy')

  // Restore v2.19.1 columns (including triggers and indexes)
  await addColumn(queryInterface, logger, 'libraryItems', 'title', { type: queryInterface.sequelize.Sequelize.STRING, allowNull: true })
  await copyColumn(queryInterface, logger, 'books', 'title', 'id', 'libraryItems', 'title', 'mediaId')
  await addTrigger(queryInterface, logger, 'books', 'title', 'id', 'libraryItems', 'title', 'mediaId')
  await addIndex(queryInterface, logger, 'libraryItems', ['libraryId', 'mediaType', { name: 'title', collate: 'NOCASE' }])

  await addColumn(queryInterface, logger, 'libraryItems', 'titleIgnorePrefix', { type: queryInterface.sequelize.Sequelize.STRING, allowNull: true })
  await copyColumn(queryInterface, logger, 'books', 'titleIgnorePrefix', 'id', 'libraryItems', 'titleIgnorePrefix', 'mediaId')
  await addTrigger(queryInterface, logger, 'books', 'titleIgnorePrefix', 'id', 'libraryItems', 'titleIgnorePrefix', 'mediaId')
  await addIndex(queryInterface, logger, 'libraryItems', ['libraryId', 'mediaType', { name: 'titleIgnorePrefix', collate: 'NOCASE' }])

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

/**
 * Utility function to add an index to a table. If the index already z`exists, it logs a message and continues.
 *
 * @param {import('sequelize').QueryInterface} queryInterface
 * @param {import ('../Logger')} logger
 * @param {string} tableName
 * @param {string[]} columns
 */
async function addIndex(queryInterface, logger, tableName, columns) {
  const columnString = columns.map((column) => util.inspect(column)).join(', ')
  const indexName = convertToSnakeCase(`${tableName}_${columns.map((column) => (typeof column === 'string' ? column : column.name)).join('_')}`)
  try {
    logger.info(`${loggerPrefix} adding index on [${columnString}] to table ${tableName}. index name: ${indexName}"`)
    await queryInterface.addIndex(tableName, columns)
    logger.info(`${loggerPrefix} added index on [${columnString}] to table ${tableName}. index name: ${indexName}"`)
  } catch (error) {
    if (error.name === 'SequelizeDatabaseError' && error.message.includes('already exists')) {
      logger.info(`${loggerPrefix} index [${columnString}] for table "${tableName}" already exists`)
    } else {
      throw error
    }
  }
}

/**
 * Utility function to remove an index from a table.
 * Sequelize implemets it using DROP INDEX IF EXISTS, so it won't throw an error if the index doesn't exist.
 *
 * @param {import('sequelize').QueryInterface} queryInterface
 * @param {import ('../Logger')} logger
 * @param {string} tableName
 * @param {string[]} columns
 */
async function removeIndex(queryInterface, logger, tableName, columns) {
  logger.info(`${loggerPrefix} removing index [${columns.join(', ')}] from table "${tableName}"`)
  await queryInterface.removeIndex(tableName, columns)
  logger.info(`${loggerPrefix} removed index [${columns.join(', ')}] from table "${tableName}"`)
}

async function addColumn(queryInterface, logger, table, column, options) {
  logger.info(`${loggerPrefix} adding column "${column}" to table "${table}"`)
  const tableDescription = await queryInterface.describeTable(table)
  if (!tableDescription[column]) {
    await queryInterface.addColumn(table, column, options)
    logger.info(`${loggerPrefix} added column "${column}" to table "${table}"`)
  } else {
    logger.info(`${loggerPrefix} column "${column}" already exists in table "${table}"`)
  }
}

async function removeColumn(queryInterface, logger, table, column) {
  logger.info(`${loggerPrefix} removing column "${column}" from table "${table}"`)
  await queryInterface.removeColumn(table, column)
  logger.info(`${loggerPrefix} removed column "${column}" from table "${table}"`)
}

async function copyColumn(queryInterface, logger, sourceTable, sourceColumn, sourceIdColumn, targetTable, targetColumn, targetIdColumn) {
  logger.info(`${loggerPrefix} copying column "${sourceColumn}" from table "${sourceTable}" to table "${targetTable}"`)
  await queryInterface.sequelize.query(`
    UPDATE ${targetTable}
    SET ${targetColumn} = ${sourceTable}.${sourceColumn}
    FROM ${sourceTable}
    WHERE ${targetTable}.${targetIdColumn} = ${sourceTable}.${sourceIdColumn}
  `)
  logger.info(`${loggerPrefix} copied column "${sourceColumn}" from table "${sourceTable}" to table "${targetTable}"`)
}

async function addTrigger(queryInterface, logger, sourceTable, sourceColumn, sourceIdColumn, targetTable, targetColumn, targetIdColumn) {
  logger.info(`${loggerPrefix} adding trigger to update ${targetTable}.${targetColumn} when ${sourceTable}.${sourceColumn} is updated`)
  const triggerName = convertToSnakeCase(`update_${targetTable}_${targetColumn}`)

  await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS ${triggerName}`)

  await queryInterface.sequelize.query(`
    CREATE TRIGGER ${triggerName}
      AFTER UPDATE OF ${sourceColumn} ON ${sourceTable}
      FOR EACH ROW
      BEGIN
        UPDATE ${targetTable}
          SET ${targetColumn} = NEW.${sourceColumn}
        WHERE ${targetTable}.${targetIdColumn} = NEW.${sourceIdColumn};
      END;
  `)
  logger.info(`${loggerPrefix} added trigger to update ${targetTable}.${targetColumn} when ${sourceTable}.${sourceColumn} is updated`)
}

async function removeTrigger(queryInterface, logger, targetTable, targetColumn) {
  logger.info(`${loggerPrefix} removing trigger to update ${targetTable}.${targetColumn}`)
  const triggerName = convertToSnakeCase(`update_${targetTable}_${targetColumn}`)
  await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS ${triggerName}`)
  logger.info(`${loggerPrefix} removed trigger to update ${targetTable}.${targetColumn}`)
}

function convertToSnakeCase(str) {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase()
}

module.exports = { up, down }
