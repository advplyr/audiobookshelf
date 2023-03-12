const { DataTypes, Model } = require('sequelize')

const uppercaseFirst = str => `${str[0].toUpperCase()}${str.substr(1)}`

module.exports = (sequelize) => {
  class PlaylistMediaItem extends Model {
    getMediaItem(options) {
      if (!this.mediaItemType) return Promise.resolve(null)
      const mixinMethodName = `get${uppercaseFirst(this.mediaItemType)}`
      return this[mixinMethodName](options)
    }
  }

  PlaylistMediaItem.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    mediaItemId: DataTypes.UUIDV4,
    mediaItemType: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'PlaylistMediaItem'
  })

  const { Book, PodcastEpisode, Playlist } = sequelize.models

  Book.hasMany(PlaylistMediaItem, {
    foreignKey: 'mediaItemId',
    constraints: false,
    scope: {
      mediaItemType: 'book'
    }
  })
  PlaylistMediaItem.belongsTo(Book, { foreignKey: 'mediaItemId', constraints: false })

  PodcastEpisode.hasOne(PlaylistMediaItem, {
    foreignKey: 'mediaItemId',
    constraints: false,
    scope: {
      mediaItemType: 'podcastEpisode'
    }
  })
  PlaylistMediaItem.belongsTo(PodcastEpisode, { foreignKey: 'mediaItemId', constraints: false })

  PlaylistMediaItem.addHook('afterFind', findResult => {
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

  Playlist.hasMany(PlaylistMediaItem)
  PlaylistMediaItem.belongsTo(Playlist)

  return PlaylistMediaItem
}