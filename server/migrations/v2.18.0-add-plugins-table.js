/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.18.0'
const migrationName = `${migrationVersion}-add-plugins-table`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This upward migration creates the plugins table if it does not exist.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  // Upwards migration script
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  if (!(await queryInterface.tableExists('plugins'))) {
    const DataTypes = queryInterface.sequelize.Sequelize.DataTypes
    await queryInterface.createTable('plugins', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      name: DataTypes.STRING,
      version: DataTypes.STRING,
      isMissing: DataTypes.BOOLEAN,
      config: DataTypes.JSON,
      extraData: DataTypes.JSON,
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    })
    logger.info(`${loggerPrefix} Table 'plugins' created`)
  } else {
    logger.info(`${loggerPrefix} Table 'plugins' already exists`)
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This downward migration script drops the plugins table if it exists.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  // Downward migration script
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('plugins')) {
    await queryInterface.dropTable('plugins')
    logger.info(`${loggerPrefix} Table 'plugins' dropped`)
  } else {
    logger.info(`${loggerPrefix} Table 'plugins' does not exist`)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }
