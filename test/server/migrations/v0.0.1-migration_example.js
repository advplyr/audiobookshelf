const { DataTypes } = require('sequelize')
const Logger = require('../../../server/Logger')

/**
 * This is an example of an upward migration script.
 *
 * @param {import { QueryInterface } from "sequelize";} options.context.queryInterface - a suquelize QueryInterface object.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: queryInterface }) {
  Logger.info('Running migration_example up...')
  Logger.info('Creating example_table...')
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
  Logger.info('example_table created.')
  Logger.info('migration_example up complete.')
}

/**
 * This is an example of a downward migration script.
 *
 * @param {import { QueryInterface } from "sequelize";} options.context.queryInterface - a suquelize QueryInterface object.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: queryInterface }) {
  Logger.info('Running migration_example down...')
  Logger.info('Dropping example_table...')
  await queryInterface.dropTable('example_table')
  Logger.info('example_table dropped.')
  Logger.info('migration_example down complete.')
}

module.exports = { up, down }
