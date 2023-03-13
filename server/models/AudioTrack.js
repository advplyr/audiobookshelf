const { DataTypes, Model } = require('sequelize')

const uppercaseFirst = str => `${str[0].toUpperCase()}${str.substr(1)}`

/*
 * Polymorphic association: https://sequelize.org/docs/v6/advanced-association-concepts/polymorphic-associations/
 * Book has many AudioTrack. PodcastEpisode has one AudioTrack.
 */
module.exports = (sequelize) => {
  class AudioTrack extends Model {
    getMediaItem(options) {
      if (!this.mediaItemType) return Promise.resolve(null)
      const mixinMethodName = `get${uppercaseFirst(this.mediaItemType)}`
      return this[mixinMethodName](options)
    }
  }

  AudioTrack.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    mediaItemId: DataTypes.UUIDV4,
    mediaItemType: DataTypes.STRING,
    index: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'AudioTrack'
  })

  const { Book, PodcastEpisode, FileMetadata } = sequelize.models

  FileMetadata.hasOne(AudioTrack)
  AudioTrack.belongsTo(FileMetadata)

  Book.hasMany(AudioTrack, {
    foreignKey: 'mediaItemId',
    constraints: false,
    scope: {
      mediaItemType: 'book'
    }
  })
  AudioTrack.belongsTo(Book, { foreignKey: 'mediaItemId', constraints: false })

  PodcastEpisode.hasOne(AudioTrack, {
    foreignKey: 'mediaItemId',
    constraints: false,
    scope: {
      mediaItemType: 'podcastEpisode'
    }
  })
  AudioTrack.belongsTo(PodcastEpisode, { foreignKey: 'mediaItemId', constraints: false })

  AudioTrack.addHook('afterFind', findResult => {
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

  return AudioTrack
}