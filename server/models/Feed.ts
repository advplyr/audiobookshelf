import Path from 'path'
import { DataTypes, Model } from 'sequelize'
import type { Attributes, BelongsToGetAssociationMixin, BuildOptions, FindOptions, InitOptions, ModelAttributes, ModelStatic, Optional, Sequelize, Transaction } from 'sequelize'
import type Book from './Book'
import type { BookExpanded, BookExpandedWithLibraryItem } from './Book'
import type Podcast from './Podcast'
import type { PodcastExpanded } from './Podcast'
import type LibraryItem from './LibraryItem'
import type Collection from './Collection'
import type Series from './Series'
import type Playlist from './Playlist'
import type FeedEpisode from './FeedEpisode'
import Logger from '../Logger'
import RSS from '../libs/rss'
import type { CustomElement } from '../libs/rss'

type FeedOptions = { preventIndexing: boolean; ownerName: string; ownerEmail: string }
type FeedExpandedProperties = { feedEpisodes: FeedEpisode[] }
type FeedExpanded = Feed & FeedExpandedProperties
type FeedLibraryItem = (LibraryItem & { mediaType: 'podcast'; media: PodcastExpanded }) | (LibraryItem & { mediaType: 'book'; media: BookExpanded })
type FeedCollection = Omit<Collection, 'books'> & { books: BookExpandedWithLibraryItem[] }
type FeedSeries = Omit<Series, 'books'> & { books: BookExpandedWithLibraryItem[] }
type FeedSource = FeedLibraryItem | BookExpandedWithLibraryItem[]
type EpisodeCreator = (source: FeedSource, feed: Feed, slug: string, transaction?: Transaction) => Promise<FeedEpisode[]>
type FeedAttributes = {
  id: string
  slug: string | null
  entityType: string | null
  entityId: string | null
  serverAddress: string | null
  feedURL: string | null
  imageURL: string | null
  siteURL: string | null
  title: string | null
  description: string | null
  author: string | null
  podcastType: string | null
  language: string | null
  ownerName: string | null
  ownerEmail: string | null
  coverPath: string | null
  entityUpdatedAt: Date | null
  explicit: boolean | null
  preventIndexing: boolean | null
  userId?: string | null
  createdAt?: Date
  updatedAt?: Date
  libraryItem?: LibraryItem | null
  collection?: Collection | null
  series?: Series | null
  playlist?: Playlist | null
  entity?: LibraryItem | Collection | Series | Playlist | null
}
type FeedCreation = Optional<FeedAttributes, keyof FeedAttributes>

class Feed extends Model<FeedAttributes, FeedCreation> {
  declare static sequelize: Sequelize
  declare id: string
  declare slug: string | null
  declare entityType: string | null
  declare entityId: string | null
  declare serverAddress: string | null
  declare feedURL: string | null
  declare imageURL: string | null
  declare siteURL: string | null
  declare title: string | null
  declare description: string | null
  declare author: string | null
  declare podcastType: string | null
  declare language: string | null
  declare ownerName: string | null
  declare ownerEmail: string | null
  declare coverPath: string | null
  declare entityUpdatedAt: Date | null
  declare explicit: boolean | null
  declare preventIndexing: boolean | null
  declare userId: string | null
  declare createdAt: Date
  declare updatedAt: Date
  declare feedEpisodes?: FeedEpisode[]
  declare libraryItem?: LibraryItem | null
  declare collection?: Collection | null
  declare series?: Series | null
  declare playlist?: Playlist | null
  declare entity?: LibraryItem | Collection | Series | Playlist | null
  declare getLibraryItem: BelongsToGetAssociationMixin<LibraryItem>
  declare getCollection: BelongsToGetAssociationMixin<Collection>
  declare getSeries: BelongsToGetAssociationMixin<Series>
  declare getPlaylist: BelongsToGetAssociationMixin<Playlist>

  constructor(values?: FeedCreation, options?: BuildOptions) {
    super(values, options)
  }

