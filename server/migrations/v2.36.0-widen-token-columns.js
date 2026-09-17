/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a Sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.36.0'
const migrationName = `${migrationVersion}-widen-token-columns`
const loggerPrefix = `[${migrationVersion} migration]`

const COLUMNS = {
  sessions: ['refreshtoken', 'lastrefreshtoken', 'useragent'],
  users: ['token']
}

/**
 * Widens the session/user token and user-agent columns to TEXT.
 * Only postgres enforces varchar(255); sqlite ignores column lengths and
 * sequelize's changeColumn rebuilds sqlite tables, so skip non-postgres.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  if (queryInterface.sequelize.getDialect() !== 'postgres') {
    logger.info(`${loggerPrefix} Skipping ${migrationName} on non-postgres dialect`)
    logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
    return
  }

  for (const [table, columns] of Object.entries(COLUMNS)) {
    if (!(await queryInterface.tableExists(table))) {
      logger.info(`${loggerPrefix} table "${table}" does not exist`)
      continue
    }
    const tableDescription = await queryInterface.describeTable(table)
    const actualColumns = Object.keys(tableDescription)

    for (const column of columns) {
      // Postgres folds unquoted identifiers to lowercase, so match case-insensitively
      const actual = actualColumns.find((c) => c.toLowerCase() === column)
      if (!actual) {
        logger.info(`${loggerPrefix} column "${column}" does not exist on "${table}"`)
        continue
      }
      if (String(tableDescription[actual].type).toUpperCase().includes('TEXT')) {
        logger.info(`${loggerPrefix} column "${table}.${actual}" is already TEXT`)
        continue
      }
      logger.info(`${loggerPrefix} widening "${table}.${actual}" to TEXT`)
      await queryInterface.changeColumn(table, actual, {
        type: queryInterface.sequelize.Sequelize.DataTypes.TEXT
      })
    }
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * Reverts the widened columns back to STRING. Restores only on postgres.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  if (queryInterface.sequelize.getDialect() !== 'postgres') {
    logger.info(`${loggerPrefix} Skipping ${migrationName} on non-postgres dialect`)
    logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
    return
  }

  for (const [table, columns] of Object.entries(COLUMNS)) {
    if (!(await queryInterface.tableExists(table))) {
      logger.info(`${loggerPrefix} table "${table}" does not exist`)
      continue
    }
    const tableDescription = await queryInterface.describeTable(table)
    const actualColumns = Object.keys(tableDescription)

    for (const column of columns) {
      const actual = actualColumns.find((c) => c.toLowerCase() === column)
      if (!actual) {
        logger.info(`${loggerPrefix} column "${column}" does not exist on "${table}"`)
        continue
      }
      logger.info(`${loggerPrefix} reverting "${table}.${actual}" to STRING`)
      await queryInterface.changeColumn(table, actual, {
        type: queryInterface.sequelize.Sequelize.DataTypes.STRING
      })
    }
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }
