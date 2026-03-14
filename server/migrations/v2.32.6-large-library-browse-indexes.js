/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.32.6'
const migrationName = `${migrationVersion}-large-library-browse-indexes`
const loggerPrefix = `[${migrationVersion} migration]`

const indexesToCreate = [
  {
    tableName: 'libraryItems',
    indexName: 'library_items_library_media_type_title_id',
    getFields(dialect) {
      return ['libraryId', 'mediaType', dialect === 'sqlite' ? { name: 'title', collate: 'NOCASE' } : 'title', 'id']
    }
  },
  {
    tableName: 'libraryItems',
    indexName: 'library_items_library_media_type_title_ignore_prefix_id',
    getFields(dialect) {
      return ['libraryId', 'mediaType', dialect === 'sqlite' ? { name: 'titleIgnorePrefix', collate: 'NOCASE' } : 'titleIgnorePrefix', 'id']
    }
  },
  {
    tableName: 'libraryItems',
    indexName: 'library_items_library_media_type_created_at_id',
    getFields() {
      return ['libraryId', 'mediaType', 'createdAt', 'id']
    }
  },
  {
    tableName: 'mediaProgresses',
    indexName: 'media_progress_user_updated_at_id',
    getFields() {
      return ['userId', 'updatedAt', 'id']
    }
  }
]

async function tableExists(queryInterface, dialect, tableName) {
  try {
    const query =
      dialect === 'sqlite'
        ? `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`
        : `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${tableName}'`
    const result = await queryInterface.sequelize.query(query, { type: queryInterface.sequelize.QueryTypes.SELECT })
    return result.length > 0
  } catch {
    return false
  }
}

async function safeCreateIndex(queryInterface, logger, dialect, tableName, indexName, fields) {
  try {
    if (!(await tableExists(queryInterface, dialect, tableName))) {
      logger.info(`${loggerPrefix} Table ${tableName} does not exist, skipping index ${indexName}`)
      return
    }

    await queryInterface.addIndex(tableName, fields, { name: indexName })
    logger.info(`${loggerPrefix} Created index ${indexName} on ${tableName}`)
  } catch (error) {
    if (error.message?.includes('already exists') || error.name === 'SequelizeUniqueConstraintError') {
      logger.info(`${loggerPrefix} Index ${indexName} already exists, skipping`)
      return
    }

    if (error.message?.includes('no such table') || error.message?.includes('does not exist')) {
      logger.info(`${loggerPrefix} Table ${tableName} does not exist, skipping index ${indexName}`)
      return
    }

    throw error
  }
}

async function safeRemoveIndex(queryInterface, logger, tableName, indexName) {
  try {
    await queryInterface.removeIndex(tableName, indexName)
    logger.info(`${loggerPrefix} Removed index ${indexName} from ${tableName}`)
  } catch {
    logger.info(`${loggerPrefix} Index ${indexName} does not exist or could not be removed`)
  }
}

/**
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>}
 */
async function up({ context: { queryInterface } }) {
  const logger = require('../Logger')
  const dialect = queryInterface.sequelize.getDialect()
  logger.info(`${loggerPrefix} Running migration for dialect: ${dialect}`)

  const booksExist = await tableExists(queryInterface, dialect, 'books')
  if (!booksExist) {
    logger.info(`${loggerPrefix} Core tables do not exist yet (fresh database), skipping migration`)
    return
  }

  for (const index of indexesToCreate) {
    await safeCreateIndex(queryInterface, logger, dialect, index.tableName, index.indexName, index.getFields(dialect))
  }

  logger.info(`${loggerPrefix} Migration completed successfully`)
}

/**
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>}
 */
async function down({ context: { queryInterface } }) {
  const logger = require('../Logger')
  logger.info(`${loggerPrefix} Running downgrade migration...`)

  for (const index of indexesToCreate) {
    await safeRemoveIndex(queryInterface, logger, index.tableName, index.indexName)
  }

  logger.info(`${loggerPrefix} Downgrade migration completed`)
}

module.exports = {
  up,
  down,
  name: migrationName
}
