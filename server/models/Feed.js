const Path = require('path')
const { DataTypes, Model } = require('sequelize')
const oldFeed = require('../objects/Feed')
const areEquivalent = require('../utils/areEquivalent')

/**
 * @typedef FeedOptions
 * @property {boolean} preventIndexing
 * @property {string} ownerName
 * @property {string} ownerEmail
 */

/**
 * @typedef FeedExpandedProperties
 * @property {import('./FeedEpisode')} feedEpisodes
 *
 * @typedef {Feed & FeedExpandedProperties} FeedExpanded
 */

class Feed extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {UUIDV4} */
    this.id
    /** @type {string} */
    this.slug
    /** @type {string} */
    this.entityType
    /** @type {UUIDV4} */
    this.entityId
    /** @type {Date} */
    this.entityUpdatedAt
    /** @type {string} */
    this.serverAddress
    /** @type {string} */
    this.feedURL
    /** @type {string} */
    this.imageURL
    /** @type {string} */
    this.siteURL
    /** @type {string} */
    this.title
    /** @type {string} */
    this.description
    /** @type {string} */
    this.author
    /** @type {string} */
    this.podcastType
    /** @type {string} */
    this.language
    /** @type {string} */
    this.ownerName
    /** @type {string} */
    this.ownerEmail
    /** @type {boolean} */
    this.explicit
    /** @type {boolean} */
    this.preventIndexing
    /** @type {string} */
    this.coverPath
    /** @type {UUIDV4} */
    this.userId
    /** @type {Date} */
    this.createdAt
    /** @type {Date} */
    this.updatedAt

    /** @type {import('./FeedEpisode')[]} - only set if expanded */
    this.feedEpisodes
  }

  static async getOldFeeds() {
    const feeds = await this.findAll({
      include: {
        model: this.sequelize.models.feedEpisode
      }
    })
    return feeds.map((f) => this.getOldFeed(f))
  }

  /**
   * Get old feed from Feed and optionally Feed with FeedEpisodes
   * @param {Feed} feedExpanded
   * @returns {oldFeed}
   */
  static getOldFeed(feedExpanded) {
    const episodes = feedExpanded.feedEpisodes?.map((feedEpisode) => feedEpisode.getOldEpisode()) || []

    // Sort episodes by pubDate. Newest to oldest for episodic, oldest to newest for serial
    if (feedExpanded.podcastType === 'episodic') {
      episodes.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    } else {
      episodes.sort((a, b) => new Date(a.pubDate) - new Date(b.pubDate))
    }

    return new oldFeed({
      id: feedExpanded.id,
      slug: feedExpanded.slug,
      userId: feedExpanded.userId,
      entityType: feedExpanded.entityType,
      entityId: feedExpanded.entityId,
      entityUpdatedAt: feedExpanded.entityUpdatedAt?.valueOf() || null,
      coverPath: feedExpanded.coverPath || null,
      meta: {
        title: feedExpanded.title,
        description: feedExpanded.description,
        author: feedExpanded.author,
        imageUrl: feedExpanded.imageURL,
        feedUrl: feedExpanded.feedURL,
        link: feedExpanded.siteURL,
        explicit: feedExpanded.explicit,
        type: feedExpanded.podcastType,
        language: feedExpanded.language,
        preventIndexing: feedExpanded.preventIndexing,
        ownerName: feedExpanded.ownerName,
        ownerEmail: feedExpanded.ownerEmail
      },
      serverAddress: feedExpanded.serverAddress,
      feedUrl: feedExpanded.feedURL,
      episodes,
      createdAt: feedExpanded.createdAt.valueOf(),
      updatedAt: feedExpanded.updatedAt.valueOf()
    })
  }

  static removeById(feedId) {
    return this.destroy({
      where: {
        id: feedId
      }
    })
  }

  /**
   * Find all library item ids that have an open feed (used in library filter)
   * @returns {Promise<string[]>} array of library item ids
   */
  static async findAllLibraryItemIds() {
    const feeds = await this.findAll({
      attributes: ['entityId'],
      where: {
        entityType: 'libraryItem'
      }
    })
    return feeds.map((f) => f.entityId).filter((f) => f) || []
  }

  /**
   * Find feed where and return oldFeed
   * @param {Object} where sequelize where object
   * @returns {Promise<oldFeed>} oldFeed
   */
  static async findOneOld(where) {
    if (!where) return null
    const feedExpanded = await this.findOne({
      where,
      include: {
        model: this.sequelize.models.feedEpisode
      }
    })
    if (!feedExpanded) return null
    return this.getOldFeed(feedExpanded)
  }

  /**
   * Find feed and return oldFeed
   * @param {string} id
   * @returns {Promise<oldFeed>} oldFeed
   */
  static async findByPkOld(id) {
    if (!id) return null
    const feedExpanded = await this.findByPk(id, {
      include: {
        model: this.sequelize.models.feedEpisode
      }
    })
    if (!feedExpanded) return null
    return this.getOldFeed(feedExpanded)
  }

  static async fullCreateFromOld(oldFeed) {
    const feedObj = this.getFromOld(oldFeed)
    const newFeed = await this.create(feedObj)

    if (oldFeed.episodes?.length) {
      for (const oldFeedEpisode of oldFeed.episodes) {
        const feedEpisode = this.sequelize.models.feedEpisode.getFromOld(oldFeedEpisode)
        feedEpisode.feedId = newFeed.id
        await this.sequelize.models.feedEpisode.create(feedEpisode)
      }
    }
  }

  static async fullUpdateFromOld(oldFeed) {
    const oldFeedEpisodes = oldFeed.episodes || []
    const feedObj = this.getFromOld(oldFeed)

    const existingFeed = await this.findByPk(feedObj.id, {
      include: this.sequelize.models.feedEpisode
    })
    if (!existingFeed) return false

    let hasUpdates = false

    // Remove and update existing feed episodes
    for (const feedEpisode of existingFeed.feedEpisodes) {
      const oldFeedEpisode = oldFeedEpisodes.find((ep) => ep.id === feedEpisode.id)
      // Episode removed
      if (!oldFeedEpisode) {
        feedEpisode.destroy()
      } else {
        let episodeHasUpdates = false
        const oldFeedEpisodeCleaned = this.sequelize.models.feedEpisode.getFromOld(oldFeedEpisode)
        for (const key in oldFeedEpisodeCleaned) {
          if (!areEquivalent(oldFeedEpisodeCleaned[key], feedEpisode[key])) {
            episodeHasUpdates = true
          }
        }
        if (episodeHasUpdates) {
          await feedEpisode.update(oldFeedEpisodeCleaned)
          hasUpdates = true
        }
      }
    }

    // Add new feed episodes
    for (const episode of oldFeedEpisodes) {
      if (!existingFeed.feedEpisodes.some((fe) => fe.id === episode.id)) {
        await this.sequelize.models.feedEpisode.createFromOld(feedObj.id, episode)
        hasUpdates = true
      }
    }

    let feedHasUpdates = false
    for (const key in feedObj) {
      let existingValue = existingFeed[key]
      if (existingValue instanceof Date) existingValue = existingValue.valueOf()

      if (!areEquivalent(existingValue, feedObj[key])) {
        feedHasUpdates = true
      }
    }

    if (feedHasUpdates) {
      await existingFeed.update(feedObj)
      hasUpdates = true
    }

    return hasUpdates
  }

  static getFromOld(oldFeed) {
    const oldFeedMeta = oldFeed.meta || {}
    return {
      id: oldFeed.id,
      slug: oldFeed.slug,
      entityType: oldFeed.entityType,
      entityId: oldFeed.entityId,
      entityUpdatedAt: oldFeed.entityUpdatedAt,
      serverAddress: oldFeed.serverAddress,
      feedURL: oldFeed.feedUrl,
      coverPath: oldFeed.coverPath || null,
      imageURL: oldFeedMeta.imageUrl,
      siteURL: oldFeedMeta.link,
      title: oldFeedMeta.title,
      description: oldFeedMeta.description,
      author: oldFeedMeta.author,
      podcastType: oldFeedMeta.type || null,
      language: oldFeedMeta.language || null,
      ownerName: oldFeedMeta.ownerName || null,
      ownerEmail: oldFeedMeta.ownerEmail || null,
      explicit: !!oldFeedMeta.explicit,
      preventIndexing: !!oldFeedMeta.preventIndexing,
      userId: oldFeed.userId
    }
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
  static async createFeedForLibraryItem(userId, libraryItem, slug, serverAddress, feedOptions) {
    const media = libraryItem.media

    const feedObj = {
      slug,
      entityType: 'libraryItem',
      entityId: libraryItem.id,
      entityUpdatedAt: libraryItem.updatedAt,
      serverAddress,
      feedURL: `/feed/${slug}`,
      imageURL: media.coverPath ? `/feed/${slug}/cover${Path.extname(media.coverPath)}` : `/Logo.png`,
      siteURL: `/item/${libraryItem.id}`,
      title: media.title,
      description: media.description,
      author: libraryItem.mediaType === 'podcast' ? media.author : media.authorName,
      podcastType: libraryItem.mediaType === 'podcast' ? media.podcastType : 'serial',
      language: media.language,
      preventIndexing: feedOptions.preventIndexing,
      ownerName: feedOptions.ownerName,
      ownerEmail: feedOptions.ownerEmail,
      explicit: media.explicit,
      coverPath: media.coverPath,
      userId
    }

    /** @type {typeof import('./FeedEpisode')} */
    const feedEpisodeModel = this.sequelize.models.feedEpisode

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
   * @param {FeedOptions} feedOptions
   *
   * @returns {Promise<FeedExpanded>}
   */
  static async createFeedForCollection(userId, collectionExpanded, slug, serverAddress, feedOptions) {
    const booksWithTracks = collectionExpanded.books.filter((book) => book.includedAudioFiles.length)
    const libraryItemMostRecentlyUpdatedAt = booksWithTracks.reduce((mostRecent, book) => {
      return book.libraryItem.updatedAt > mostRecent.libraryItem.updatedAt ? book : mostRecent
    }).libraryItem.updatedAt

    const firstBookWithCover = booksWithTracks.find((book) => book.coverPath)

    const allBookAuthorNames = booksWithTracks.reduce((authorNames, book) => {
      const bookAuthorsToAdd = book.authors.filter((author) => !authorNames.includes(author.name)).map((author) => author.name)
      return authorNames.concat(bookAuthorsToAdd)
    }, [])
    let author = allBookAuthorNames.slice(0, 3).join(', ')
    if (allBookAuthorNames.length > 3) {
      author += ' & more'
    }

    const feedObj = {
      slug,
      entityType: 'collection',
      entityId: collectionExpanded.id,
      entityUpdatedAt: libraryItemMostRecentlyUpdatedAt,
      serverAddress,
      feedURL: `/feed/${slug}`,
      imageURL: firstBookWithCover?.coverPath ? `/feed/${slug}/cover${Path.extname(firstBookWithCover.coverPath)}` : `/Logo.png`,
      siteURL: `/collection/${collectionExpanded.id}`,
      title: collectionExpanded.name,
      description: collectionExpanded.description || '',
      author,
      podcastType: 'serial',
      preventIndexing: feedOptions.preventIndexing,
      ownerName: feedOptions.ownerName,
      ownerEmail: feedOptions.ownerEmail,
      explicit: booksWithTracks.some((book) => book.explicit), // If any book is explicit, the feed is explicit
      coverPath: firstBookWithCover?.coverPath || null,
      userId
    }

    /** @type {typeof import('./FeedEpisode')} */
    const feedEpisodeModel = this.sequelize.models.feedEpisode

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
   * @param {FeedOptions} feedOptions
   *
   * @returns {Promise<FeedExpanded>}
   */
  static async createFeedForSeries(userId, seriesExpanded, slug, serverAddress, feedOptions) {
    const booksWithTracks = seriesExpanded.books.filter((book) => book.includedAudioFiles.length)
    const libraryItemMostRecentlyUpdatedAt = booksWithTracks.reduce((mostRecent, book) => {
      return book.libraryItem.updatedAt > mostRecent.libraryItem.updatedAt ? book : mostRecent
    }).libraryItem.updatedAt

    const firstBookWithCover = booksWithTracks.find((book) => book.coverPath)

    const allBookAuthorNames = booksWithTracks.reduce((authorNames, book) => {
      const bookAuthorsToAdd = book.authors.filter((author) => !authorNames.includes(author.name)).map((author) => author.name)
      return authorNames.concat(bookAuthorsToAdd)
    }, [])
    let author = allBookAuthorNames.slice(0, 3).join(', ')
    if (allBookAuthorNames.length > 3) {
      author += ' & more'
    }

    const feedObj = {
      slug,
      entityType: 'series',
      entityId: seriesExpanded.id,
      entityUpdatedAt: libraryItemMostRecentlyUpdatedAt,
      serverAddress,
      feedURL: `/feed/${slug}`,
      imageURL: firstBookWithCover?.coverPath ? `/feed/${slug}/cover${Path.extname(firstBookWithCover.coverPath)}` : `/Logo.png`,
      siteURL: `/library/${booksWithTracks[0].libraryItem.libraryId}/series/${seriesExpanded.id}`,
      title: seriesExpanded.name,
      description: seriesExpanded.description || '',
      author,
      podcastType: 'serial',
      preventIndexing: feedOptions.preventIndexing,
      ownerName: feedOptions.ownerName,
      ownerEmail: feedOptions.ownerEmail,
      explicit: booksWithTracks.some((book) => book.explicit), // If any book is explicit, the feed is explicit
      coverPath: firstBookWithCover?.coverPath || null,
      userId
    }

    /** @type {typeof import('./FeedEpisode')} */
    const feedEpisodeModel = this.sequelize.models.feedEpisode

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
   * Initialize model
   *
   * Polymorphic association: Feeds can be created from LibraryItem, Collection, Playlist or Series
   * @see https://sequelize.org/docs/v6/advanced-association-concepts/polymorphic-associations/
   *
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

    Feed.addHook('afterFind', (findResult) => {
      if (!findResult) return

      if (!Array.isArray(findResult)) findResult = [findResult]
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

  getEntity(options) {
    if (!this.entityType) return Promise.resolve(null)
    const mixinMethodName = `get${this.sequelize.uppercaseFirst(this.entityType)}`
    return this[mixinMethodName](options)
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

module.exports = Feed