  /**
   * @param {string} feedId
   * @returns {Promise<boolean>} - true if feed was removed
   */
  static async removeById(feedId: string) {
    return (
      (await this.destroy({
        where: {
          id: feedId
        }
      })) > 0
    )
  }

  /**
   * @param {string} slug
   * @param {string|null|undefined} coverPath
   * @param {Date|null|undefined} entityUpdatedAt
   * @returns {string}
   */
  static getFeedImageURL(slug: string | null, coverPath?: string | null, entityUpdatedAt?: Date | null) {
    if (!coverPath) return '/Logo.png'
    const cacheBuster = entityUpdatedAt != null ? `?ts=${entityUpdatedAt.valueOf()}` : ''
    return `/feed/${slug}/cover${Path.extname(coverPath)}${cacheBuster}`
  }

  /**
   *
   * @param {string} userId
   * @param {import('./LibraryItem').LibraryItemExpanded} libraryItem
   * @param {string} slug
   * @param {string} serverAddress
   * @param {FeedOptions} [feedOptions=null]
   *
   * @returns {Feed}
   */
  static getFeedObjForLibraryItem(userId: string | null, libraryItem: FeedLibraryItem, slug: string, serverAddress: string, feedOptions: FeedOptions | null = null) {
    const media = libraryItem.media

    let entityUpdatedAt = libraryItem.updatedAt

    // Podcast feeds should use the most recent episode updatedAt if more recent
    if (libraryItem.mediaType === 'podcast') {
      entityUpdatedAt = libraryItem.media.podcastEpisodes.reduce((mostRecent, episode) => {
        return episode.updatedAt > mostRecent ? episode.updatedAt : mostRecent
      }, entityUpdatedAt)
    } else if (libraryItem.media.updatedAt > entityUpdatedAt) {
      // Book feeds will use Book.updatedAt if more recent
      entityUpdatedAt = libraryItem.media.updatedAt
    }

    const feedObj: FeedCreation = {
      slug,
      entityType: 'libraryItem',
      entityId: libraryItem.id,
      entityUpdatedAt,
      serverAddress,
      feedURL: `/feed/${slug}`,
      imageURL: Feed.getFeedImageURL(slug, media.coverPath, entityUpdatedAt),
      siteURL: `/item/${libraryItem.id}`,
      title: media.title,
      description: media.description,
      author: libraryItem.mediaType === 'podcast' ? (media as Podcast).author : (media as Book).authorName,
      podcastType: libraryItem.mediaType === 'podcast' ? (media as Podcast).podcastType : 'serial',
      language: media.language,
      explicit: media.explicit,
      coverPath: media.coverPath,
      userId
    }

    if (feedOptions) {
      feedObj.preventIndexing = feedOptions.preventIndexing
      feedObj.ownerName = feedOptions.ownerName
      feedObj.ownerEmail = feedOptions.ownerEmail
    }

    return feedObj
  }

  /**
   *
   * @param {string} userId
   * @param {import('./LibraryItem').LibraryItemExpanded} libraryItem
   * @param {string} slug
   * @param {string} serverAddress
   * @param {FeedOptions} feedOptions
   *
   * @returns {Promise<FeedExpanded>}
   */
  static async createFeedForLibraryItem(userId: string | null, libraryItem: FeedLibraryItem, slug: string, serverAddress: string, feedOptions?: FeedOptions | null) {
    const feedObj = this.getFeedObjForLibraryItem(userId, libraryItem, slug, serverAddress, feedOptions)

    /** @type {typeof import('./FeedEpisode')} */
    const feedEpisodeModel = this.sequelize.models.feedEpisode as typeof FeedEpisode

    const transaction = await this.sequelize.transaction()
    try {
      const feed = await this.create(feedObj, { transaction })

      if (libraryItem.mediaType === 'podcast') {
        feed.feedEpisodes = await feedEpisodeModel.createFromPodcastEpisodes(libraryItem, feed, slug, transaction)
      } else {
        feed.feedEpisodes = await feedEpisodeModel.createFromAudiobookTracks(libraryItem, feed, slug, transaction)
      }

      await transaction.commit()

      return feed
    } catch (error) {
      Logger.error(`[Feed] Error creating feed for library item ${libraryItem.id}`, error)
      await transaction.rollback()
      return null
    }
  }

