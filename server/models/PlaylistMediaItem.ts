import { DataTypes, Model } from 'sequelize'
import type { BelongsToGetAssociationMixin, FindOptions } from 'sequelize'
import type Book from './Book'
import type PodcastEpisode from './PodcastEpisode'
import type { Attributes, BuildOptions, InitOptions, ModelAttributes, ModelStatic, Optional, Sequelize } from 'sequelize'

type PlaylistMediaItemAttributes = {
  id: string
  mediaItemId: string | null
  mediaItemType: string | null
  order: number | null
  playlistId?: string | null
  createdAt?: Date
  book?: Book | null
  podcastEpisode?: PodcastEpisode | null
  mediaItem?: Book | PodcastEpisode | null
}

type PlaylistMediaItemCreation = Optional<PlaylistMediaItemAttributes, 'id' | 'mediaItemId' | 'mediaItemType' | 'order' | 'playlistId' | 'createdAt'>

class PlaylistMediaItem extends Model<PlaylistMediaItemAttributes, PlaylistMediaItemCreation> {
  declare id: string
  declare mediaItemId: string | null
  declare mediaItemType: string | null
  declare order: number | null
  declare playlistId: string | null
  declare createdAt: Date

  declare book?: Book | null
  declare podcastEpisode?: PodcastEpisode | null
  declare mediaItem?: Book | PodcastEpisode | null
  declare getBook: BelongsToGetAssociationMixin<Book>
  declare getPodcastEpisode: BelongsToGetAssociationMixin<PodcastEpisode>

  constructor(values?: PlaylistMediaItemCreation, options?: BuildOptions) {
    super(values, options)
  }

  getMediaItem(options?: FindOptions) {
    if (!this.mediaItemType) return Promise.resolve(null)
    const mixinMethodName = `get${this.sequelize.uppercaseFirst(this.mediaItemType)}`
    // The persisted discriminator selects one of the two association mixins.
    return this[mixinMethodName as 'getBook' | 'getPodcastEpisode'](options)
  }

  /**
   * Initialize model
   * @param {import('../Database').sequelize} sequelize
   */
  static init(sequelize: Sequelize): void
  // Retain Sequelize's static signature for its polymorphic model methods.
  // Application code uses the single-argument initializer, as before migration.
  static init<MS extends ModelStatic<Model>, M extends InstanceType<MS>>(
    this: MS,
    attributes: ModelAttributes<M, Partial<Attributes<M>>>,
    options: InitOptions<M>
  ): MS
  static init(sequelizeOrAttributes: Sequelize | ModelAttributes): void | ModelStatic<Model> {
    // Database.buildModels supplies a Sequelize instance; the other overload preserves
    // the inherited static contract required by Sequelize's generic query methods.
    const sequelize = sequelizeOrAttributes as Sequelize
    super.init<typeof PlaylistMediaItem, PlaylistMediaItem>(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        mediaItemId: DataTypes.UUID,
        mediaItemType: DataTypes.STRING,
        order: DataTypes.INTEGER
      },
      {
        sequelize,
        timestamps: true,
        updatedAt: false,
        modelName: 'playlistMediaItem'
      }
    )

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

    PlaylistMediaItem.addHook('afterFind', (findResult: PlaylistMediaItem | readonly PlaylistMediaItem[] | null) => {
      if (!findResult) return

      // Sequelize types results as readonly arrays; retain Array.isArray's runtime check.
      const isArray: (value: PlaylistMediaItem | readonly PlaylistMediaItem[]) => value is readonly PlaylistMediaItem[] = Array.isArray
      if (!isArray(findResult)) findResult = [findResult]

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

    playlist.hasMany(PlaylistMediaItem, {
      onDelete: 'CASCADE'
    })
    PlaylistMediaItem.belongsTo(playlist)
  }
}

export = PlaylistMediaItem
