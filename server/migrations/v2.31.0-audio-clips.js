const uuidv4 = require('uuid').v4

/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

/**
 * This upward migration creates the audioClips table and migrates existing bookmarks to clips.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info('[2.31.0 migration] UPGRADE BEGIN: 2.31.0-audio-clips')

  const DataTypes = queryInterface.sequelize.Sequelize.DataTypes

  // Create audioClips table
  logger.info('[2.31.0 migration] Creating audioClips table')
  await queryInterface.createTable('audioClips', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    libraryItemId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'libraryItems',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    episodeId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    startTime: {
      type: DataTypes.REAL,
      allowNull: false
    },
    endTime: {
      type: DataTypes.REAL,
      allowNull: false
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: ''
    },
    note: {
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
    }
  })

  // Create indexes
  logger.info('[2.31.0 migration] Creating indexes on audioClips table')
  await queryInterface.addIndex('audioClips', ['userId'], {
    name: 'audio_clips_user_id'
  })
  await queryInterface.addIndex('audioClips', ['libraryItemId'], {
    name: 'audio_clips_library_item_id'
  })
  await queryInterface.addIndex('audioClips', ['startTime'], {
    name: 'audio_clips_start_time'
  })
  await queryInterface.addIndex('audioClips', ['userId', 'libraryItemId'], {
    name: 'audio_clips_user_library_item'
  })

  // Migrate existing bookmarks to clips
  logger.info('[2.31.0 migration] Migrating bookmarks to clips')

  const [users] = await queryInterface.sequelize.query('SELECT id, bookmarks FROM users WHERE bookmarks IS NOT NULL AND bookmarks != "[]"')

  let totalMigrated = 0
  const now = new Date()

  for (const user of users) {
    try {
      const bookmarks = JSON.parse(user.bookmarks || '[]')

      if (!Array.isArray(bookmarks) || bookmarks.length === 0) {
        continue
      }

      logger.info(`[2.31.0 migration] Migrating ${bookmarks.length} bookmarks for user ${user.id}`)

      for (const bookmark of bookmarks) {
        if (!bookmark.libraryItemId || typeof bookmark.time !== 'number') {
          logger.warn(`[2.31.0 migration] Skipping invalid bookmark for user ${user.id}:`, bookmark)
          continue
        }

        // Create clip with 5-second default duration
        const clipId = uuidv4()
        const startTime = Number(bookmark.time)
        const endTime = startTime + 10 // Default 10-second clip
        const title = bookmark.title || 'Migrated Bookmark'
        const createdAt = bookmark.createdAt ? new Date(bookmark.createdAt) : now

        await queryInterface.sequelize.query(
          `INSERT INTO audioClips (id, userId, libraryItemId, episodeId, startTime, endTime, title, note, createdAt, updatedAt)
           VALUES (?, ?, ?, NULL, ?, ?, ?, '', ?, ?)`,
          {
            replacements: [clipId, user.id, bookmark.libraryItemId, startTime, endTime, title, createdAt, now]
          }
        )

        totalMigrated++
      }
    } catch (error) {
      logger.error(`[2.31.0 migration] Error migrating bookmarks for user ${user.id}:`, error)
    }
  }

  logger.info(`[2.31.0 migration] Successfully migrated ${totalMigrated} bookmarks to clips`)
  logger.info('[2.31.0 migration] UPGRADE END: 2.31.0-audio-clips')
}

/**
 * This downward migration removes the audioClips table.
 * Note: This does not restore bookmarks.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info('[2.31.0 migration] DOWNGRADE BEGIN: 2.31.0-audio-clips')

  // Drop indexes
  logger.info('[2.31.0 migration] Dropping indexes')
  await queryInterface.removeIndex('audioClips', 'audio_clips_user_id')
  await queryInterface.removeIndex('audioClips', 'audio_clips_library_item_id')
  await queryInterface.removeIndex('audioClips', 'audio_clips_start_time')
  await queryInterface.removeIndex('audioClips', 'audio_clips_user_library_item')

  // Drop table
  logger.info('[2.31.0 migration] Dropping audioClips table')
  await queryInterface.dropTable('audioClips')

  logger.info('[2.31.0 migration] DOWNGRADE END: 2.31.0-audio-clips')
}

module.exports = { up, down }
