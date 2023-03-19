const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class PlaybackSession extends Model {
    getMediaItem(options) {
      if (!this.mediaItemType) return Promise.resolve(null)
      const mixinMethodName = `get${sequelize.uppercaseFirst(this.mediaItemType)}`
      return this[mixinMethodName](options)
    }
  }

  PlaybackSession.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    mediaItemId: DataTypes.UUIDV4,
    mediaItemType: DataTypes.STRING,
    displayTitle: DataTypes.STRING,
    displayAuthor: DataTypes.STRING,
    duration: DataTypes.FLOAT,
    playMethod: DataTypes.STRING,
    mediaPlayer: DataTypes.STRING,
    startTime: DataTypes.FLOAT,
    currentTime: DataTypes.FLOAT,
    serverVersion: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'playbackSession'
  })

  const { book, podcastEpisode, user, device } = sequelize.models

  user.hasMany(PlaybackSession)
  PlaybackSession.belongsTo(user)

  device.hasMany(PlaybackSession)
  PlaybackSession.belongsTo(device)

  book.hasMany(PlaybackSession, {
    foreignKey: 'mediaItemId',
    constraints: false,
    scope: {
      mediaItemType: 'book'
    }
  })
  PlaybackSession.belongsTo(book, { foreignKey: 'mediaItemId', constraints: false })

  podcastEpisode.hasOne(PlaybackSession, {
    foreignKey: 'mediaItemId',
    constraints: false,
    scope: {
      mediaItemType: 'podcastEpisode'
    }
  })
  PlaybackSession.belongsTo(podcastEpisode, { foreignKey: 'mediaItemId', constraints: false })

  PlaybackSession.addHook('afterFind', findResult => {
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

  return PlaybackSession
}