  /**
   *
   * @param {string} userId
   * @param {import('./Collection')} collectionExpanded
   * @param {string} slug
   * @param {string} serverAddress
   * @param {FeedOptions} [feedOptions=null]
   *
   * @returns {{ feedObj: Feed, booksWithTracks: import('./Book').BookExpandedWithLibraryItem[] }}
   */
  static getFeedObjForCollection(userId: string | null, collectionExpanded: FeedCollection, slug: string, serverAddress: string, feedOptions: FeedOptions | null = null) {
    const booksWithTracks = collectionExpanded.books.filter((book) => book.includedAudioFiles.length)

    const entityUpdatedAt = booksWithTracks.reduce((mostRecent, book) => {
      const updatedAt = book.libraryItem.updatedAt > book.updatedAt ? book.libraryItem.updatedAt : book.updatedAt
      return updatedAt > mostRecent ? updatedAt : mostRecent
    }, collectionExpanded.updatedAt)

    const firstBookWithCover = booksWithTracks.find((book) => book.coverPath)

    const allBookAuthorNames = booksWithTracks.reduce<(string | null)[]>((authorNames, book) => {
      const bookAuthorsToAdd = book.authors.filter((author) => !authorNames.includes(author.name)).map((author) => author.name)
      return authorNames.concat(bookAuthorsToAdd)
    }, [])
    let author = allBookAuthorNames.slice(0, 3).join(', ')
    if (allBookAuthorNames.length > 3) {
      author += ' & more'
    }

    const feedObj: FeedCreation = {
      slug,
      entityType: 'collection',
      entityId: collectionExpanded.id,
      entityUpdatedAt,
      serverAddress,
      feedURL: `/feed/${slug}`,
      imageURL: Feed.getFeedImageURL(slug, firstBookWithCover?.coverPath, entityUpdatedAt),
      siteURL: `/collection/${collectionExpanded.id}`,
      title: collectionExpanded.name,
      description: collectionExpanded.description || '',
      author,
      podcastType: 'serial',
      explicit: booksWithTracks.some((book) => book.explicit), // If any book is explicit, the feed is explicit
      coverPath: firstBookWithCover?.coverPath || null,
      userId
    }

    if (feedOptions) {
      feedObj.preventIndexing = feedOptions.preventIndexing
      feedObj.ownerName = feedOptions.ownerName
      feedObj.ownerEmail = feedOptions.ownerEmail
    }

    return {
      feedObj,
      booksWithTracks
    }
  }

  /**
   *
   * @param {string} userId
   * @param {import('./Collection')} collectionExpanded
   * @param {string} slug
   * @param {string} serverAddress
   * @param {FeedOptions} feedOptions
   *
   * @returns {Promise<FeedExpanded>}
   */
  static async createFeedForCollection(userId: string | null, collectionExpanded: FeedCollection, slug: string, serverAddress: string, feedOptions?: FeedOptions | null) {
    const { feedObj, booksWithTracks } = this.getFeedObjForCollection(userId, collectionExpanded, slug, serverAddress, feedOptions)

    /** @type {typeof import('./FeedEpisode')} */
    const feedEpisodeModel = this.sequelize.models.feedEpisode as typeof FeedEpisode

    const transaction = await this.sequelize.transaction()
    try {
      const feed = await this.create(feedObj, { transaction })
      feed.feedEpisodes = await feedEpisodeModel.createFromBooks(booksWithTracks, feed, slug, transaction)

      await transaction.commit()

      return feed
    } catch (error) {
      Logger.error(`[Feed] Error creating feed for collection ${collectionExpanded.id}`, error)
      await transaction.rollback()
      return null
    }
  }

