/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a suquelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.26.0'
const migrationName = `${migrationVersion}-create-auth-tables`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This upward migration creates a sessions table and apiKeys table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  // Upwards migration script
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  // Check if table exists
  if (await queryInterface.tableExists('sessions')) {
    logger.info(`${loggerPrefix} table "sessions" already exists`)
  } else {
    // Create table
    logger.info(`${loggerPrefix} creating table "sessions"`)
    const DataTypes = queryInterface.sequelize.Sequelize.DataTypes
    await queryInterface.createTable('sessions', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      ipAddress: DataTypes.STRING,
      userAgent: DataTypes.STRING,
      refreshToken: {
        type: DataTypes.STRING,
        allowNull: false
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false
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
      }
    })
    logger.info(`${loggerPrefix} created table "sessions"`)
  }

  // Check if table exists
  if (await queryInterface.tableExists('apiKeys')) {
    logger.info(`${loggerPrefix} table "apiKeys" already exists`)
  } else {
    // Create table
    logger.info(`${loggerPrefix} creating table "apiKeys"`)
    const DataTypes = queryInterface.sequelize.Sequelize.DataTypes
    await queryInterface.createTable('apiKeys', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      description: DataTypes.TEXT,
      expiresAt: DataTypes.DATE,
      lastUsedAt: DataTypes.DATE,
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      permissions: DataTypes.JSON,
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
        onDelete: 'CASCADE'
      },
      createdByUserId: {
        type: DataTypes.UUID,
        references: {
          model: {
            tableName: 'users',
            as: 'createdByUser'
          },
          key: 'id'
        },
        onDelete: 'SET NULL'
      }
    })
    logger.info(`${loggerPrefix} created table "apiKeys"`)
  }

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This downward migration script removes the sessions table and apiKeys table.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  // Downward migration script
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  // Check if table exists
  if (await queryInterface.tableExists('sessions')) {
    logger.info(`${loggerPrefix} dropping table "sessions"`)
    // Drop table
    await queryInterface.dropTable('sessions')
    logger.info(`${loggerPrefix} dropped table "sessions"`)
  } else {
    logger.info(`${loggerPrefix} table "sessions" does not exist`)
  }

  if (await queryInterface.tableExists('apiKeys')) {
    logger.info(`${loggerPrefix} dropping table "apiKeys"`)
    await queryInterface.dropTable('apiKeys')
    logger.info(`${loggerPrefix} dropped table "apiKeys"`)
  } else {
    logger.info(`${loggerPrefix} table "apiKeys" does not exist`)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }
