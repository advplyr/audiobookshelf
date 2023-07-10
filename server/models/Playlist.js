const { DataTypes, Model } = require('sequelize')

const oldPlaylist = require('../objects/Playlist')
const { areEquivalent } = require('../utils/index')

module.exports = (sequelize) => {
  class Playlist extends Model {
    static async getOldPlaylists() {
      const playlists = await this.findAll({
        include: {
          model: sequelize.models.playlistMediaItem,
          include: [
            {
              model: sequelize.models.book,
              include: sequelize.models.libraryItem
            },
            {
              model: sequelize.models.podcastEpisode,
              include: {
                model: sequelize.models.podcast,
                include: sequelize.models.libraryItem
              }
            }
          ]
        },
        order: [['playlistMediaItems', 'order', 'ASC']]
      })
      return playlists.map(p => this.getOldPlaylist(p))
    }

    static getOldPlaylist(playlistExpanded) {
      const items = playlistExpanded.playlistMediaItems.map(pmi => {
        const libraryItemId = pmi.mediaItem?.podcast?.libraryItem?.id || pmi.mediaItem?.libraryItem?.id || null
        if (!libraryItemId) {
          console.log(JSON.stringify(pmi, null, 2))
          throw new Error('No library item id')
        }
        return {
          episodeId: pmi.mediaItemType === 'podcastEpisode' ? pmi.mediaItemId : '',
          libraryItemId: libraryItemId
        }
      })
      return new oldPlaylist({
        id: playlistExpanded.id,
        libraryId: playlistExpanded.libraryId,
        userId: playlistExpanded.userId,
        name: playlistExpanded.name,
        description: playlistExpanded.description,
        items,
        lastUpdate: playlistExpanded.updatedAt.valueOf(),
        createdAt: playlistExpanded.createdAt.valueOf()
      })
    }

    static createFromOld(oldPlaylist) {
      const playlist = this.getFromOld(oldPlaylist)
      return this.create(playlist)
    }

    static async fullUpdateFromOld(oldPlaylist, playlistMediaItems) {
      const existingPlaylist = await this.findByPk(oldPlaylist.id, {
        include: sequelize.models.playlistMediaItem
      })
      if (!existingPlaylist) return false

      let hasUpdates = false
      const playlist = this.getFromOld(oldPlaylist)

      for (const pmi of playlistMediaItems) {
        const existingPmi = existingPlaylist.playlistMediaItems.find(i => i.mediaItemId === pmi.mediaItemId)
        if (!existingPmi) {
          await sequelize.models.playlistMediaItem.create(pmi)
          hasUpdates = true
        } else if (existingPmi.order != pmi.order) {
          await existingPmi.update({ order: pmi.order })
          hasUpdates = true
        }
      }
      for (const pmi of existingPlaylist.playlistMediaItems) {
        // Pmi was removed
        if (!playlistMediaItems.some(i => i.mediaItemId === pmi.mediaItemId)) {
          await pmi.destroy()
          hasUpdates = true
        }
      }

      let hasPlaylistUpdates = false
      for (const key in playlist) {
        let existingValue = existingPlaylist[key]
        if (existingValue instanceof Date) existingValue = existingValue.valueOf()

        if (!areEquivalent(playlist[key], existingValue)) {
          hasPlaylistUpdates = true
        }
      }
      if (hasPlaylistUpdates) {
        existingPlaylist.update(playlist)
        hasUpdates = true
      }
      return hasUpdates
    }

    static getFromOld(oldPlaylist) {
      return {
        id: oldPlaylist.id,
        name: oldPlaylist.name,
        description: oldPlaylist.description,
        userId: oldPlaylist.userId,
        libraryId: oldPlaylist.libraryId
      }
    }

    static removeById(playlistId) {
      return this.destroy({
        where: {
          id: playlistId
        }
      })
    }
  }

  Playlist.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: DataTypes.STRING,
    description: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'playlist'
  })

  const { library, user } = sequelize.models
  library.hasMany(Playlist)
  Playlist.belongsTo(library)

  user.hasMany(Playlist)
  Playlist.belongsTo(user)

  Playlist.addHook('afterFind', findResult => {
    if (!findResult) return

    if (!Array.isArray(findResult)) findResult = [findResult]

    for (const instance of findResult) {
      if (instance.playlistMediaItems?.length) {
        instance.playlistMediaItems = instance.playlistMediaItems.map(pmi => {
          if (pmi.mediaItemType === 'book' && pmi.book !== undefined) {
            pmi.mediaItem = pmi.book
            pmi.dataValues.mediaItem = pmi.dataValues.book
          } else if (pmi.mediaItemType === 'podcastEpisode' && pmi.podcastEpisode !== undefined) {
            pmi.mediaItem = pmi.podcastEpisode
            pmi.dataValues.mediaItem = pmi.dataValues.podcastEpisode
          }
          // To prevent mistakes:
          delete pmi.book
          delete pmi.dataValues.book
          delete pmi.podcastEpisode
          delete pmi.dataValues.podcastEpisode
          return pmi
        })
      }

    }
  })

  return Playlist
}