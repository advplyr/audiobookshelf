const { DataTypes } = require('sequelize')

/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

/**
 * This is an example of an upward migration script.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info('Running migration_example up...')
  logger.info('Creating example_table...')
  await queryInterface.createTable('example_table', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    }
  })
  logger.info('example_table created.')
  logger.info('migration_example up complete.')
}

/**
 * This is an example of a downward migration script.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info('Running migration_example down...')
  logger.info('Dropping example_table...')
  await queryInterface.dropTable('example_table')
  logger.info('example_table dropped.')
  logger.info('migration_example down complete.')
}

module.exports = { up, down }
