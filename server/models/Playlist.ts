import { DataTypes, Model, Op } from 'sequelize'
import type { Attributes, BuildOptions, HasManyGetAssociationsMixin, InitOptions, ModelAttributes, ModelStatic, Optional, Sequelize } from 'sequelize'
import type Book from './Book'
import type Podcast from './Podcast'
import type PodcastEpisode from './PodcastEpisode'
import type PlaylistMediaItem from './PlaylistMediaItem'
import Logger from '../Logger'
import SocketAuthority from '../SocketAuthority'

type PlaylistAttributes = {
  id: string
  name: string | null
  description: string | null
  libraryId?: string | null
  userId?: string | null
  createdAt?: Date
  updatedAt?: Date
}
type PlaylistCreation = Optional<PlaylistAttributes, keyof PlaylistAttributes>
// Legacy library item serializers remain JavaScript; preserve their result at this boundary.
type PlaylistLibraryItem = { id: string; media: Book | Podcast; toOldJSONExpanded(): unknown; toOldJSONMinified(): unknown }
type LegacyPlaylistItem = { libraryItemId: string; libraryItem: unknown; episodeId?: string | null; episode?: ReturnType<PodcastEpisode['toOldJSONExpanded']> }
type LegacyPlaylist = ReturnType<Playlist['toOldJSON']> & { items?: LegacyPlaylistItem[] }

class Playlist extends Model<PlaylistAttributes, PlaylistCreation> {
  declare static sequelize: Sequelize
  declare id: string
  declare name: string | null
  declare description: string | null
  declare libraryId: string | null
  declare userId: string | null
  declare createdAt: Date
  declare updatedAt: Date
  declare playlistMediaItems?: PlaylistMediaItem[]
  declare getPlaylistMediaItems: HasManyGetAssociationsMixin<PlaylistMediaItem>

  constructor(values?: PlaylistCreation, options?: BuildOptions) {
    super(values, options)
  }

