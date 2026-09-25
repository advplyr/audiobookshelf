const { DataTypes, Model } = require('sequelize')
const Logger = require('../Logger')

/**
 * @typedef AudioClipObject
 * @property {UUIDV4} id
 * @property {UUIDV4} userId
 * @property {UUIDV4} libraryItemId
 * @property {UUIDV4} [episodeId]
 * @property {number} startTime
 * @property {number} endTime
 * @property {string} title
 * @property {string} [note]
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */

class AudioClip extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {UUIDV4} */
    this.id
    /** @type {UUIDV4} */
    this.userId
    /** @type {UUIDV4} */
    this.libraryItemId
    /** @type {UUIDV4} */
    this.episodeId
    /** @type {number} */
    this.startTime
    /** @type {number} */
    this.endTime
    /** @type {string} */
    this.title
    /** @type {string} */
    this.note
    /** @type {Date} */
    this.createdAt
    /** @type {Date} */
    this.updatedAt
  }

  /**
   * Initialize model
   * @param {import('../Database').sequelize} sequelize
   */
  static init(sequelize) {
    super.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        userId: {
          type: DataTypes.UUID,
          allowNull: false
        },
        libraryItemId: {
          type: DataTypes.UUID,
          allowNull: false
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
        }
      },
      {
        sequelize,
        modelName: 'audioClip',
        indexes: [
          {
            name: 'audio_clips_user_id',
            fields: ['userId']
          },
          {
            name: 'audio_clips_library_item_id',
            fields: ['libraryItemId']
          },
          {
            name: 'audio_clips_start_time',
            fields: ['startTime']
          },
          {
            name: 'audio_clips_user_library_item',
            fields: ['userId', 'libraryItemId']
          }
        ]
      }
    )

    const { user, libraryItem } = sequelize.models

    user.hasMany(AudioClip, {
      foreignKey: 'userId',
      onDelete: 'CASCADE'
    })
    AudioClip.belongsTo(user, {
      foreignKey: 'userId'
    })

    libraryItem.hasMany(AudioClip, {
      foreignKey: 'libraryItemId',
      onDelete: 'CASCADE'
    })
    AudioClip.belongsTo(libraryItem, {
      foreignKey: 'libraryItemId'
    })
  }

  /**
   * Get duration of clip in seconds
   * @returns {number}
   */
  getDuration() {
    return this.endTime - this.startTime
  }

  /**
   * Check if time range is valid
   * @returns {boolean}
   */
  isValidTimeRange() {
    return this.startTime >= 0 && this.endTime > this.startTime
  }

  /**
   * Create a new audio clip
   * @param {string} userId
   * @param {string} libraryItemId
   * @param {number} startTime - Start time in seconds
   * @param {number} endTime - End time in seconds
   * @param {string} title
   * @param {string} [note]
   * @param {string} [episodeId]
   * @returns {Promise<AudioClip>}
   */
  static async createClip(userId, libraryItemId, startTime, endTime, title, note, episodeId = null) {
    // Validate time range
    if (startTime < 0) {
      throw new Error('Start time must be non-negative')
    }
    if (endTime <= startTime) {
      throw new Error('End time must be greater than start time')
    }

    // TODO: Validate against library item duration?

    // Warn if clip duration is very long (more than 10 minutes)
    const duration = endTime - startTime
    if (duration > 600) {
      Logger.warn(`[AudioClip] Creating clip with long duration: ${duration}s`)
    }

    try {
      const clip = await this.create({
        userId,
        libraryItemId,
        episodeId,
        startTime,
        endTime,
        title: title || '',
        note: note || null
      })

      Logger.info(`[AudioClip] Created clip ${clip.id} for user ${userId}`)
      return clip
    } catch (error) {
      Logger.error(`[AudioClip] Failed to create clip:`, error)
      throw error
    }
  }

  /**
   * Update an existing audio clip
   * @param {string} clipId
   * @param {Object} updates
   * @param {number} [updates.startTime]
   * @param {number} [updates.endTime]
   * @param {string} [updates.title]
   * @param {string} [updates.note]
   * @returns {Promise<AudioClip>}
   */
  static async updateClip(clipId, updates) {
    const clip = await this.findByPk(clipId)
    if (!clip) {
      throw new Error('Clip not found')
    }

    // If updating time range, validate it
    const newStartTime = updates.startTime !== undefined ? updates.startTime : clip.startTime
    const newEndTime = updates.endTime !== undefined ? updates.endTime : clip.endTime

    if (newStartTime < 0) {
      throw new Error('Start time must be non-negative')
    }
    if (newEndTime <= newStartTime) {
      throw new Error('End time must be greater than start time')
    }

    try {
      await clip.update(updates)
      Logger.info(`[AudioClip] Updated clip ${clipId}`)
      return clip
    } catch (error) {
      Logger.error(`[AudioClip] Failed to update clip ${clipId}:`, error)
      throw error
    }
  }

  /**
   * Delete an audio clip
   * @param {string} clipId
   * @returns {Promise<boolean>}
   */
  static async deleteClip(clipId) {
    try {
      const deleted = await this.destroy({
        where: { id: clipId }
      })
      if (deleted > 0) {
        Logger.info(`[AudioClip] Deleted clip ${clipId}`)
        return true
      }
      return false
    } catch (error) {
      Logger.error(`[AudioClip] Failed to delete clip ${clipId}:`, error)
      throw error
    }
  }

  /**
   * Get all clips for a specific library item
   * @param {string} userId
   * @param {string} libraryItemId
   * @param {string} [episodeId]
   * @returns {Promise<AudioClip[]>}
   */
  static async getClipsForItem(userId, libraryItemId, episodeId = null) {
    try {
      const queryOptions = {
        where: { 
          userId,
          libraryItemId 
        },
        order: [['createdAt', 'DESC']]
      }
      if (episodeId) {
        queryOptions.where.episodeId = episodeId
      }

      const clips = await this.findAll(queryOptions)
      return clips
    } catch (error) {
      Logger.error(`[AudioClip] Failed to get clips for item ${libraryItemId}:`, error)
      throw error
    }
  }

  /**
   * Get all clips for a user
   * @param {string} userId
   * @param {Object} [options]
   * @param {number} [options.limit]
   * @param {number} [options.offset]
   * @returns {Promise<AudioClip[]>}
   */
  static async getClipsForUser(userId, options = {}) {
    try {
      const queryOptions = {
        where: { userId },
        order: [['createdAt', 'DESC']]
      }

      if (options.limit) {
        queryOptions.limit = options.limit
      }
      if (options.offset) {
        queryOptions.offset = options.offset
      }

      const clips = await this.findAll(queryOptions)
      return clips
    } catch (error) {
      Logger.error(`[AudioClip] Failed to get clips for user ${userId}:`, error)
      throw error
    }
  }

  /**
   * Convert to JSON
   * @returns {AudioClipObject}
   */
  toJSON() {
    const clip = this.get({ plain: true })
    return {
      id: clip.id,
      userId: clip.userId,
      libraryItemId: clip.libraryItemId,
      episodeId: clip.episodeId,
      startTime: clip.startTime,
      endTime: clip.endTime,
      title: clip.title,
      note: clip.note,
      createdAt: clip.createdAt?.toISOString(),
      updatedAt: clip.updatedAt?.toISOString()
    }
  }
}

module.exports = AudioClip
