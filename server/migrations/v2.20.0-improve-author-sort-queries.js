const util = require('util')
const { Sequelize } = require('sequelize')

/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.20.0'
const migrationName = `${migrationVersion}-improve-author-sort-queries`
const loggerPrefix = `[${migrationVersion} migration]`

// Migration constants
const libraryItems = 'libraryItems'
const bookAuthors = 'bookAuthors'
const authors = 'authors'
const podcastEpisodes = 'podcastEpisodes'
const columns = [
  { name: 'authorNamesFirstLast', source: `${authors}.name`, spec: { type: Sequelize.STRING, allowNull: true } },
  { name: 'authorNamesLastFirst', source: `${authors}.lastFirst`, spec: { type: Sequelize.STRING, allowNull: true } }
]
const authorsSort = `${bookAuthors}.createdAt ASC`
const columnNames = columns.map((column) => column.name).join(', ')
const columnSourcesExpression = columns.map((column) => `GROUP_CONCAT(${column.source}, ', ' ORDER BY ${authorsSort})`).join(', ')
const authorsJoin = `${authors} JOIN ${bookAuthors} ON ${authors}.id = ${bookAuthors}.authorId`

/**
 * This upward migration adds an authorNames column to the libraryItems table and populates it.
 * It also creates triggers to update the authorNames column when the corresponding bookAuthors and authors records are updated.
 * It also creates an index on the authorNames column.
 *
 * It also adds an index on publishedAt to the podcastEpisodes table.
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
  await helper.populateColumnsFromSource()

  // Create triggers to update the authorNames column when the corresponding bookAuthors and authors records are updated
  await helper.addTriggers()

  // Create indexes on the authorNames columns
  await helper.addIndexes()

  // Add index on publishedAt to the podcastEpisodes table
  await helper.addIndex(podcastEpisodes, ['publishedAt'])

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This downward migration removes the authorNames column from the libraryItems table,
 * the triggers on the bookAuthors and authors tables, and the index on the authorNames column.
 *
 * It also removes the index on publishedAt from the podcastEpisodes table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  // Downward migration script
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  const helper = new MigrationHelper(queryInterface, logger)

  // Remove triggers to update authorNames columns
  await helper.removeTriggers()

  // Remove index on publishedAt from the podcastEpisodes table
  await helper.removeIndex(podcastEpisodes, ['publishedAt'])

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
    this.logger.info(`${loggerPrefix} adding ${columnNames} columns to ${libraryItems} table`)
    for (const column of columns) {
      await this.addColumn(libraryItems, column.name, column.spec)
    }
    this.logger.info(`${loggerPrefix} added ${columnNames} columns to ${libraryItems} table`)
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
    this.logger.info(`${loggerPrefix} removing ${columnNames} columns from ${libraryItems} table`)
    for (const column of columns) {
      await this.removeColumn(libraryItems, column.name)
    }
    this.logger.info(`${loggerPrefix} removed ${columnNames} columns from ${libraryItems} table`)
  }

  async populateColumnsFromSource() {
    this.logger.info(`${loggerPrefix} populating ${columnNames} columns in ${libraryItems} table`)
    const authorNamesSubQuery = `
      SELECT ${columnSourcesExpression}
      FROM ${authorsJoin}
      WHERE ${bookAuthors}.bookId = ${libraryItems}.mediaId
    `
    await this.queryInterface.sequelize.query(`
      UPDATE ${libraryItems}
        SET (${columnNames}) = (${authorNamesSubQuery})
      WHERE mediaType = 'book';
    `)
    this.logger.info(`${loggerPrefix} populated ${columnNames} columns in ${libraryItems} table`)
  }

  async addBookAuthorsTrigger(action) {
    this.logger.info(`${loggerPrefix} adding trigger to update ${libraryItems} ${columnNames} on ${bookAuthors} ${action}`)
    const modifiedRecord = action === 'delete' ? 'OLD' : 'NEW'
    const triggerName = convertToSnakeCase(`update_${libraryItems}_authorNames_on_${bookAuthors}_${action}`)
    const authorNamesSubQuery = `
      SELECT ${columnSourcesExpression}
      FROM ${authorsJoin}
      WHERE ${bookAuthors}.bookId = ${modifiedRecord}.bookId
    `
    await this.queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS ${triggerName}`)

    await this.queryInterface.sequelize.query(`
      CREATE TRIGGER ${triggerName}
        AFTER ${action} ON ${bookAuthors}
        FOR EACH ROW
        BEGIN
          UPDATE ${libraryItems}
            SET (${columnNames}) = (${authorNamesSubQuery})
          WHERE mediaId = ${modifiedRecord}.bookId;
        END;
    `)
    this.logger.info(`${loggerPrefix} added trigger to update ${libraryItems} ${columnNames} on ${bookAuthors} ${action}`)
  }

  async addAuthorsUpdateTrigger() {
    this.logger.info(`${loggerPrefix} adding trigger to update ${libraryItems} ${columnNames} on ${authors} update`)
    const triggerName = convertToSnakeCase(`update_${libraryItems}_authorNames_on_authors_update`)
    const authorNamesSubQuery = `
      SELECT ${columnSourcesExpression}
      FROM ${authorsJoin}
      WHERE ${bookAuthors}.bookId = ${libraryItems}.mediaId
    `

    await this.queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS ${triggerName}`)

    await this.queryInterface.sequelize.query(`
      CREATE TRIGGER ${triggerName}
        AFTER UPDATE OF name ON ${authors}
        FOR EACH ROW
        BEGIN
          UPDATE ${libraryItems}
            SET (${columnNames}) = (${authorNamesSubQuery})
          WHERE mediaId IN (SELECT bookId FROM ${bookAuthors} WHERE authorId = NEW.id);
      END;
  `)
    this.logger.info(`${loggerPrefix} added trigger to update ${libraryItems} ${columnNames} on ${authors} update`)
  }

  async addTriggers() {
    await this.addBookAuthorsTrigger('insert')
    await this.addBookAuthorsTrigger('delete')
    await this.addAuthorsUpdateTrigger()
  }

  async removeBookAuthorsTrigger(action) {
    this.logger.info(`${loggerPrefix} removing trigger to update ${libraryItems} ${columnNames} on ${bookAuthors} ${action}`)
    const triggerName = convertToSnakeCase(`update_${libraryItems}_authorNames_on_${bookAuthors}_${action}`)
    await this.queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS ${triggerName}`)
    this.logger.info(`${loggerPrefix} removed trigger to update ${libraryItems} ${columnNames} on ${bookAuthors} ${action}`)
  }

  async removeAuthorsUpdateTrigger() {
    this.logger.info(`${loggerPrefix} removing trigger to update ${libraryItems} ${columnNames} on ${authors} update`)
    const triggerName = convertToSnakeCase(`update_${libraryItems}_authorNames_on_authors_update`)
    await this.queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS ${triggerName}`)
    this.logger.info(`${loggerPrefix} removed trigger to update ${libraryItems} ${columnNames} on ${authors} update`)
  }

  async removeTriggers() {
    await this.removeBookAuthorsTrigger('insert')
    await this.removeBookAuthorsTrigger('delete')
    await this.removeAuthorsUpdateTrigger()
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
      await this.addIndex(libraryItems, ['libraryId', 'mediaType', { name: column.name, collate: 'NOCASE' }])
    }
  }

  async removeIndex(tableName, columns) {
    this.logger.info(`${loggerPrefix} removing index [${columns.join(', ')}] from table "${tableName}"`)
    await this.queryInterface.removeIndex(tableName, columns)
    this.logger.info(`${loggerPrefix} removed index [${columns.join(', ')}] from table "${tableName}"`)
  }

  async removeIndexes() {
    for (const column of columns) {
      await this.removeIndex(libraryItems, ['libraryId', 'mediaType', column.name])
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

module.exports = { up, down }
