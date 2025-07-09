const { DataTypes, Model } = require('sequelize')
const Logger = require('../Logger')
const { isNullOrNaN } = require('../utils')

class MediaProgress extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {UUIDV4} */
    this.id
    /** @type {UUIDV4} */
    this.mediaItemId
    /** @type {string} */
    this.mediaItemType
    /** @type {number} */
    this.duration
    /** @type {number} */
    this.currentTime
    /** @type {boolean} */
    this.isFinished
    /** @type {boolean} */
    this.hideFromContinueListening
    /** @type {string} */
    this.ebookLocation
    /** @type {number} */
    this.ebookProgress
    /** @type {Date} */
    this.finishedAt
    /** @type {Object} */
    this.extraData
    /** @type {UUIDV4} */
    this.userId
    /** @type {Date} */
    this.updatedAt
    /** @type {Date} */
    this.createdAt
    /** @type {UUIDV4} */
    this.podcastId
  }

  static removeById(mediaProgressId) {
    return this.destroy({
      where: {
        id: mediaProgressId
      }
    })
  }

  /**
   * Initialize model
   *
   * Polymorphic association: Book has many MediaProgress. PodcastEpisode has many MediaProgress.
   * @see https://sequelize.org/docs/v6/advanced-association-concepts/polymorphic-associations/
   *
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
        mediaItemId: DataTypes.UUID,
        mediaItemType: DataTypes.STRING,
        duration: DataTypes.FLOAT,
        currentTime: DataTypes.FLOAT,
        isFinished: DataTypes.BOOLEAN,
        hideFromContinueListening: DataTypes.BOOLEAN,
        ebookLocation: DataTypes.STRING,
        ebookProgress: DataTypes.FLOAT,
        finishedAt: DataTypes.DATE,
        extraData: DataTypes.JSON,
        podcastId: DataTypes.UUID
      },
      {
        sequelize,
        modelName: 'mediaProgress',
        indexes: [
          {
            fields: ['updatedAt']
          }
        ]
      }
    )

    const { book, podcastEpisode, user } = sequelize.models

    book.hasMany(MediaProgress, {
      foreignKey: 'mediaItemId',
      constraints: false,
      scope: {
        mediaItemType: 'book'
      }
    })
    MediaProgress.belongsTo(book, { foreignKey: 'mediaItemId', constraints: false })

    podcastEpisode.hasMany(MediaProgress, {
      foreignKey: 'mediaItemId',
      constraints: false,
      scope: {
        mediaItemType: 'podcastEpisode'
      }
    })
    MediaProgress.belongsTo(podcastEpisode, { foreignKey: 'mediaItemId', constraints: false })

    MediaProgress.addHook('afterFind', (findResult) => {
      if (!findResult) return

      if (!Array.isArray(findResult)) findResult = [findResult]

      for (const instance of findResult) {
        if (instance.mediaItemType === 'book' && instance.book !== undefined) {
          instance.mediaItem = instance.book
          instance.dataValues.mediaItem = instance.dataValues.book
        } else if (instance.mediaItemType === 'podcastEpisode' && instance.podcastEpisode !== undefined) {
          instance.mediaItem = instance.podcastEpisode
          instance.dataValues.mediaItem = instance.dataValues.podcastEpisode
        }
        // To prevent mistakes:
        delete instance.book
        delete instance.dataValues.book
        delete instance.podcastEpisode
        delete instance.dataValues.podcastEpisode
      }
    })

    // make sure to call the afterDestroy hook for each instance
    MediaProgress.addHook('beforeBulkDestroy', (options) => {
      options.individualHooks = true
    })

    // update the potentially cached user after destroying the media progress
    MediaProgress.addHook('afterDestroy', (instance) => {
      user.mediaProgressRemoved(instance)
    })

    user.hasMany(MediaProgress, {
      onDelete: 'CASCADE'
    })
    MediaProgress.belongsTo(user)
  }

  getMediaItem(options) {
    if (!this.mediaItemType) return Promise.resolve(null)
    const mixinMethodName = `get${this.sequelize.uppercaseFirst(this.mediaItemType)}`
    return this[mixinMethodName](options)
  }

  getOldMediaProgress() {
    const isPodcastEpisode = this.mediaItemType === 'podcastEpisode'

    return {
      id: this.id,
      userId: this.userId,
      libraryItemId: this.extraData?.libraryItemId || null,
      episodeId: isPodcastEpisode ? this.mediaItemId : null,
      mediaItemId: this.mediaItemId,
      mediaItemType: this.mediaItemType,
      duration: this.duration,
      progress: this.extraData?.progress || 0,
      currentTime: this.currentTime,
      isFinished: !!this.isFinished,
      hideFromContinueListening: !!this.hideFromContinueListening,
      ebookLocation: this.ebookLocation,
      ebookProgress: this.ebookProgress,
      lastUpdate: this.updatedAt.valueOf(),
      startedAt: this.createdAt.valueOf(),
      finishedAt: this.finishedAt?.valueOf() || null
    }
  }

  get progress() {
    // Value between 0 and 1
    if (!this.duration) return 0
    return Math.max(0, Math.min(this.currentTime / this.duration, 1))
  }

  /**
   * Apply update to media progress
   *
   * @param {import('./User').ProgressUpdatePayload} progressPayload
   * @returns {Promise<MediaProgress>}
   */
  async applyProgressUpdate(progressPayload) {
    if (!this.extraData) this.extraData = {}
    if (progressPayload.isFinished !== undefined) {
      if (progressPayload.isFinished && !this.isFinished) {
        this.finishedAt = progressPayload.finishedAt || Date.now()
        this.extraData.progress = 1
        this.changed('extraData', true)
        delete progressPayload.finishedAt
      } else if (!progressPayload.isFinished && this.isFinished) {
        this.finishedAt = null
        this.extraData.progress = 0
        this.currentTime = 0
        this.changed('extraData', true)
        delete progressPayload.finishedAt
        delete progressPayload.currentTime
      }
    } else if (!isNaN(progressPayload.progress) && progressPayload.progress !== this.progress) {
      // Old model stored progress on object
      this.extraData.progress = Math.min(1, Math.max(0, progressPayload.progress))
      this.changed('extraData', true)
    }

    this.set(progressPayload)

    // Reset hideFromContinueListening if the progress has changed
    if (this.changed('currentTime') && !progressPayload.hideFromContinueListening) {
      this.hideFromContinueListening = false
    }

    const timeRemaining = this.duration - this.currentTime

    // Check if progress is far enough to mark as finished
    //   - If markAsFinishedPercentComplete is provided, use that otherwise use markAsFinishedTimeRemaining (default 10 seconds)
    let shouldMarkAsFinished = false
    if (this.duration) {
      if (!isNullOrNaN(progressPayload.markAsFinishedPercentComplete) && progressPayload.markAsFinishedPercentComplete > 0) {
        const markAsFinishedPercentComplete = Number(progressPayload.markAsFinishedPercentComplete) / 100
        shouldMarkAsFinished = markAsFinishedPercentComplete < this.progress
        if (shouldMarkAsFinished) {
          Logger.info(`[MediaProgress] Marking media progress as finished because progress (${this.progress}) is greater than ${markAsFinishedPercentComplete} (media item ${this.mediaItemId})`)
        }
      } else {
        const markAsFinishedTimeRemaining = isNullOrNaN(progressPayload.markAsFinishedTimeRemaining) ? 10 : Number(progressPayload.markAsFinishedTimeRemaining)
        shouldMarkAsFinished = timeRemaining < markAsFinishedTimeRemaining
        if (shouldMarkAsFinished) {
          Logger.info(`[MediaProgress] Marking media progress as finished because time remaining (${timeRemaining}) is less than ${markAsFinishedTimeRemaining} seconds (media item ${this.mediaItemId})`)
        }
      }
    }

    if (!this.isFinished && shouldMarkAsFinished) {
      this.isFinished = true
      this.finishedAt = this.finishedAt || Date.now()
      this.extraData.progress = 1
      this.changed('extraData', true)
    } else if (this.isFinished && this.changed('currentTime') && !shouldMarkAsFinished) {
      this.isFinished = false
      this.finishedAt = null
    }

    await this.save()

    // For local sync
    if (progressPayload.lastUpdate) {
      if (isNaN(new Date(progressPayload.lastUpdate))) {
        Logger.warn(`[MediaProgress] Invalid date provided for lastUpdate: ${progressPayload.lastUpdate} (media item ${this.mediaItemId})`)
      } else {
        const escapedDate = this.sequelize.escape(new Date(progressPayload.lastUpdate))
        Logger.info(`[MediaProgress] Manually setting updatedAt to ${escapedDate} (media item ${this.mediaItemId})`)

        await this.sequelize.query(`UPDATE "mediaProgresses" SET "updatedAt" = ${escapedDate} WHERE "id" = '${this.id}'`)

        await this.reload()
      }
    }

    return this
  }
}

module.exports = MediaProgress
