/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.34.0'
const migrationName = `${migrationVersion}-add-series-to-playlists-collections`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This upward migration creates the collectionSeriesItems table for storing
 * series entries in collections.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('collectionSeriesItems')) {
    logger.info(`${loggerPrefix} table "collectionSeriesItems" already exists`)
  } else {
    logger.info(`${loggerPrefix} creating table "collectionSeriesItems"`)
    const DataTypes = queryInterface.sequelize.Sequelize.DataTypes
    await queryInterface.createTable('collectionSeriesItems', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      order: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      seriesId: {
        type: DataTypes.UUID,
        references: {
          model: {
            tableName: 'series'
          },
          key: 'id'
        },
        allowNull: false,
        onDelete: 'CASCADE'
      },
      collectionId: {
        type: DataTypes.UUID,
        references: {
          model: {
            tableName: 'collections'
          },
          key: 'id'
        },
        allowNull: false,
        onDelete: 'CASCADE'
      }
    })
    logger.info(`${loggerPrefix} created table "collectionSeriesItems"`)

    // Index for querying series items by collection
    await queryInterface.addIndex('collectionSeriesItems', {
      name: 'collection_series_items_collectionId',
      fields: ['collectionId']
    })
    logger.info(`${loggerPrefix} added index on collectionId`)

    // Unique constraint to prevent duplicate series in a collection
    await queryInterface.addIndex('collectionSeriesItems', {
      name: 'collection_series_items_unique',
      fields: ['collectionId', 'seriesId'],
      unique: true
    })
    logger.info(`${loggerPrefix} added unique index on (collectionId, seriesId)`)
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This downward migration script removes the collectionSeriesItems table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('collectionSeriesItems')) {
    logger.info(`${loggerPrefix} dropping table "collectionSeriesItems"`)
    await queryInterface.dropTable('collectionSeriesItems')
    logger.info(`${loggerPrefix} dropped table "collectionSeriesItems"`)
  } else {
    logger.info(`${loggerPrefix} table "collectionSeriesItems" does not exist`)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }
