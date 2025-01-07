const { DataTypes, Model, Op } = require('sequelize')
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')

class Playlist extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {UUIDV4} */
    this.id
    /** @type {string} */
    this.name
    /** @type {string} */
    this.description
    /** @type {UUIDV4} */
    this.libraryId
    /** @type {UUIDV4} */
    this.userId
    /** @type {Date} */
    this.createdAt
    /** @type {Date} */
    this.updatedAt

    // Expanded properties

    /** @type {import('./PlaylistMediaItem')[]} - only set when expanded */
    this.playlistMediaItems
  }

  /**
   * Get old playlists for user and library
   *
   * @param {string} userId
   * @param {string} libraryId
   * @async
   */
  static async getOldPlaylistsForUserAndLibrary(userId, libraryId) {
    if (!userId && !libraryId) return []

    const whereQuery = {}
    if (userId) {
      whereQuery.userId = userId
    }
    if (libraryId) {
      whereQuery.libraryId = libraryId
    }
    const playlistsExpanded = await this.findAll({
      where: whereQuery,
      include: {
        model: this.sequelize.models.playlistMediaItem,
        include: [
          {
            model: this.sequelize.models.book,
            include: [
              {
                model: this.sequelize.models.libraryItem
              },
              {
                model: this.sequelize.models.author,
                through: {
                  attributes: []
                }
              },
              {
                model: this.sequelize.models.series,
                through: {
                  attributes: ['sequence']
                }
              }
            ]
          },
          {
            model: this.sequelize.models.podcastEpisode,
            include: {
              model: this.sequelize.models.podcast,
              include: this.sequelize.models.libraryItem
            }
          }
        ]
      },
      order: [['playlistMediaItems', 'order', 'ASC']]
    })

    // Sort by name asc
    playlistsExpanded.sort((a, b) => a.name.localeCompare(b.name))

    return playlistsExpanded.map((playlist) => playlist.toOldJSONExpanded())
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
   * @returns {Promise<Playlist[]>}
   */
  static async getPlaylistsForMediaItemIds(mediaItemIds) {
    if (!mediaItemIds?.length) return []

    const playlistMediaItemsExpanded = await this.sequelize.models.playlistMediaItem.findAll({
      where: {
        mediaItemId: {
          [Op.in]: mediaItemIds
        }
      },
      include: [
        {
          model: this.sequelize.models.playlist,
          include: {
            model: this.sequelize.models.playlistMediaItem,
            include: [
              {
                model: this.sequelize.models.book,
                include: this.sequelize.models.libraryItem
              },
              {
                model: this.sequelize.models.podcastEpisode,
                include: {
                  model: this.sequelize.models.podcast,
                  include: this.sequelize.models.libraryItem
                }
              }
            ]
          }
        }
      ],
      order: [['playlist', 'playlistMediaItems', 'order', 'ASC']]
    })

    const playlists = []
    for (const playlistMediaItem of playlistMediaItemsExpanded) {
      const playlist = playlistMediaItem.playlist
      if (playlists.some((p) => p.id === playlist.id)) continue

      playlist.playlistMediaItems = playlist.playlistMediaItems.map((pmi) => {
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
      playlists.push(playlist)
    }
    return playlists
  }

  /**
   * Removes media items and re-orders playlists
   *
   * @param {string[]} mediaItemIds
   */
  static async removeMediaItemsFromPlaylists(mediaItemIds) {
    if (!mediaItemIds?.length) return

    const playlistsWithItem = await this.getPlaylistsForMediaItemIds(mediaItemIds)

    if (!playlistsWithItem.length) return

    for (const playlist of playlistsWithItem) {
      let numMediaItems = playlist.playlistMediaItems.length

      let order = 1
      // Remove items in playlist and re-order
      for (const playlistMediaItem of playlist.playlistMediaItems) {
        if (mediaItemIds.includes(playlistMediaItem.mediaItemId)) {
          await playlistMediaItem.destroy()
          numMediaItems--
        } else {
          if (playlistMediaItem.order !== order) {
            playlistMediaItem.update({
              order
            })
          }
          order++
        }
      }

      // If playlist is now empty then remove it
      const jsonExpanded = await playlist.getOldJsonExpanded()
      if (!numMediaItems) {
        Logger.info(`[ApiRouter] Playlist "${playlist.name}" has no more items - removing it`)
        await playlist.destroy()
        SocketAuthority.clientEmitter(playlist.userId, 'playlist_removed', jsonExpanded)
      } else {
        SocketAuthority.clientEmitter(playlist.userId, 'playlist_updated', jsonExpanded)
      }
    }
  }

  /**
   * Initialize model
   * @param {import('../Database').sequelize} sequelize
   */
  static init(sequelize) {
    super.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        name: DataTypes.STRING,
        description: DataTypes.TEXT
      },
      {
        sequelize,
        modelName: 'playlist'
      }
    )

    const { library, user } = sequelize.models
    library.hasMany(Playlist)
    Playlist.belongsTo(library)

    user.hasMany(Playlist, {
      onDelete: 'CASCADE'
    })
    Playlist.belongsTo(user)

    Playlist.addHook('afterFind', (findResult) => {
      if (!findResult) return

      if (!Array.isArray(findResult)) findResult = [findResult]

      for (const instance of findResult) {
        if (instance.playlistMediaItems?.length) {
          instance.playlistMediaItems = instance.playlistMediaItems.map((pmi) => {
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
  }

  /**
   * Get all media items in playlist expanded with library item
   *
   * @returns {Promise<import('./PlaylistMediaItem')[]>}
   */
  getMediaItemsExpandedWithLibraryItem() {
    return this.getPlaylistMediaItems({
      include: [
        {
          model: this.sequelize.models.book,
          include: [
            {
              model: this.sequelize.models.libraryItem
            },
            {
              model: this.sequelize.models.author,
              through: {
                attributes: []
              }
            },
            {
              model: this.sequelize.models.series,
              through: {
                attributes: ['sequence']
              }
            }
          ]
        },
        {
          model: this.sequelize.models.podcastEpisode,
          include: [
            {
              model: this.sequelize.models.podcast,
              include: this.sequelize.models.libraryItem
            }
          ]
        }
      ],
      order: [['order', 'ASC']]
    })
  }

  /**
   * Get playlists toOldJSONExpanded
   *
   * @async
   */
  async getOldJsonExpanded() {
    this.playlistMediaItems = await this.getMediaItemsExpandedWithLibraryItem()
    return this.toOldJSONExpanded()
  }

  /**
   * Old model used libraryItemId instead of bookId
   *
   * @param {string} libraryItemId
   * @param {string} [episodeId]
   */
  checkHasMediaItem(libraryItemId, episodeId) {
    if (!this.playlistMediaItems) {
      throw new Error('playlistMediaItems are required to check Playlist')
    }
    if (episodeId) {
      return this.playlistMediaItems.some((pmi) => pmi.mediaItemId === episodeId)
    }
    return this.playlistMediaItems.some((pmi) => pmi.mediaItem.libraryItem.id === libraryItemId)
  }

  toOldJSON() {
    return {
      id: this.id,
      name: this.name,
      libraryId: this.libraryId,
      userId: this.userId,
      description: this.description,
      lastUpdate: this.updatedAt.valueOf(),
      createdAt: this.createdAt.valueOf()
    }
  }

  toOldJSONExpanded() {
    if (!this.playlistMediaItems) {
      throw new Error('playlistMediaItems are required to expand Playlist')
    }

    const json = this.toOldJSON()
    json.items = this.playlistMediaItems.map((pmi) => {
      if (pmi.mediaItemType === 'book') {
        const libraryItem = pmi.mediaItem.libraryItem
        delete pmi.mediaItem.libraryItem
        libraryItem.media = pmi.mediaItem
        return {
          libraryItemId: libraryItem.id,
          libraryItem: libraryItem.toOldJSONExpanded()
        }
      }

      const libraryItem = pmi.mediaItem.podcast.libraryItem
      delete pmi.mediaItem.podcast.libraryItem
      libraryItem.media = pmi.mediaItem.podcast
      return {
        episodeId: pmi.mediaItemId,
        episode: pmi.mediaItem.toOldJSONExpanded(libraryItem.id),
        libraryItemId: libraryItem.id,
        libraryItem: libraryItem.toOldJSONMinified()
      }
    })

    return json
  }
}

module.exports = Playlist
