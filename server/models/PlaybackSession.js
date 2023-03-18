const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class PlaybackSession extends Model {
    getMediaItem(options) {
      if (!this.mediaItemType) return Promise.resolve(null)
      const mixinMethodName = `get${this.mediaItemType}`
      return this[mixinMethodName](options)
    }
  }

  PlaybackSession.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    MediaItemId: DataTypes.UUIDV4,
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
    modelName: 'PlaybackSession'
  })

  const { Book, PodcastEpisode, User, Device } = sequelize.models

  User.hasMany(PlaybackSession)
  PlaybackSession.belongsTo(User)

  Device.hasMany(PlaybackSession)
  PlaybackSession.belongsTo(Device)

  Book.hasMany(PlaybackSession, {
    foreignKey: 'MediaItemId',
    constraints: false,
    scope: {
      mediaItemType: 'Book'
    }
  })
  PlaybackSession.belongsTo(Book, { foreignKey: 'MediaItemId', constraints: false })

  PodcastEpisode.hasOne(PlaybackSession, {
    foreignKey: 'MediaItemId',
    constraints: false,
    scope: {
      mediaItemType: 'PodcastEpisode'
    }
  })
  PlaybackSession.belongsTo(PodcastEpisode, { foreignKey: 'MediaItemId', constraints: false })

  PlaybackSession.addHook('afterFind', findResult => {
    if (!Array.isArray(findResult)) findResult = [findResult]
    for (const instance of findResult) {
      if (instance.mediaItemType === 'Book' && instance.Book !== undefined) {
        instance.MediaItem = instance.Book
      } else if (instance.mediaItemType === 'PodcastEpisode' && instance.PodcastEpisode !== undefined) {
        instance.MediaItem = instance.PodcastEpisode
      }
      // To prevent mistakes:
      delete instance.Book
      delete instance.dataValues.Book
      delete instance.PodcastEpisode
      delete instance.dataValues.PodcastEpisode
    }
  })

  return PlaybackSession
}