'use strict'

const { DataTypes } = require('sequelize')

/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a Sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

/**
 * This migration script adds the isDownloadable column to the mediaItemShares table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
module.exports = {
  up: async ({ context: { queryInterface, logger } }) => {
    await queryInterface.addColumn('mediaItemShares', 'isDownloadable', {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    })
  },

  down: async ({ context: { queryInterface, logger } }) => {
    await queryInterface.removeColumn('mediaItemShares', 'isDownloadable')
  }
}
