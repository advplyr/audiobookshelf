const util = require('util')

/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.19.4'
const migrationName = `${migrationVersion}-improve-podcast-queries`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This upward migration adds a numEpisodes column to the podcasts table and populates it.
 * It also adds a podcastId column to the mediaProgresses table and populates it.
 * It also copies the title and titleIgnorePrefix columns from the podcasts table to the libraryItems table,
 * and adds triggers to update them when the corresponding columns in the podcasts table are updated.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  // Upwards migration script
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  // Add numEpisodes column to podcasts table
  await addColumn(queryInterface, logger, 'podcasts', 'numEpisodes', { type: queryInterface.sequelize.Sequelize.INTEGER, allowNull: false, defaultValue: 0 })

  // Populate numEpisodes column with the number of episodes for each podcast
  await populateNumEpisodes(queryInterface, logger)

  // Add podcastId column to mediaProgresses table
  await addColumn(queryInterface, logger, 'mediaProgresses', 'podcastId', { type: queryInterface.sequelize.Sequelize.UUID, allowNull: true })

  // Populate podcastId column with the podcastId for each mediaProgress
  await populatePodcastId(queryInterface, logger)

  // Copy title and titleIgnorePrefix columns from podcasts to libraryItems
  await copyColumn(queryInterface, logger, 'podcasts', 'title', 'id', 'libraryItems', 'title', 'mediaId')
  await copyColumn(queryInterface, logger, 'podcasts', 'titleIgnorePrefix', 'id', 'libraryItems', 'titleIgnorePrefix', 'mediaId')

  // Add triggers to update title and titleIgnorePrefix in libraryItems
  await addTrigger(queryInterface, logger, 'podcasts', 'title', 'id', 'libraryItems', 'title', 'mediaId')
  await addTrigger(queryInterface, logger, 'podcasts', 'titleIgnorePrefix', 'id', 'libraryItems', 'titleIgnorePrefix', 'mediaId')

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This downward migration removes the triggers on the podcasts table,
 * the numEpisodes column from the podcasts table, and the podcastId column from the mediaProgresses table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  // Downward migration script
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  // Remove triggers from libraryItems
  await removeTrigger(queryInterface, logger, 'podcasts', 'title', 'libraryItems', 'title')
  await removeTrigger(queryInterface, logger, 'podcasts', 'titleIgnorePrefix', 'libraryItems', 'titleIgnorePrefix')

  // Remove numEpisodes column from podcasts table
  await removeColumn(queryInterface, logger, 'podcasts', 'numEpisodes')

  // Remove podcastId column from mediaProgresses table
  await removeColumn(queryInterface, logger, 'mediaProgresses', 'podcastId')

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

async function populateNumEpisodes(queryInterface, logger) {
  logger.info(`${loggerPrefix} populating numEpisodes column in podcasts table`)
  await queryInterface.sequelize.query(`
    UPDATE podcasts
    SET numEpisodes = (SELECT COUNT(*) FROM podcastEpisodes WHERE podcastEpisodes.podcastId = podcasts.id)
  `)
  logger.info(`${loggerPrefix} populated numEpisodes column in podcasts table`)
}

async function populatePodcastId(queryInterface, logger) {
  logger.info(`${loggerPrefix} populating podcastId column in mediaProgresses table`)
  // bulk update podcastId to the podcastId of the podcastEpisode if the mediaItemType is podcastEpisode
  await queryInterface.sequelize.query(`
    UPDATE mediaProgresses
    SET podcastId = (SELECT podcastId FROM podcastEpisodes WHERE podcastEpisodes.id = mediaProgresses.mediaItemId)
    WHERE mediaItemType = 'podcastEpisode'
  `)
  logger.info(`${loggerPrefix} populated podcastId column in mediaProgresses table`)
}

/**
 * Utility function to add a column to a table. If the column already exists, it logs a message and continues.
 *
 * @param {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @param {import('../Logger')} logger - a Logger object.
 * @param {string} table - the name of the table to add the column to.
 * @param {string} column - the name of the column to add.
 * @param {Object} options - the options for the column.
 */
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

/**
 * Utility function to remove a column from a table. If the column does not exist, it logs a message and continues.
 *
 * @param {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @param {import('../Logger')} logger - a Logger object.
 * @param {string} table - the name of the table to remove the column from.
 * @param {string} column - the name of the column to remove.
 */
async function removeColumn(queryInterface, logger, table, column) {
  logger.info(`${loggerPrefix} removing column "${column}" from table "${table}"`)
  const tableDescription = await queryInterface.describeTable(table)
  if (tableDescription[column]) {
    await queryInterface.sequelize.query(`ALTER TABLE ${table} DROP COLUMN ${column}`)
    logger.info(`${loggerPrefix} removed column "${column}" from table "${table}"`)
  } else {
    logger.info(`${loggerPrefix} column "${column}" does not exist in table "${table}"`)
  }
}

/**
 * Utility function to add a trigger to update a column in a target table when a column in a source table is updated.
 * If the trigger already exists, it drops it and creates a new one.
 * sourceIdColumn and targetIdColumn are used to match the source and target rows.
 *
 * @param {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @param {import('../Logger')} logger - a Logger object.
 * @param {string} sourceTable - the name of the source table.
 * @param {string} sourceColumn - the name of the column to update.
 * @param {string} sourceIdColumn - the name of the id column of the source table.
 * @param {string} targetTable - the name of the target table.
 * @param {string} targetColumn - the name of the column to update.
 * @param {string} targetIdColumn - the name of the id column of the target table.
 */
async function addTrigger(queryInterface, logger, sourceTable, sourceColumn, sourceIdColumn, targetTable, targetColumn, targetIdColumn) {
  logger.info(`${loggerPrefix} adding trigger to update ${targetTable}.${targetColumn} when ${sourceTable}.${sourceColumn} is updated`)
  const triggerName = convertToSnakeCase(`update_${targetTable}_${targetColumn}_from_${sourceTable}_${sourceColumn}`)

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

/**
 * Utility function to remove an update trigger from a table.
 *
 * @param {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @param {import('../Logger')} logger - a Logger object.
 * @param {string} sourceTable - the name of the source table.
 * @param {string} sourceColumn - the name of the column to update.
 * @param {string} targetTable - the name of the target table.
 * @param {string} targetColumn - the name of the column to update.
 */
async function removeTrigger(queryInterface, logger, sourceTable, sourceColumn, targetTable, targetColumn) {
  logger.info(`${loggerPrefix} removing trigger to update ${targetTable}.${targetColumn}`)
  const triggerName = convertToSnakeCase(`update_${targetTable}_${targetColumn}_from_${sourceTable}_${sourceColumn}`)
  await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS ${triggerName}`)
  logger.info(`${loggerPrefix} removed trigger to update ${targetTable}.${targetColumn}`)
}

/**
 * Utility function to copy a column from a source table to a target table.
 * sourceIdColumn and targetIdColumn are used to match the source and target rows.
 *
 * @param {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @param {import('../Logger')} logger - a Logger object.
 * @param {string} sourceTable - the name of the source table.
 * @param {string} sourceColumn - the name of the column to copy.
 * @param {string} sourceIdColumn - the name of the id column of the source table.
 * @param {string} targetTable - the name of the target table.
 * @param {string} targetColumn - the name of the column to copy to.
 * @param {string} targetIdColumn - the name of the id column of the target table.
 */
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
