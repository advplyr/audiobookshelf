/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

/**
 * This upward migration script changes foreign key constraints for the
 * libraryItems, feeds, mediaItemShares, playbackSessions, playlistMediaItems, and mediaProgresses tables.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  // Upwards migration script
  logger.info('[2.17.3 migration] UPGRADE BEGIN: 2.17.3-fk-constraints')

  const execQuery = queryInterface.sequelize.query.bind(queryInterface.sequelize)

  // Disable foreign key constraints for the next sequence of operations
  await execQuery(`PRAGMA foreign_keys = OFF;`)

  try {
    await execQuery(`BEGIN TRANSACTION;`)

    logger.info('[2.17.3 migration] Updating libraryItems constraints')
    const libraryItemsConstraints = [
      { field: 'libraryId', onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      { field: 'libraryFolderId', onDelete: 'SET NULL', onUpdate: 'CASCADE' }
    ]
    if (await changeConstraints(queryInterface, 'libraryItems', libraryItemsConstraints)) {
      logger.info('[2.17.3 migration] Finished updating libraryItems constraints')
    } else {
      logger.info('[2.17.3 migration] No changes needed for libraryItems constraints')
    }

    logger.info('[2.17.3 migration] Updating feeds constraints')
    const feedsConstraints = [{ field: 'userId', onDelete: 'SET NULL', onUpdate: 'CASCADE' }]
    if (await changeConstraints(queryInterface, 'feeds', feedsConstraints)) {
      logger.info('[2.17.3 migration] Finished updating feeds constraints')
    } else {
      logger.info('[2.17.3 migration] No changes needed for feeds constraints')
    }

    if (await queryInterface.tableExists('mediaItemShares')) {
      logger.info('[2.17.3 migration] Updating mediaItemShares constraints')
      const mediaItemSharesConstraints = [{ field: 'userId', onDelete: 'SET NULL', onUpdate: 'CASCADE' }]
      if (await changeConstraints(queryInterface, 'mediaItemShares', mediaItemSharesConstraints)) {
        logger.info('[2.17.3 migration] Finished updating mediaItemShares constraints')
      } else {
        logger.info('[2.17.3 migration] No changes needed for mediaItemShares constraints')
      }
    } else {
      logger.info('[2.17.3 migration] mediaItemShares table does not exist, skipping column change')
    }

    logger.info('[2.17.3 migration] Updating playbackSessions constraints')
    const playbackSessionsConstraints = [
      { field: 'deviceId', onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      { field: 'libraryId', onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      { field: 'userId', onDelete: 'SET NULL', onUpdate: 'CASCADE' }
    ]
    if (await changeConstraints(queryInterface, 'playbackSessions', playbackSessionsConstraints)) {
      logger.info('[2.17.3 migration] Finished updating playbackSessions constraints')
    } else {
      logger.info('[2.17.3 migration] No changes needed for playbackSessions constraints')
    }

    logger.info('[2.17.3 migration] Updating playlistMediaItems constraints')
    const playlistMediaItemsConstraints = [{ field: 'playlistId', onDelete: 'CASCADE', onUpdate: 'CASCADE' }]
    if (await changeConstraints(queryInterface, 'playlistMediaItems', playlistMediaItemsConstraints)) {
      logger.info('[2.17.3 migration] Finished updating playlistMediaItems constraints')
    } else {
      logger.info('[2.17.3 migration] No changes needed for playlistMediaItems constraints')
    }

    logger.info('[2.17.3 migration] Updating mediaProgresses constraints')
    const mediaProgressesConstraints = [{ field: 'userId', onDelete: 'CASCADE', onUpdate: 'CASCADE' }]
    if (await changeConstraints(queryInterface, 'mediaProgresses', mediaProgressesConstraints)) {
      logger.info('[2.17.3 migration] Finished updating mediaProgresses constraints')
    } else {
      logger.info('[2.17.3 migration] No changes needed for mediaProgresses constraints')
    }

    await execQuery(`COMMIT;`)
  } catch (error) {
    logger.error(`[2.17.3 migration] Migration failed - rolling back. Error:`, error)
    await execQuery(`ROLLBACK;`)
  }

  await execQuery(`PRAGMA foreign_keys = ON;`)

  // Completed migration
  logger.info('[2.17.3 migration] UPGRADE END: 2.17.3-fk-constraints')
}

/**
 * This downward migration script is a no-op.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  // Downward migration script
  logger.info('[2.17.3 migration] DOWNGRADE BEGIN: 2.17.3-fk-constraints')

  // This migration is a no-op
  logger.info('[2.17.3 migration] No action required for downgrade')

  // Completed migration
  logger.info('[2.17.3 migration] DOWNGRADE END: 2.17.3-fk-constraints')
}

/**
 * @typedef ConstraintUpdateObj
 * @property {string} field - The field to update
 * @property {string} onDelete - The onDelete constraint
 * @property {string} onUpdate - The onUpdate constraint
 */