  /**
   *
   * @param {string} userId
   * @param {import('./Series')} seriesExpanded
   * @param {string} slug
   * @param {string} serverAddress
   * @param {FeedOptions} [feedOptions=null]
   *
   * @returns {{ feedObj: Feed, booksWithTracks: import('./Book').BookExpandedWithLibraryItem[] }}
   */
  static getFeedObjForSeries(userId: string | null, seriesExpanded: FeedSeries, slug: string, serverAddress: string, feedOptions: FeedOptions | null = null) {
    const booksWithTracks = seriesExpanded.books.filter((book) => book.includedAudioFiles.length)
    const entityUpdatedAt = booksWithTracks.reduce((mostRecent, book) => {
      const updatedAt = book.libraryItem.updatedAt > book.updatedAt ? book.libraryItem.updatedAt : book.updatedAt
      return updatedAt > mostRecent ? updatedAt : mostRecent
    }, seriesExpanded.updatedAt)

    const firstBookWithCover = booksWithTracks.find((book) => book.coverPath)

    const allBookAuthorNames = booksWithTracks.reduce<(string | null)[]>((authorNames, book) => {
      const bookAuthorsToAdd = book.authors.filter((author) => !authorNames.includes(author.name)).map((author) => author.name)
      return authorNames.concat(bookAuthorsToAdd)
    }, [])
    let author = allBookAuthorNames.slice(0, 3).join(', ')
    if (allBookAuthorNames.length > 3) {
      author += ' & more'
    }

    const feedObj: FeedCreation = {
      slug,
      entityType: 'series',
      entityId: seriesExpanded.id,
      entityUpdatedAt,
      serverAddress,
      feedURL: `/feed/${slug}`,
      imageURL: Feed.getFeedImageURL(slug, firstBookWithCover?.coverPath, entityUpdatedAt),
      siteURL: `/library/${booksWithTracks[0].libraryItem.libraryId}/series/${seriesExpanded.id}`,
      title: seriesExpanded.name,
      description: seriesExpanded.description || '',
      author,
      podcastType: 'serial',
      explicit: booksWithTracks.some((book) => book.explicit), // If any book is explicit, the feed is explicit
      coverPath: firstBookWithCover?.coverPath || null,
      userId
    }

    if (feedOptions) {
      feedObj.preventIndexing = feedOptions.preventIndexing
      feedObj.ownerName = feedOptions.ownerName
      feedObj.ownerEmail = feedOptions.ownerEmail
    }

    return {
      feedObj,
      booksWithTracks
    }
  }

  /**
   *
   * @param {string} userId
   * @param {import('./Series')} seriesExpanded
   * @param {string} slug
   * @param {string} serverAddress
   * @param {FeedOptions} feedOptions
   *
   * @returns {Promise<FeedExpanded>}
   */
  static async createFeedForSeries(userId: string | null, seriesExpanded: FeedSeries, slug: string, serverAddress: string, feedOptions?: FeedOptions | null) {
    const { feedObj, booksWithTracks } = this.getFeedObjForSeries(userId, seriesExpanded, slug, serverAddress, feedOptions)

    /** @type {typeof import('./FeedEpisode')} */
    const feedEpisodeModel = this.sequelize.models.feedEpisode as typeof FeedEpisode

    const transaction = await this.sequelize.transaction()
    try {
      const feed = await this.create(feedObj, { transaction })
      feed.feedEpisodes = await feedEpisodeModel.createFromBooks(booksWithTracks, feed, slug, transaction)

      await transaction.commit()

      return feed
    } catch (error) {
      Logger.error(`[Feed] Error creating feed for series ${seriesExpanded.id}`, error)
      await transaction.rollback()
      return null
    }
  }

