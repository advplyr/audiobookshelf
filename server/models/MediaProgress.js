const { DataTypes, Model } = require('sequelize')

/*
 * Polymorphic association: https://sequelize.org/docs/v6/advanced-association-concepts/polymorphic-associations/
 * Book has many MediaProgress. PodcastEpisode has many MediaProgress.
 */
module.exports = (sequelize) => {
  class MediaProgress extends Model {
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
        progress: this.extraData?.progress || null,
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

    static upsertFromOld(oldMediaProgress) {
      const mediaProgress = this.getFromOld(oldMediaProgress)
      return this.upsert(mediaProgress)
    }

    static getFromOld(oldMediaProgress) {
      return {
        id: oldMediaProgress.id,
        userId: oldMediaProgress.userId,
        mediaItemId: oldMediaProgress.mediaItemId,
        mediaItemType: oldMediaProgress.mediaItemType,
        duration: oldMediaProgress.duration,
        currentTime: oldMediaProgress.currentTime,
        ebookLocation: oldMediaProgress.ebookLocation || null,
        ebookProgress: oldMediaProgress.ebookProgress || null,
        isFinished: !!oldMediaProgress.isFinished,
        hideFromContinueListening: !!oldMediaProgress.hideFromContinueListening,
        finishedAt: oldMediaProgress.finishedAt,
        createdAt: oldMediaProgress.startedAt || oldMediaProgress.lastUpdate,
        updatedAt: oldMediaProgress.lastUpdate,
        extraData: {
          libraryItemId: oldMediaProgress.libraryItemId,
          progress: oldMediaProgress.progress
        }
      }
    }

    static removeById(mediaProgressId) {
      return this.destroy({
        where: {
          id: mediaProgressId
        }
      })
    }

    getMediaItem(options) {
      if (!this.mediaItemType) return Promise.resolve(null)
      const mixinMethodName = `get${sequelize.uppercaseFirst(this.mediaItemType)}`
      return this[mixinMethodName](options)
    }
  }


  MediaProgress.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    mediaItemId: DataTypes.UUIDV4,
    mediaItemType: DataTypes.STRING,
    duration: DataTypes.FLOAT,
    currentTime: DataTypes.FLOAT,
    isFinished: DataTypes.BOOLEAN,
    hideFromContinueListening: DataTypes.BOOLEAN,
    ebookLocation: DataTypes.STRING,
    ebookProgress: DataTypes.FLOAT,
    finishedAt: DataTypes.DATE,
    extraData: DataTypes.JSON
  }, {
    sequelize,
    modelName: 'mediaProgress'
  })

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

  MediaProgress.addHook('afterFind', findResult => {
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

  user.hasMany(MediaProgress, {
    onDelete: 'CASCADE'
  })
  MediaProgress.belongsTo(user)

  return MediaProgress
}