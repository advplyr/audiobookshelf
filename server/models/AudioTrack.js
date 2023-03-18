const { DataTypes, Model } = require('sequelize')

/*
 * Polymorphic association: https://sequelize.org/docs/v6/advanced-association-concepts/polymorphic-associations/
 * Book has many AudioTrack. PodcastEpisode has one AudioTrack.
 */
module.exports = (sequelize) => {
  class AudioTrack extends Model {
    getMediaItem(options) {
      if (!this.mediaItemType) return Promise.resolve(null)
      const mixinMethodName = `get${this.mediaItemType}`
      return this[mixinMethodName](options)
    }
  }

  AudioTrack.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    MediaItemId: DataTypes.UUIDV4,
    mediaItemType: DataTypes.STRING,
    index: DataTypes.INTEGER,
    startOffset: DataTypes.FLOAT,
    duration: DataTypes.FLOAT,
    title: DataTypes.STRING,
    mimeType: DataTypes.STRING,
    codec: DataTypes.STRING,
    trackNumber: DataTypes.INTEGER,
    discNumber: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'AudioTrack'
  })

  const { Book, PodcastEpisode, MediaFile } = sequelize.models

  MediaFile.hasOne(AudioTrack)
  AudioTrack.belongsTo(MediaFile)

  Book.hasMany(AudioTrack, {
    foreignKey: 'MediaItemId',
    constraints: false,
    scope: {
      mediaItemType: 'Book'
    }
  })
  AudioTrack.belongsTo(Book, { foreignKey: 'MediaItemId', constraints: false })

  PodcastEpisode.hasOne(AudioTrack, {
    foreignKey: 'MediaItemId',
    constraints: false,
    scope: {
      mediaItemType: 'PodcastEpisode'
    }
  })
  AudioTrack.belongsTo(PodcastEpisode, { foreignKey: 'MediaItemId', constraints: false })

  AudioTrack.addHook('afterFind', findResult => {
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

  return AudioTrack
}