  /**
   * Initialize model
   *
   * Polymorphic association: Feeds can be created from LibraryItem, Collection, Playlist or Series
   * @see https://sequelize.org/docs/v6/advanced-association-concepts/polymorphic-associations/
   *
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
    super.init<typeof Feed, Feed>(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        slug: DataTypes.STRING,
        entityType: DataTypes.STRING,
        entityId: DataTypes.UUID,
        entityUpdatedAt: DataTypes.DATE,
        serverAddress: DataTypes.STRING,
        feedURL: DataTypes.STRING,
        imageURL: DataTypes.STRING,
        siteURL: DataTypes.STRING,
        title: DataTypes.STRING,
        description: DataTypes.TEXT,
        author: DataTypes.STRING,
        podcastType: DataTypes.STRING,
        language: DataTypes.STRING,
        ownerName: DataTypes.STRING,
        ownerEmail: DataTypes.STRING,
        explicit: DataTypes.BOOLEAN,
        preventIndexing: DataTypes.BOOLEAN,
        coverPath: DataTypes.STRING
      },
      {
        sequelize,
        modelName: 'feed'
      }
    )

    const { user, libraryItem, collection, series, playlist } = sequelize.models

    user.hasMany(Feed)
    Feed.belongsTo(user)

    libraryItem.hasMany(Feed, {
      foreignKey: 'entityId',
      constraints: false,
      scope: {
        entityType: 'libraryItem'
      }
    })
    Feed.belongsTo(libraryItem, { foreignKey: 'entityId', constraints: false })

    collection.hasMany(Feed, {
      foreignKey: 'entityId',
      constraints: false,
      scope: {
        entityType: 'collection'
      }
    })
    Feed.belongsTo(collection, { foreignKey: 'entityId', constraints: false })

    series.hasMany(Feed, {
      foreignKey: 'entityId',
      constraints: false,
      scope: {
        entityType: 'series'
      }
    })
    Feed.belongsTo(series, { foreignKey: 'entityId', constraints: false })

    playlist.hasMany(Feed, {
      foreignKey: 'entityId',
      constraints: false,
      scope: {
        entityType: 'playlist'
      }
    })
    Feed.belongsTo(playlist, { foreignKey: 'entityId', constraints: false })

    Feed.addHook('afterFind', (findResult: Feed | readonly Feed[] | null) => {
      if (!findResult) return

      const isArray: (value: Feed | readonly Feed[]) => value is readonly Feed[] = Array.isArray
      if (!isArray(findResult)) findResult = [findResult]
      for (const instance of findResult) {
        if (instance.entityType === 'libraryItem' && instance.libraryItem !== undefined) {
          instance.entity = instance.libraryItem
          instance.dataValues.entity = instance.dataValues.libraryItem
        } else if (instance.entityType === 'collection' && instance.collection !== undefined) {
          instance.entity = instance.collection
          instance.dataValues.entity = instance.dataValues.collection
        } else if (instance.entityType === 'series' && instance.series !== undefined) {
          instance.entity = instance.series
          instance.dataValues.entity = instance.dataValues.series
        } else if (instance.entityType === 'playlist' && instance.playlist !== undefined) {
          instance.entity = instance.playlist
          instance.dataValues.entity = instance.dataValues.playlist
        }

        // To prevent mistakes:
        delete instance.libraryItem
        delete instance.dataValues.libraryItem
        delete instance.collection
        delete instance.dataValues.collection
        delete instance.series
        delete instance.dataValues.series
        delete instance.playlist
        delete instance.dataValues.playlist
      }
    })
  }

  /**
   *
   * @returns {Promise<FeedExpanded>}
   */
  async updateFeedForEntity() {
    /** @type {typeof import('./FeedEpisode')} */
    const feedEpisodeModel = this.sequelize.models.feedEpisode as typeof FeedEpisode

    let feedObj: FeedCreation | null = null
    // Each entity branch pairs its bound creator with the matching expanded source.
    let feedEpisodeCreateFunc: EpisodeCreator | null = null
    let feedEpisodeCreateFuncEntity: FeedSource | null = null

    if (this.entityType === 'libraryItem') {
      /** @type {typeof import('./LibraryItem')} */
      // Expanded query boundary for the remaining JavaScript library item model.
      const libraryItemModel = this.sequelize.models.libraryItem as unknown as { getExpandedById(id: string): Promise<FeedLibraryItem | null> }

      const itemExpanded = await libraryItemModel.getExpandedById(this.entityId!)
      feedObj = Feed.getFeedObjForLibraryItem(this.userId, itemExpanded!, this.slug!, this.serverAddress!)

      feedEpisodeCreateFuncEntity = itemExpanded!
      if (itemExpanded!.mediaType === 'podcast') {
        feedEpisodeCreateFunc = feedEpisodeModel.createFromPodcastEpisodes.bind(feedEpisodeModel) as EpisodeCreator
      } else {
        feedEpisodeCreateFunc = feedEpisodeModel.createFromAudiobookTracks.bind(feedEpisodeModel) as EpisodeCreator
      }
    } else if (this.entityType === 'collection') {
      /** @type {typeof import('./Collection')} */
      const collectionModel = this.sequelize.models.collection as typeof Collection

      const collectionExpanded = await collectionModel.getExpandedById(this.entityId!) as FeedCollection
      const feedObjData = Feed.getFeedObjForCollection(this.userId, collectionExpanded, this.slug!, this.serverAddress!)
      feedObj = feedObjData.feedObj
      feedEpisodeCreateFuncEntity = feedObjData.booksWithTracks
      feedEpisodeCreateFunc = feedEpisodeModel.createFromBooks.bind(feedEpisodeModel) as EpisodeCreator
    } else if (this.entityType === 'series') {
      /** @type {typeof import('./Series')} */
      const seriesModel = this.sequelize.models.series as typeof Series

      const seriesExpanded = await seriesModel.getExpandedById(this.entityId!) as FeedSeries
      const feedObjData = Feed.getFeedObjForSeries(this.userId, seriesExpanded, this.slug!, this.serverAddress!)
      feedObj = feedObjData.feedObj
      feedEpisodeCreateFuncEntity = feedObjData.booksWithTracks
      feedEpisodeCreateFunc = feedEpisodeModel.createFromBooks.bind(feedEpisodeModel) as EpisodeCreator
    } else {
      Logger.error(`[Feed] Invalid entity type ${this.entityType} for feed ${this.id}`)
      return null
    }

    const transaction = await this.sequelize.transaction()
    try {
      const updatedFeed = await this.update(feedObj, { transaction })

      const existingFeedEpisodeIds = this.feedEpisodes!.map((ep) => ep.id)

      // Create new feed episodes
      updatedFeed.feedEpisodes = await feedEpisodeCreateFunc(feedEpisodeCreateFuncEntity, updatedFeed, this.slug!, transaction)

      const newFeedEpisodeIds = updatedFeed.feedEpisodes.map((ep) => ep.id)
      const feedEpisodeIdsToRemove = existingFeedEpisodeIds.filter((epid) => !newFeedEpisodeIds.includes(epid))

      if (feedEpisodeIdsToRemove.length) {
        Logger.info(`[Feed] Removing ${feedEpisodeIdsToRemove.length} episodes from feed ${this.id}`)
        await feedEpisodeModel.destroy({
          where: {
            id: feedEpisodeIdsToRemove
          },
          transaction
        })
      }

      await transaction.commit()

      return updatedFeed
    } catch (error) {
      Logger.error(`[Feed] Error updating feed ${this.entityId}`, error)
      await transaction.rollback()

      return null
    }
  }