/**
 * @typedef SequelizeFKObj
 * @property {{ model: string, key: string }} references
 * @property {string} onDelete
 * @property {string} onUpdate
 */

/**
 * @param {Object} fk - The foreign key object from PRAGMA foreign_key_list
 * @returns {SequelizeFKObj} - The foreign key object formatted for Sequelize
 */
const formatFKsPragmaToSequelizeFK = (fk) => {
  return {
    references: {
      model: fk.table,
      key: fk.to
    },
    onDelete: fk['on_delete'],
    onUpdate: fk['on_update']
  }
}

/**
 *
 * @param {import('sequelize').QueryInterface} queryInterface
 * @param {string} tableName
 * @param {ConstraintUpdateObj[]} constraints
 * @returns {Promise<Record<string, SequelizeFKObj>|null>}
 */
async function getUpdatedForeignKeys(queryInterface, tableName, constraints) {
  const execQuery = queryInterface.sequelize.query.bind(queryInterface.sequelize)
  const quotedTableName = queryInterface.quoteIdentifier(tableName)

  const foreignKeys = await execQuery(`PRAGMA foreign_key_list(${quotedTableName});`)

  let hasUpdates = false
  const foreignKeysByColName = foreignKeys.reduce((prev, curr) => {
    const fk = formatFKsPragmaToSequelizeFK(curr)

    const constraint = constraints.find((c) => c.field === curr.from)
    if (constraint && (constraint.onDelete !== fk.onDelete || constraint.onUpdate !== fk.onUpdate)) {
      fk.onDelete = constraint.onDelete
      fk.onUpdate = constraint.onUpdate
      hasUpdates = true
    }

    return { ...prev, [curr.from]: fk }
  }, {})

  return hasUpdates ? foreignKeysByColName : null
}

/**
 * Extends the Sequelize describeTable function to include the updated foreign key constraints
 *
 * @param {import('sequelize').QueryInterface} queryInterface
 * @param {String} tableName
 * @param {Record<string, SequelizeFKObj>} updatedForeignKeys
 */
async function describeTableWithFKs(queryInterface, tableName, updatedForeignKeys) {
  const tableDescription = await queryInterface.describeTable(tableName)

  const tableDescriptionWithFks = Object.entries(tableDescription).reduce((prev, [col, attributes]) => {
    let extendedAttributes = attributes

    if (updatedForeignKeys[col]) {
      extendedAttributes = {
        ...extendedAttributes,
        ...updatedForeignKeys[col]
      }
    }
    return { ...prev, [col]: extendedAttributes }
  }, {})

  return tableDescriptionWithFks
}

/**
 * @see https://www.sqlite.org/lang_altertable.html#otheralter
 * @see https://sequelize.org/docs/v6/other-topics/query-interface/#changing-and-removing-columns-in-sqlite
 *
 * @param {import('sequelize').QueryInterface} queryInterface
 * @param {string} tableName
 * @param {ConstraintUpdateObj[]} constraints
 * @returns {Promise<boolean>} - Return false if no changes are needed, true otherwise
 */
async function changeConstraints(queryInterface, tableName, constraints) {
  const updatedForeignKeys = await getUpdatedForeignKeys(queryInterface, tableName, constraints)
  if (!updatedForeignKeys) {
    return false
  }

  const execQuery = queryInterface.sequelize.query.bind(queryInterface.sequelize)
  const quotedTableName = queryInterface.quoteIdentifier(tableName)

  const backupTableName = `${tableName}_${Math.round(Math.random() * 100)}_backup`
  const quotedBackupTableName = queryInterface.quoteIdentifier(backupTableName)

  try {
    const tableDescriptionWithFks = await describeTableWithFKs(queryInterface, tableName, updatedForeignKeys)

    const attributes = queryInterface.queryGenerator.attributesToSQL(tableDescriptionWithFks)

    // Create the backup table
    await queryInterface.createTable(backupTableName, attributes)

    const attributeNames = Object.keys(attributes)
      .map((attr) => queryInterface.quoteIdentifier(attr))
      .join(', ')

    // Copy all data from the target table to the backup table
    await execQuery(`INSERT INTO ${quotedBackupTableName} SELECT ${attributeNames} FROM ${quotedTableName};`)

    // Drop the old (original) table
    await queryInterface.dropTable(tableName)

    // Rename the backup table to the original table's name
    await queryInterface.renameTable(backupTableName, tableName)

    // Validate that all foreign key constraints are correct
    const result = await execQuery(`PRAGMA foreign_key_check(${quotedTableName});`, {
      type: queryInterface.sequelize.Sequelize.QueryTypes.SELECT
    })

    // There are foreign key violations, exit
    if (result.length) {
      return Promise.reject(`Foreign key violations detected: ${JSON.stringify(result, null, 2)}`)
    }

    return true
  } catch (error) {
    return Promise.reject(error)
  }
}

module.exports = { up, down }
