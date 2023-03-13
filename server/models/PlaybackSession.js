const { DataTypes, Model } = require('sequelize')

const uppercaseFirst = str => `${str[0].toUpperCase()}${str.substr(1)}`

module.exports = (sequelize) => {
  class PlaybackSession extends Model {
    getMediaItem(options) {
      if (!this.mediaItemType) return Promise.resolve(null)
      const mixinMethodName = `get${uppercaseFirst(this.mediaItemType)}`
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
    duration: DataTypes.INTEGER,
    playMethod: DataTypes.STRING,
    mediaPlayer: DataTypes.STRING,
    startTime: DataTypes.INTEGER,
    currentTime: DataTypes.INTEGER,
    timeListening: DataTypes.INTEGER,
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
    foreignKey: 'mediaItemId',
    constraints: false,
    scope: {
      mediaItemType: 'book'
    }
  })
  PlaybackSession.belongsTo(Book, { foreignKey: 'mediaItemId', constraints: false })

  PodcastEpisode.hasOne(PlaybackSession, {
    foreignKey: 'mediaItemId',
    constraints: false,
    scope: {
      mediaItemType: 'podcastEpisode'
    }
  })
  PlaybackSession.belongsTo(PodcastEpisode, { foreignKey: 'mediaItemId', constraints: false })

  PlaybackSession.addHook('afterFind', findResult => {
    if (!Array.isArray(findResult)) findResult = [findResult]
    for (const instance of findResult) {
      if (instance.mediaItemType === 'book' && instance.Book !== undefined) {
        instance.MediaItem = instance.Book
      } else if (instance.mediaItemType === 'podcastEpisode' && instance.PodcastEpisode !== undefined) {
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