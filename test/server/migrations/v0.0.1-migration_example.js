const { DataTypes } = require('sequelize')

/**
 * This is an example of an upward migration script.
 *
 * @param {import { QueryInterface } from "sequelize";} options.context.queryInterface - a suquelize QueryInterface object.
 * @param {import { Logger } from "../../../server/Logger";} options.context.logger - a Logger object.
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
 * @param {import { QueryInterface } from "sequelize";} options.context.queryInterface - a suquelize QueryInterface object.
 * @param {import { Logger } from "../../../server/Logger";} options.context.logger - a Logger object.
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