  getEntity(options?: FindOptions) {
    if (!this.entityType) return Promise.resolve(null)
    const mixinMethodName = `get${this.sequelize.uppercaseFirst(this.entityType)}`
    // The discriminator selects the corresponding registered association mixin.
    return this[mixinMethodName as 'getLibraryItem' | 'getCollection' | 'getSeries' | 'getPlaylist'](options)
  }

  /**
   *
   * @param {string} hostPrefix
   */
  buildXml(hostPrefix: string) {
    const customElements: CustomElement[] = [
      { language: this.language || 'en' },
      { author: this.author || 'advplyr' },
      { 'itunes:author': this.author || 'advplyr' },
      { 'itunes:type': this.podcastType || 'serial' },
      {
        'itunes:image': {
          _attr: {
            href: `${hostPrefix}${this.imageURL}`
          }
        }
      },
      { 'itunes:explicit': !!this.explicit }
    ]

    if (this.description) {
      customElements.push({ 'itunes:summary': { _cdata: this.description } })
    }

    const itunesOwnersData: CustomElement[] = []
    if (this.ownerName || this.author) {
      itunesOwnersData.push({ 'itunes:name': this.ownerName || this.author })
    }
    if (this.ownerEmail) {
      itunesOwnersData.push({ 'itunes:email': this.ownerEmail })
    }
    if (itunesOwnersData.length) {
      customElements.push({
        'itunes:owner': itunesOwnersData
      })
    }

    if (this.preventIndexing) {
      customElements.push({ 'itunes:block': 'yes' }, { 'googleplay:block': 'yes' })
    }

    const rssData = {
      title: this.title,
      description: this.description || '',
      generator: 'Audiobookshelf',
      feed_url: `${hostPrefix}${this.feedURL}`,
      site_url: `${hostPrefix}${this.siteURL}`,
      image_url: `${hostPrefix}${this.imageURL}`,
      custom_namespaces: {
        itunes: 'http://www.itunes.com/dtds/podcast-1.0.dtd',
        podcast: 'https://podcastindex.org/namespace/1.0',
        googleplay: 'http://www.google.com/schemas/play-podcasts/1.0'
      },
      custom_elements: customElements
    }

    const rssfeed = new RSS(rssData)
    this.feedEpisodes!.forEach((ep) => {
      rssfeed.item(ep.getRSSData(hostPrefix))
    })
    return rssfeed.xml()
  }

