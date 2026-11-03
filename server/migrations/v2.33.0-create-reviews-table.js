/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.33.0'
const migrationName = `${migrationVersion}-create-reviews-table`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This upward migration creates a reviews table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  // Upwards migration script
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  // Check if table exists
  if (await queryInterface.tableExists('reviews')) {
    logger.info(`${loggerPrefix} table "reviews" already exists`)
  } else {
    // Create table
    logger.info(`${loggerPrefix} creating table "reviews"`)
    const DataTypes = queryInterface.sequelize.Sequelize.DataTypes
    await queryInterface.createTable('reviews', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      rating: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      reviewText: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      userId: {
        type: DataTypes.UUID,
        references: {
          model: {
            tableName: 'users'
          },
          key: 'id'
        },
        allowNull: false,
        onDelete: 'CASCADE'
      },
      libraryItemId: {
        type: DataTypes.UUID,
        references: {
          model: {
            tableName: 'libraryItems'
          },
          key: 'id'
        },
        allowNull: false,
        onDelete: 'CASCADE'
      }
    })

    // Add unique constraint on (userId, libraryItemId)
    await queryInterface.addIndex('reviews', ['userId', 'libraryItemId'], {
      unique: true,
      name: 'reviews_user_id_library_item_id_unique'
    })

    logger.info(`${loggerPrefix} created table "reviews"`)
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This downward migration script removes the reviews table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  // Downward migration script
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('reviews')) {
    logger.info(`${loggerPrefix} dropping table "reviews"`)
    await queryInterface.dropTable('reviews')
    logger.info(`${loggerPrefix} dropped table "reviews"`)
  } else {
    logger.info(`${loggerPrefix} table "reviews" does not exist`)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }
