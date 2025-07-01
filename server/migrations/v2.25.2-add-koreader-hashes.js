const { DataTypes } = require('sequelize')

/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.21.0'
const migrationName = `${migrationVersion}-add-koreader-hashes`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This migration adds MD5 hash fields to the books table for KOReader sync support
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  // Add MD5 hash columns for KOReader sync
  await queryInterface.addColumn('books', 'md5FileHash', {
    type: DataTypes.STRING,
    allowNull: true
  })

  await queryInterface.addColumn('books', 'md5FilenameHash', {
    type: DataTypes.STRING,
    allowNull: true
  })

  // Add indexes for efficient lookup by hash
  await queryInterface.addIndex('books', ['md5FileHash'], {
    name: 'books_md5_file_hash_index'
  })

  await queryInterface.addIndex('books', ['md5FilenameHash'], {
    name: 'books_md5_filename_hash_index'
  })

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This migration removes MD5 hash fields from the books table
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  // Remove indexes
  await queryInterface.removeIndex('books', 'books_md5_file_hash_index')
  await queryInterface.removeIndex('books', 'books_md5_filename_hash_index')

  // Remove columns
  await queryInterface.removeColumn('books', 'md5FileHash')
  await queryInterface.removeColumn('books', 'md5FilenameHash')

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }
