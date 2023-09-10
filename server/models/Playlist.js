const { DataTypes, Model, Op, literal } = require('sequelize')
const Logger = require('../Logger')

const oldPlaylist = require('../objects/Playlist')

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
  }

  static async getOldPlaylists() {
    const playlists = await this.findAll({
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

  /**
   * Get old playlist toJSONExpanded
   * @param {[string[]]} include
   * @returns {Promise<object>} oldPlaylist.toJSONExpanded
   */
  async getOldJsonExpanded(include) {
    this.playlistMediaItems = await this.getPlaylistMediaItems({
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
      ],
      order: [['order', 'ASC']]
    }) || []

    const oldPlaylist = this.sequelize.models.playlist.getOldPlaylist(this)
    const libraryItemIds = oldPlaylist.items.map(i => i.libraryItemId)

    let libraryItems = await this.sequelize.models.libraryItem.getAllOldLibraryItems({
      id: libraryItemIds
    })

    const playlistExpanded = oldPlaylist.toJSONExpanded(libraryItems)

    if (include?.includes('rssfeed')) {
      const feeds = await this.getFeeds()
      if (feeds?.length) {
        playlistExpanded.rssFeed = this.sequelize.models.feed.getOldFeed(feeds[0])
      }
    }

    return playlistExpanded
  }

  static createFromOld(oldPlaylist) {
    const playlist = this.getFromOld(oldPlaylist)
    return this.create(playlist)
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
   * @returns {Promise<Playlist[]>}
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
      },
      order: [
        [literal('name COLLATE NOCASE'), 'ASC'],
        ['playlistMediaItems', 'order', 'ASC']
      ]
    })
    return playlists
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
      if (playlists.some(p => p.id === playlist.id)) continue

      playlist.playlistMediaItems = playlist.playlistMediaItems.map(pmi => {
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
   * Initialize model
   * @param {import('../Database').sequelize} sequelize 
   */
  static init(sequelize) {
    super.init({
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

    user.hasMany(Playlist, {
      onDelete: 'CASCADE'
    })
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
  }
}

module.exports = Playlist