/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface
 * @property {import('../Logger')} logger
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context
 */

const migrationVersion = '2.33.2'
const migrationName = `${migrationVersion}-setup-audible`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * Creates audibleAccounts and audibleBooks tables if they don't exist,
 * adds missing columns to existing tables, and ensures all indexes exist.
 *
 * @param {MigrationOptions} options
 * @returns {Promise<void>}
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  const DataTypes = queryInterface.sequelize.Sequelize.DataTypes

  // Safe index creation — silently ignores "already exists" errors
  const addIndexSafe = async (table, fields, options = {}) => {
    try {
      await queryInterface.addIndex(table, fields, options)
    } catch (err) {
      logger.info(`${loggerPrefix} index on ${table}(${fields.join(',')}) already exists, skipping`)
    }
  }

  // audibleAccounts table
  const accountsDesc = await queryInterface.describeTable('audibleAccounts').catch(() => null)
  if (!accountsDesc) {
    logger.info(`${loggerPrefix} creating table "audibleAccounts"`)
    await queryInterface.createTable('audibleAccounts', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      email: { type: DataTypes.STRING, allowNull: false },
      region: { type: DataTypes.STRING, allowNull: false, defaultValue: 'us' },
      encryptedToken: { type: DataTypes.TEXT, allowNull: false },
      encryptedCookies: { type: DataTypes.TEXT, allowNull: true },
      libraryId: { type: DataTypes.UUID, allowNull: true },
      shelfPosition: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      lastSync: { type: DataTypes.DATE },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
      userId: { type: DataTypes.UUID, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' }
    })
    logger.info(`${loggerPrefix} created table "audibleAccounts"`)
  } else {
    if (!accountsDesc.encryptedCookies) {
      logger.info(`${loggerPrefix} adding column "encryptedCookies" to "audibleAccounts"`)
      await queryInterface.addColumn('audibleAccounts', 'encryptedCookies', { type: DataTypes.TEXT, allowNull: true })
    }
    if (!accountsDesc.libraryId) {
      logger.info(`${loggerPrefix} adding column "libraryId" to "audibleAccounts"`)
      await queryInterface.addColumn('audibleAccounts', 'libraryId', { type: DataTypes.TEXT, allowNull: true })
    }
    if (!accountsDesc.shelfPosition) {
      logger.info(`${loggerPrefix} adding column "shelfPosition" to "audibleAccounts"`)
      await queryInterface.addColumn('audibleAccounts', 'shelfPosition', { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 })
    }
  }

  // Indexes on audibleAccounts (applied to both new and existing tables)
  await addIndexSafe('audibleAccounts', ['userId'])
  await addIndexSafe('audibleAccounts', ['email', 'userId'], { unique: true, name: 'audibleAccounts_email_userId_unique' })

  // audibleBooks table
  const booksDesc = await queryInterface.describeTable('audibleBooks').catch(() => null)
  if (!booksDesc) {
    logger.info(`${loggerPrefix} creating table "audibleBooks"`)
    await queryInterface.createTable('audibleBooks', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      asin: { type: DataTypes.STRING, allowNull: false },
      title: { type: DataTypes.STRING, allowNull: false },
      subtitle: { type: DataTypes.STRING },
      authors: { type: DataTypes.JSON, defaultValue: [] },
      narrators: { type: DataTypes.JSON, defaultValue: [] },
      seriesName: { type: DataTypes.STRING },
      seriesPosition: { type: DataTypes.STRING },
      releaseDate: { type: DataTypes.STRING },
      coverUrl: { type: DataTypes.TEXT },
      publisherName: { type: DataTypes.STRING },
      summary: { type: DataTypes.TEXT },
      runtimeLengthMin: { type: DataTypes.INTEGER },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'available' },
      lastChecked: { type: DataTypes.DATE },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
      audibleAccountId: { type: DataTypes.UUID, references: { model: 'audibleAccounts', key: 'id' }, onDelete: 'CASCADE' }
    })
    logger.info(`${loggerPrefix} created table "audibleBooks"`)
  } else {
    logger.info(`${loggerPrefix} table "audibleBooks" already exists`)
  }

  // Indexes on audibleBooks (applied to both new and existing tables)
  await addIndexSafe('audibleBooks', ['audibleAccountId'])
  await addIndexSafe('audibleBooks', ['asin', 'audibleAccountId'], { unique: true, name: 'audibleBooks_asin_accountId_unique' })

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * @param {MigrationOptions} options
 * @returns {Promise<void>}
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  const booksDesc = await queryInterface.describeTable('audibleBooks').catch(() => null)
  if (booksDesc) {
    await queryInterface.dropTable('audibleBooks')
    logger.info(`${loggerPrefix} dropped table "audibleBooks"`)
  }

  const accountsDesc = await queryInterface.describeTable('audibleAccounts').catch(() => null)
  if (accountsDesc) {
    await queryInterface.dropTable('audibleAccounts')
    logger.info(`${loggerPrefix} dropped table "audibleAccounts"`)
  }

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }
