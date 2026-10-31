import { DataTypes, Model } from 'sequelize'
import type { Attributes, BelongsToGetAssociationMixin, BindOrReplacements, BuildOptions, FindOptions, IncludeOptions, InitOptions, WhereOptions, ModelAttributes, ModelStatic, Optional, Sequelize } from 'sequelize'
import type Book from './Book'
import type PodcastEpisode from './PodcastEpisode'
import type { LibraryItemExpanded } from './LibraryItem'

type ExpandedLibraryItemLookup = {
  findOneExpanded(where: WhereOptions, replacements: BindOrReplacements | null, include: IncludeOptions): Promise<LibraryItemExpanded | null>
}

type ShareAttributes = {
  id: string
  mediaItemId: string | null
  mediaItemType: string | null
  slug: string | null
  pash: string | null
  userId?: string | null
  expiresAt: Date | null
  extraData: unknown
  createdAt?: Date
  updatedAt?: Date
  isDownloadable: boolean | null
  book?: Book | null
  podcastEpisode?: PodcastEpisode | null
  mediaItem?: Book | PodcastEpisode | null
}

type ShareCreation = Optional<ShareAttributes, 'id' | 'mediaItemId' | 'mediaItemType' | 'slug' | 'pash' | 'userId' | 'expiresAt' | 'extraData' | 'createdAt' | 'updatedAt' | 'isDownloadable'>

class MediaItemShare extends Model<ShareAttributes, ShareCreation> {
  // Query methods are used after Database.buildModels initializes the model.
  declare static sequelize: Sequelize
  declare id: string
  declare mediaItemId: string | null
  declare mediaItemType: string | null
  declare slug: string | null
  declare pash: string | null
  declare userId: string | null
  declare expiresAt: Date | null
  declare extraData: unknown
  declare createdAt: Date
  declare updatedAt: Date
  declare isDownloadable: boolean | null
  declare book?: Book | null
  declare podcastEpisode?: PodcastEpisode | null
  declare mediaItem?: Book | PodcastEpisode | null
  declare getBook: BelongsToGetAssociationMixin<Book>
  declare getPodcastEpisode: BelongsToGetAssociationMixin<PodcastEpisode>

  constructor(values?: ShareCreation, options?: BuildOptions) {
    super(values, options)
  }

  toJSONForClient() {
    return {
      id: this.id,
      mediaItemId: this.mediaItemId,
      mediaItemType: this.mediaItemType,
      slug: this.slug,
      expiresAt: this.expiresAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      isDownloadable: this.isDownloadable
    }
  }

  /**
   * Expanded book that includes library settings
   *
   * @param {string} mediaItemId
   * @param {string} mediaItemType
   * @returns {Promise<import('./LibraryItem').LibraryItemExpanded>}
   */
  static async getMediaItemsLibraryItem(mediaItemId: string, mediaItemType: string): Promise<LibraryItemExpanded | null> {
    /** @type {typeof import('./LibraryItem')} */
    // Database.buildModels registers LibraryItem; its legacy JSDoc omits the accepted null replacement argument.
    const libraryItemModel = this.sequelize.models.libraryItem as unknown as ExpandedLibraryItemLookup

    if (mediaItemType === 'book') {
      const libraryItem = await libraryItemModel.findOneExpanded({ mediaId: mediaItemId }, null, {
        model: this.sequelize.models.library,
        attributes: ['settings']
      })

      return libraryItem
    }
    return null
  }

  /**
   *
   * @param {import('sequelize').FindOptions} options
   * @returns {Promise<import('./Book')|import('./PodcastEpisode')>}
   */
  getMediaItem(options?: FindOptions) {
    if (!this.mediaItemType) return Promise.resolve(null)
    const mixinMethodName = `get${this.sequelize.uppercaseFirst(this.mediaItemType)}`
    // The persisted discriminator selects one of the two association mixins.
    return this[mixinMethodName as 'getBook' | 'getPodcastEpisode'](options)
  }

  /**
   * Initialize model
   *
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
    super.init<typeof MediaItemShare, MediaItemShare>(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        mediaItemId: DataTypes.UUID,
        mediaItemType: DataTypes.STRING,
        slug: DataTypes.STRING,
        pash: DataTypes.STRING,
        expiresAt: DataTypes.DATE,
        extraData: DataTypes.JSON,
        isDownloadable: DataTypes.BOOLEAN
      },
      {
        sequelize,
        modelName: 'mediaItemShare'
      }
    )

    const { user, book, podcastEpisode } = sequelize.models

    user.hasMany(MediaItemShare)
    MediaItemShare.belongsTo(user)

    book.hasMany(MediaItemShare, {
      foreignKey: 'mediaItemId',
      constraints: false,
      scope: {
        mediaItemType: 'book'
      }
    })
    MediaItemShare.belongsTo(book, { foreignKey: 'mediaItemId', constraints: false })

    podcastEpisode.hasOne(MediaItemShare, {
      foreignKey: 'mediaItemId',
      constraints: false,
      scope: {
        mediaItemType: 'podcastEpisode'
      }
    })
    MediaItemShare.belongsTo(podcastEpisode, { foreignKey: 'mediaItemId', constraints: false })

    MediaItemShare.addHook('afterFind', (findResult: MediaItemShare | readonly MediaItemShare[] | null) => {
      if (!findResult) return

      // Sequelize types results as readonly arrays; retain Array.isArray's runtime check.
      const isArray: (value: MediaItemShare | readonly MediaItemShare[]) => value is readonly MediaItemShare[] = Array.isArray
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
  }
}

declare namespace MediaItemShare {
  export type MediaItemShareObject = Pick<MediaItemShare, keyof Omit<ShareAttributes, 'book' | 'podcastEpisode' | 'mediaItem'>>
  export type MediaItemShareModel = MediaItemShare
  export type MediaItemShareForClient = ReturnType<MediaItemShare['toJSONForClient']>
}

export = MediaItemShare
