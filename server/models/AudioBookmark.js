const { DataTypes, Model } = require('sequelize')

/*
 * Polymorphic association: https://sequelize.org/docs/v6/advanced-association-concepts/polymorphic-associations/
 * Book has many AudioBookmark. PodcastEpisode has many AudioBookmark.
 */
module.exports = (sequelize) => {
  class AudioBookmark extends Model {
    getMediaItem(options) {
      if (!this.mediaItemType) return Promise.resolve(null)
      const mixinMethodName = `get${sequelize.uppercaseFirst(this.mediaItemType)}`
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
    modelName: 'audioBookmark'
  })

  const { user, book, podcastEpisode } = sequelize.models
  book.hasMany(AudioBookmark, {
    foreignKey: 'mediaItemId',
    constraints: false,
    scope: {
      mediaItemType: 'book'
    }
  })
  AudioBookmark.belongsTo(book, { foreignKey: 'mediaItemId', constraints: false })

  podcastEpisode.hasMany(AudioBookmark, {
    foreignKey: 'mediaItemId',
    constraints: false,
    scope: {
      mediaItemType: 'podcastEpisode'
    }
  })
  AudioBookmark.belongsTo(podcastEpisode, { foreignKey: 'mediaItemId', constraints: false })

  AudioBookmark.addHook('afterFind', findResult => {
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

  user.hasMany(AudioBookmark)
  AudioBookmark.belongsTo(user)

  return AudioBookmark
}