/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.34.0'
const migrationName = `${migrationVersion}-create-user-series-follows`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This upward migration creates the userSeriesFollows table for tracking
 * which users follow which series.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('userSeriesFollows')) {
    logger.info(`${loggerPrefix} table "userSeriesFollows" already exists`)
  } else {
    logger.info(`${loggerPrefix} creating table "userSeriesFollows"`)
    const DataTypes = queryInterface.sequelize.Sequelize.DataTypes
    await queryInterface.createTable('userSeriesFollows', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      createdAt: {
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
      }
    })
    logger.info(`${loggerPrefix} created table "userSeriesFollows"`)

    // Index for "get all series a user follows" (most frequent query)
    await queryInterface.addIndex('userSeriesFollows', {
      name: 'user_series_follows_userId',
      fields: ['userId']
    })
    logger.info(`${loggerPrefix} added index on userId`)

    // Unique constraint to prevent duplicate follows
    await queryInterface.addIndex('userSeriesFollows', {
      name: 'user_series_follows_unique',
      fields: ['userId', 'seriesId'],
      unique: true
    })
    logger.info(`${loggerPrefix} added unique index on (userId, seriesId)`)

    // Index for "find all followers of series X" (for notifications)
    await queryInterface.addIndex('userSeriesFollows', {
      name: 'user_series_follows_seriesId',
      fields: ['seriesId']
    })
    logger.info(`${loggerPrefix} added index on seriesId`)
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This downward migration script removes the userSeriesFollows table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  if (await queryInterface.tableExists('userSeriesFollows')) {
    logger.info(`${loggerPrefix} dropping table "userSeriesFollows"`)
    await queryInterface.dropTable('userSeriesFollows')
    logger.info(`${loggerPrefix} dropped table "userSeriesFollows"`)
  } else {
    logger.info(`${loggerPrefix} table "userSeriesFollows" does not exist`)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }
