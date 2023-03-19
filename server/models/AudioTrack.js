const { DataTypes, Model } = require('sequelize')

/*
 * Polymorphic association: https://sequelize.org/docs/v6/advanced-association-concepts/polymorphic-associations/
 * Book has many AudioTrack. PodcastEpisode has one AudioTrack.
 */
module.exports = (sequelize) => {
  class AudioTrack extends Model {
    getMediaItem(options) {
      if (!this.mediaItemType) return Promise.resolve(null)
      const mixinMethodName = `get${sequelize.uppercaseFirst(this.mediaItemType)}`
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
    modelName: 'audioTrack'
  })

  const { book, podcastEpisode, mediaFile } = sequelize.models

  mediaFile.hasOne(AudioTrack)
  AudioTrack.belongsTo(mediaFile)

  book.hasMany(AudioTrack, {
    foreignKey: 'mediaItemId',
    constraints: false,
    scope: {
      mediaItemType: 'book'
    }
  })
  AudioTrack.belongsTo(book, { foreignKey: 'mediaItemId', constraints: false })

  podcastEpisode.hasOne(AudioTrack, {
    foreignKey: 'mediaItemId',
    constraints: false,
    scope: {
      mediaItemType: 'podcastEpisode'
    }
  })
  AudioTrack.belongsTo(podcastEpisode, { foreignKey: 'mediaItemId', constraints: false })

  AudioTrack.addHook('afterFind', findResult => {
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

  return AudioTrack
}