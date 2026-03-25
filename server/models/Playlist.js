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
          },
          {
            model: this.sequelize.models.series
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
              },
              {
                model: this.sequelize.models.series
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
        } else if (pmi.mediaItemType === 'series' && pmi.series !== undefined) {
          pmi.mediaItem = pmi.series
          pmi.dataValues.mediaItem = pmi.dataValues.series
        }
        delete pmi.book
        delete pmi.dataValues.book
        delete pmi.podcastEpisode
        delete pmi.dataValues.podcastEpisode
        delete pmi.series
        delete pmi.dataValues.series
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
   * Removes series entries from playlists and re-orders
   *
   * @param {string[]} seriesIds
   */
  static async removeSeriesFromPlaylists(seriesIds) {
    if (!seriesIds?.length) return

    const playlistMediaItems = await this.sequelize.models.playlistMediaItem.findAll({
      where: {
        mediaItemType: 'series',
        mediaItemId: {
          [Op.in]: seriesIds
        }
      },
      include: {
        model: this.sequelize.models.playlist
      }
    })

    if (!playlistMediaItems.length) return

    // Group by playlist
    const playlistMap = new Map()
    for (const pmi of playlistMediaItems) {
      if (!playlistMap.has(pmi.playlist.id)) {
        playlistMap.set(pmi.playlist.id, { playlist: pmi.playlist, pmiIds: [] })
      }
      playlistMap.get(pmi.playlist.id).pmiIds.push(pmi.id)
      await pmi.destroy()
    }

    for (const { playlist, pmiIds } of playlistMap.values()) {
      // Re-order remaining items
      const remainingPmis = await this.sequelize.models.playlistMediaItem.findAll({
        where: { playlistId: playlist.id },
        order: [['order', 'ASC']]
      })

      let order = 1
      for (const pmi of remainingPmis) {
        if (pmi.order !== order) {
          await pmi.update({ order })
        }
        order++
      }

      const jsonExpanded = await playlist.getOldJsonExpanded()
      if (!remainingPmis.length) {
        Logger.info(`[Playlist] Playlist "${playlist.name}" has no more items - removing it`)
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
            } else if (pmi.mediaItemType === 'series' && pmi.series !== undefined) {
              pmi.mediaItem = pmi.series
              pmi.dataValues.mediaItem = pmi.dataValues.series
            }
            // To prevent mistakes:
            delete pmi.book
            delete pmi.dataValues.book
            delete pmi.podcastEpisode
            delete pmi.dataValues.podcastEpisode
            delete pmi.series
            delete pmi.dataValues.series
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
        },
        {
          model: this.sequelize.models.series
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
    return this.playlistMediaItems.some((pmi) => pmi.mediaItem?.libraryItem?.id === libraryItemId)
  }

  /**
   * Check if playlist has a series entry
   *
   * @param {string} seriesId
   * @returns {boolean}
   */
  checkHasSeries(seriesId) {
    if (!this.playlistMediaItems) {
      throw new Error('playlistMediaItems are required to check Playlist')
    }
    return this.playlistMediaItems.some((pmi) => pmi.mediaItemType === 'series' && pmi.mediaItemId === seriesId)
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

    // Build entries first (before items processing mutates pmi.mediaItem)
    json.entries = this.playlistMediaItems.map((pmi) => {
      if (pmi.mediaItemType === 'series') {
        return {
          type: 'series',
          seriesId: pmi.mediaItemId,
          seriesName: pmi.mediaItem.name,
          order: pmi.order
        }
      }

      // libraryItem entry (book or podcastEpisode)
      let libraryItemId = null
      if (pmi.mediaItemType === 'book') {
        libraryItemId = pmi.mediaItem?.libraryItem?.id || null
      } else if (pmi.mediaItemType === 'podcastEpisode') {
        libraryItemId = pmi.mediaItem?.podcast?.libraryItem?.id || null
      }
      return {
        type: 'libraryItem',
        libraryItemId,
        episodeId: pmi.mediaItemType === 'podcastEpisode' ? pmi.mediaItemId : null,
        order: pmi.order
      }
    })

    // items: backward-compatible array with only book/episode entries (destructive to pmi.mediaItem)
    json.items = this.playlistMediaItems
      .filter((pmi) => pmi.mediaItemType !== 'series')
      .map((pmi) => {
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
