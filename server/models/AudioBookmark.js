const { DataTypes, Model } = require('sequelize')

const uppercaseFirst = str => `${str[0].toUpperCase()}${str.substr(1)}`

/*
 * Polymorphic association: https://sequelize.org/docs/v6/advanced-association-concepts/polymorphic-associations/
 * Book has many AudioBookmark. PodcastEpisode has many AudioBookmark.
 */
module.exports = (sequelize) => {
  class AudioBookmark extends Model {
    getMediaItem(options) {
      if (!this.mediaItemType) return Promise.resolve(null)
      const mixinMethodName = `get${uppercaseFirst(this.mediaItemType)}`
      return this[mixinMethodName](options)
    }
  }

  AudioBookmark.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    mediaItemId: DataTypes.UUIDV4,
    mediaItemType: DataTypes.STRING,
    title: DataTypes.STRING,
    time: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'AudioBookmark'
  })

  const { User, Book, PodcastEpisode } = sequelize.models
  Book.hasMany(AudioBookmark, {
    foreignKey: 'mediaItemId',
    constraints: false,
    scope: {
      mediaItemType: 'book'
    }
  })
  AudioBookmark.belongsTo(Book, { foreignKey: 'mediaItemId', constraints: false })

  PodcastEpisode.hasMany(AudioBookmark, {
    foreignKey: 'mediaItemId',
    constraints: false,
    scope: {
      mediaItemType: 'podcastEpisode'
    }
  })
  AudioBookmark.belongsTo(PodcastEpisode, { foreignKey: 'mediaItemId', constraints: false })

  AudioBookmark.addHook('afterFind', findResult => {
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

  User.hasMany(AudioBookmark)
  AudioBookmark.belongsTo(User)

  return AudioBookmark
}