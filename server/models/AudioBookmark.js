const { DataTypes, Model } = require('sequelize')

/*
 * Polymorphic association: https://sequelize.org/docs/v6/advanced-association-concepts/polymorphic-associations/
 * Book has many AudioBookmark. PodcastEpisode has many AudioBookmark.
 */
module.exports = (sequelize) => {
  class AudioBookmark extends Model {
    getMediaItem(options) {
      if (!this.mediaItemType) return Promise.resolve(null)
      const mixinMethodName = `get${this.mediaItemType}`
      return this[mixinMethodName](options)
    }
  }

  AudioBookmark.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    MediaItemId: DataTypes.UUIDV4,
    mediaItemType: DataTypes.STRING,
    title: DataTypes.STRING,
    time: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'AudioBookmark'
  })

  const { User, Book, PodcastEpisode } = sequelize.models
  Book.hasMany(AudioBookmark, {
    foreignKey: 'MediaItemId',
    constraints: false,
    scope: {
      mediaItemType: 'Book'
    }
  })
  AudioBookmark.belongsTo(Book, { foreignKey: 'MediaItemId', constraints: false })

  PodcastEpisode.hasMany(AudioBookmark, {
    foreignKey: 'MediaItemId',
    constraints: false,
    scope: {
      mediaItemType: 'PodcastEpisode'
    }
  })
  AudioBookmark.belongsTo(PodcastEpisode, { foreignKey: 'MediaItemId', constraints: false })

  AudioBookmark.addHook('afterFind', findResult => {
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

  User.hasMany(AudioBookmark)
  AudioBookmark.belongsTo(User)

  return AudioBookmark
}