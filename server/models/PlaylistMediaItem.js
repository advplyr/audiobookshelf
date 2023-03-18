const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class PlaylistMediaItem extends Model {
    getMediaItem(options) {
      if (!this.mediaItemType) return Promise.resolve(null)
      const mixinMethodName = `get${this.mediaItemType}`
      return this[mixinMethodName](options)
    }
  }

  PlaylistMediaItem.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    MediaItemId: DataTypes.UUIDV4,
    mediaItemType: DataTypes.STRING
  }, {
    sequelize,
    timestamps: true,
    updatedAt: false,
    modelName: 'PlaylistMediaItem'
  })

  const { Book, PodcastEpisode, Playlist } = sequelize.models

  Book.hasMany(PlaylistMediaItem, {
    foreignKey: 'MediaItemId',
    constraints: false,
    scope: {
      mediaItemType: 'Book'
    }
  })
  PlaylistMediaItem.belongsTo(Book, { foreignKey: 'MediaItemId', constraints: false })

  PodcastEpisode.hasOne(PlaylistMediaItem, {
    foreignKey: 'MediaItemId',
    constraints: false,
    scope: {
      mediaItemType: 'PodcastEpisode'
    }
  })
  PlaylistMediaItem.belongsTo(PodcastEpisode, { foreignKey: 'MediaItemId', constraints: false })

  PlaylistMediaItem.addHook('afterFind', findResult => {
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

  Playlist.hasMany(PlaylistMediaItem)
  PlaylistMediaItem.belongsTo(Playlist)

  return PlaylistMediaItem
}