const { DataTypes, Model, Op } = require('sequelize')
const Logger = require('../Logger')

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
          Logger.error(`[Playlist] Invalid playlist media item - No library item id found`, JSON.stringify(pmi, null, 2))
          return null
        }
        return {
          episodeId: pmi.mediaItemType === 'podcastEpisode' ? pmi.mediaItemId : '',
          libraryItemId
        }
      }).filter(pmi => pmi)

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

    /**
     * Get playlist by id
     * @param {string} playlistId 
     * @returns {Promise<oldPlaylist|null>} returns null if not found
     */
    static async getById(playlistId) {
      if (!playlistId) return null
      const playlist = await this.findByPk(playlistId, {
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
      if (!playlist) return null
      return this.getOldPlaylist(playlist)
    }

    /**
     * Get playlists for user and optionally for library
     * @param {string} userId 
     * @param {[string]} libraryId optional
     * @returns {Promise<oldPlaylist[]>}
     */
    static async getPlaylistsForUserAndLibrary(userId, libraryId = null) {
      if (!userId && !libraryId) return []
      const whereQuery = {}
      if (userId) {
        whereQuery.userId = userId
      }
      if (libraryId) {
        whereQuery.libraryId = libraryId
      }
      const playlists = await this.findAll({
        where: whereQuery,
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

    /**
     * Get number of playlists for a user and library
     * @param {string} userId 
     * @param {string} libraryId 
     * @returns 
     */
    static async getNumPlaylistsForUserAndLibrary(userId, libraryId) {
      return this.count({
        where: {
          userId,
          libraryId
        }
      })
    }

    /**
     * Get all playlists for mediaItemIds
     * @param {string[]} mediaItemIds 
     * @returns {Promise<oldPlaylist[]>}
     */
    static async getPlaylistsForMediaItemIds(mediaItemIds) {
      if (!mediaItemIds?.length) return []

      const playlistMediaItemsExpanded = await sequelize.models.playlistMediaItem.findAll({
        where: {
          mediaItemId: {
            [Op.in]: mediaItemIds
          }
        },
        include: [
          {
            model: sequelize.models.playlist,
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
            }
          }
        ],
        order: [['playlist', 'playlistMediaItems', 'order', 'ASC']]
      })
      return playlistMediaItemsExpanded.map(pmie => {
        pmie.playlist.playlistMediaItems = pmie.playlist.playlistMediaItems.map(pmi => {
          if (pmi.mediaItemType === 'book' && pmi.book !== undefined) {
            pmi.mediaItem = pmi.book
            pmi.dataValues.mediaItem = pmi.dataValues.book
          } else if (pmi.mediaItemType === 'podcastEpisode' && pmi.podcastEpisode !== undefined) {
            pmi.mediaItem = pmi.podcastEpisode
            pmi.dataValues.mediaItem = pmi.dataValues.podcastEpisode
          }
          delete pmi.book
          delete pmi.dataValues.book
          delete pmi.podcastEpisode
          delete pmi.dataValues.podcastEpisode
          return pmi
        })

        return this.getOldPlaylist(pmie.playlist)
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