const { DataTypes, Model } = require('sequelize')

/*
 * Polymorphic association: https://sequelize.org/docs/v6/advanced-association-concepts/polymorphic-associations/
 * Book has many MediaProgress. PodcastEpisode has many MediaProgress.
 */
module.exports = (sequelize) => {
  class MediaProgress extends Model {
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
    finishedAt: DataTypes.DATE
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

  user.hasMany(MediaProgress)
  MediaProgress.belongsTo(user)

  return MediaProgress
}