  /**
   * Get old playlists for user and library
   *
   * @param {string} userId
   * @param {string} libraryId
   * @async
   */
  static async getOldPlaylistsForUserAndLibrary(userId: string | null, libraryId: string | null) {
    if (!userId && !libraryId) return []

    const whereQuery: { userId?: string; libraryId?: string } = {}
    if (userId) {
      whereQuery.userId = userId
    }
    if (libraryId) {
      whereQuery.libraryId = libraryId
    }
    // Sequelize normalizes single includes to arrays; use the same normalized form for typing.
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
            include: [{
              model: this.sequelize.models.podcast,
              include: [this.sequelize.models.libraryItem]
            }]
          }
        ]
      },
      order: [['playlistMediaItems', 'order', 'ASC']]
    })

    // Sort by name asc
    playlistsExpanded.sort((a, b) => a.name!.localeCompare(b.name!))

    return playlistsExpanded.map((playlist) => playlist.toOldJSONExpanded())
  }

  /**
   * Get number of playlists for a user and library
   * @param {string} userId
   * @param {string} libraryId
   * @returns
   */
  static async getNumPlaylistsForUserAndLibrary(userId: string, libraryId: string) {
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
  static async getPlaylistsForMediaItemIds(mediaItemIds: string[]) {
    if (!mediaItemIds?.length) return []

    // This query always includes the owning playlist and its media items.
    const playlistMediaItemModel = this.sequelize.models.playlistMediaItem as ModelStatic<PlaylistMediaItem & { playlist: Playlist }>
    const playlistMediaItemsExpanded = await playlistMediaItemModel.findAll({
      where: {
        mediaItemId: {
          [Op.in]: mediaItemIds
        }
      },
      include: [
        {
          model: this.sequelize.models.playlist,
          include: [{
            model: this.sequelize.models.playlistMediaItem,
            include: [
              {
                model: this.sequelize.models.book,
                include: [this.sequelize.models.libraryItem]
              },
              {
                model: this.sequelize.models.podcastEpisode,
                include: [{
                  model: this.sequelize.models.podcast,
                  include: [this.sequelize.models.libraryItem]
                }]
              }
            ]
          }]
        }
      ],
      order: [['playlist', 'playlistMediaItems', 'order', 'ASC']]
    })

    const playlists: Playlist[] = []
    for (const playlistMediaItem of playlistMediaItemsExpanded) {
      const playlist = playlistMediaItem.playlist
      if (playlists.some((p) => p.id === playlist.id)) continue

      playlist.playlistMediaItems = playlist.playlistMediaItems!.map((pmi) => {
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
  static async removeMediaItemsFromPlaylists(mediaItemIds: string[]) {
    if (!mediaItemIds?.length) return

    const playlistsWithItem = await this.getPlaylistsForMediaItemIds(mediaItemIds)

    if (!playlistsWithItem.length) return

    for (const playlist of playlistsWithItem) {
      let numMediaItems = playlist.playlistMediaItems!.length

      let order = 1
      // Remove items in playlist and re-order
      for (const playlistMediaItem of playlist.playlistMediaItems!) {
        if (mediaItemIds.includes(playlistMediaItem.mediaItemId!)) {
          await playlistMediaItem.destroy()
          numMediaItems--
        } else {
          if (playlistMediaItem.order !== order) {
            void playlistMediaItem.update({
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
  static init(sequelize: Sequelize): void
  // Keep Sequelize's inherited static contract; application initialization uses one argument.
  static init<MS extends ModelStatic<Model>, M extends InstanceType<MS>>(
    this: MS, attributes: ModelAttributes<M, Partial<Attributes<M>>>, options: InitOptions<M>
  ): MS
  static init(sequelizeOrAttributes: Sequelize | ModelAttributes): void | ModelStatic<Model> {
    // Database.buildModels always supplies the Sequelize instance.
    const sequelize = sequelizeOrAttributes as Sequelize
    super.init<typeof Playlist, Playlist>(
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

    Playlist.addHook('afterFind', (findResult: Playlist | readonly Playlist[] | null) => {
      if (!findResult) return

      // Sequelize types result arrays as readonly; retain the runtime array check.
      const isArray: (value: Playlist | readonly Playlist[]) => value is readonly Playlist[] = Array.isArray
      if (!isArray(findResult)) findResult = [findResult]

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
              include: [this.sequelize.models.libraryItem]
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
  checkHasMediaItem(libraryItemId: string, episodeId?: string) {
    if (!this.playlistMediaItems) {
      throw new Error('playlistMediaItems are required to check Playlist')
    }
    if (episodeId) {
      return this.playlistMediaItems.some((pmi) => pmi.mediaItemId === episodeId)
    }
    return this.playlistMediaItems.some((pmi) => (pmi.mediaItem as Book).libraryItem!.id === libraryItemId)
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

    const json: LegacyPlaylist = this.toOldJSON()
    json.items = this.playlistMediaItems.map((pmi) => {
      if (pmi.mediaItemType === 'book') {
        // The includes above load a book and its library item for this discriminator.
        const mediaItem = pmi.mediaItem as Book
        const libraryItem = mediaItem.libraryItem as PlaylistLibraryItem
        delete mediaItem.libraryItem
        libraryItem.media = mediaItem
        return {
          libraryItemId: libraryItem.id,
          libraryItem: libraryItem.toOldJSONExpanded()
        }
      }

      // Podcast entries include the episode, its podcast and the podcast's library item.
      const mediaItem = pmi.mediaItem as PodcastEpisode
      const libraryItem = mediaItem.podcast!.libraryItem as PlaylistLibraryItem
      delete mediaItem.podcast!.libraryItem
      libraryItem.media = mediaItem.podcast!
      return {
        episodeId: pmi.mediaItemId,
        episode: mediaItem.toOldJSONExpanded(libraryItem.id),
        libraryItemId: libraryItem.id,
        libraryItem: libraryItem.toOldJSONMinified()
      }
    })

    return json
  }
}

export = Playlist
