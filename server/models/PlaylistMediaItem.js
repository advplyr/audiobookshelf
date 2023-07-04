const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class PlaylistMediaItem extends Model {
    static removeByIds(playlistId, mediaItemId) {
      return this.destroy({
        where: {
          playlistId,
          mediaItemId
        }
      })
    }

    getMediaItem(options) {
      if (!this.mediaItemType) return Promise.resolve(null)
      const mixinMethodName = `get${sequelize.uppercaseFirst(this.mediaItemType)}`
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
    mediaItemType: DataTypes.STRING,
    order: DataTypes.INTEGER
  }, {
    sequelize,
    timestamps: true,
    updatedAt: false,
    modelName: 'playlistMediaItem'
  })

  const { book, podcastEpisode, playlist } = sequelize.models

  book.hasMany(PlaylistMediaItem, {
    foreignKey: 'mediaItemId',
    constraints: false,
    scope: {
      mediaItemType: 'book'
    }
  })
  PlaylistMediaItem.belongsTo(book, { foreignKey: 'mediaItemId', constraints: false })

  podcastEpisode.hasOne(PlaylistMediaItem, {
    foreignKey: 'mediaItemId',
    constraints: false,
    scope: {
      mediaItemType: 'podcastEpisode'
    }
  })
  PlaylistMediaItem.belongsTo(podcastEpisode, { foreignKey: 'mediaItemId', constraints: false })

  PlaylistMediaItem.addHook('afterFind', findResult => {
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

  playlist.hasMany(PlaylistMediaItem)
  PlaylistMediaItem.belongsTo(playlist)

  return PlaylistMediaItem
}