  /**
   *
   * @param {string} id
   * @returns {string}
   */
  getEpisodePath(id: string) {
    const episode = this.feedEpisodes!.find((ep) => ep.id === id)
    if (!episode) return null
    return episode.filePath
  }

  toOldJSON() {
    const episodes = this.feedEpisodes?.map((feedEpisode) => feedEpisode.getOldEpisode())
    return {
      id: this.id,
      slug: this.slug,
      userId: this.userId,
      entityType: this.entityType,
      entityId: this.entityId,
      entityUpdatedAt: this.entityUpdatedAt?.valueOf() || null,
      coverPath: this.coverPath || null,
      meta: {
        title: this.title,
        description: this.description,
        author: this.author,
        imageUrl: this.imageURL,
        feedUrl: this.feedURL,
        link: this.siteURL,
        explicit: this.explicit,
        type: this.podcastType,
        language: this.language,
        preventIndexing: this.preventIndexing,
        ownerName: this.ownerName,
        ownerEmail: this.ownerEmail
      },
      serverAddress: this.serverAddress,
      feedUrl: this.feedURL,
      episodes: episodes || [],
      createdAt: this.createdAt.valueOf(),
      updatedAt: this.updatedAt.valueOf()
    }
  }

  toOldJSONMinified() {
    return {
      id: this.id,
      entityType: this.entityType,
      entityId: this.entityId,
      feedUrl: this.feedURL,
      meta: {
        title: this.title,
        description: this.description,
        preventIndexing: this.preventIndexing,
        ownerName: this.ownerName,
        ownerEmail: this.ownerEmail
      }
    }
  }
}

declare namespace Feed {
  export type { FeedOptions, FeedExpandedProperties, FeedExpanded }
}

export = Feed
