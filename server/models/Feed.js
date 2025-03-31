const Path = require('path')
const { DataTypes, Model } = require('sequelize')
const Logger = require('../Logger')

const RSS = require('../libs/rss')

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

    // Expanded properties

    /** @type {import('./FeedEpisode')[]} - only set if expanded */
    this.feedEpisodes
  }

  /**
   * @param {string} feedId
   * @returns {Promise<boolean>} - true if feed was removed
   */
  static async removeById(feedId) {
    return (
      (await this.destroy({
        where: {
          id: feedId
        }
      })) > 0
    )
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
  static getFeedObjForLibraryItem(userId, libraryItem, slug, serverAddress, feedOptions = null) {
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

    const feedObj = {
      slug,
      entityType: 'libraryItem',
      entityId: libraryItem.id,
      entityUpdatedAt,
      serverAddress,
      feedURL: `/feed/${slug}`,
      imageURL: media.coverPath ? `/feed/${slug}/cover${Path.extname(media.coverPath)}` : `/Logo.png`,
      siteURL: `/item/${libraryItem.id}`,
      title: media.title,
      description: media.description,
      author: libraryItem.mediaType === 'podcast' ? media.author : media.authorName,
      podcastType: libraryItem.mediaType === 'podcast' ? media.podcastType : 'serial',
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
  static async createFeedForLibraryItem(userId, libraryItem, slug, serverAddress, feedOptions) {
    const feedObj = this.getFeedObjForLibraryItem(userId, libraryItem, slug, serverAddress, feedOptions)

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
   * @param {FeedOptions} [feedOptions=null]
   *
   * @returns {{ feedObj: Feed, booksWithTracks: import('./Book').BookExpandedWithLibraryItem[] }}
   */
  static getFeedObjForCollection(userId, collectionExpanded, slug, serverAddress, feedOptions = null) {
    const booksWithTracks = collectionExpanded.books.filter((book) => book.includedAudioFiles.length)

    const entityUpdatedAt = booksWithTracks.reduce((mostRecent, book) => {
      const updatedAt = book.libraryItem.updatedAt > book.updatedAt ? book.libraryItem.updatedAt : book.updatedAt
      return updatedAt > mostRecent ? updatedAt : mostRecent
    }, collectionExpanded.updatedAt)

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
      entityUpdatedAt,
      serverAddress,
      feedURL: `/feed/${slug}`,
      imageURL: firstBookWithCover?.coverPath ? `/feed/${slug}/cover${Path.extname(firstBookWithCover.coverPath)}` : `/Logo.png`,
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
  static async createFeedForCollection(userId, collectionExpanded, slug, serverAddress, feedOptions) {
    const { feedObj, booksWithTracks } = this.getFeedObjForCollection(userId, collectionExpanded, slug, serverAddress, feedOptions)

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
   * @param {FeedOptions} [feedOptions=null]
   *
   * @returns {{ feedObj: Feed, booksWithTracks: import('./Book').BookExpandedWithLibraryItem[] }}
   */
  static getFeedObjForSeries(userId, seriesExpanded, slug, serverAddress, feedOptions = null) {
    const booksWithTracks = seriesExpanded.books.filter((book) => book.includedAudioFiles.length)
    const entityUpdatedAt = booksWithTracks.reduce((mostRecent, book) => {
      const updatedAt = book.libraryItem.updatedAt > book.updatedAt ? book.libraryItem.updatedAt : book.updatedAt
      return updatedAt > mostRecent ? updatedAt : mostRecent
    }, seriesExpanded.updatedAt)

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
      entityUpdatedAt,
      serverAddress,
      feedURL: `/feed/${slug}`,
      imageURL: firstBookWithCover?.coverPath ? `/feed/${slug}/cover${Path.extname(firstBookWithCover.coverPath)}` : `/Logo.png`,
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
  static async createFeedForSeries(userId, seriesExpanded, slug, serverAddress, feedOptions) {
    const { feedObj, booksWithTracks } = this.getFeedObjForSeries(userId, seriesExpanded, slug, serverAddress, feedOptions)

    /** @type {typeof import('./FeedEpisode')} */
    const feedEpisodeModel = this.sequelize.models.feedEpisode

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

  /**
   *
   * @returns {Promise<FeedExpanded>}
   */
  async updateFeedForEntity() {
    /** @type {typeof import('./FeedEpisode')} */
    const feedEpisodeModel = this.sequelize.models.feedEpisode

    let feedObj = null
    let feedEpisodeCreateFunc = null
    let feedEpisodeCreateFuncEntity = null

    if (this.entityType === 'libraryItem') {
      /** @type {typeof import('./LibraryItem')} */
      const libraryItemModel = this.sequelize.models.libraryItem

      const itemExpanded = await libraryItemModel.getExpandedById(this.entityId)
      feedObj = Feed.getFeedObjForLibraryItem(this.userId, itemExpanded, this.slug, this.serverAddress)

      feedEpisodeCreateFuncEntity = itemExpanded
      if (itemExpanded.mediaType === 'podcast') {
        feedEpisodeCreateFunc = feedEpisodeModel.createFromPodcastEpisodes.bind(feedEpisodeModel)
      } else {
        feedEpisodeCreateFunc = feedEpisodeModel.createFromAudiobookTracks.bind(feedEpisodeModel)
      }
    } else if (this.entityType === 'collection') {
      /** @type {typeof import('./Collection')} */
      const collectionModel = this.sequelize.models.collection

      const collectionExpanded = await collectionModel.getExpandedById(this.entityId)
      const feedObjData = Feed.getFeedObjForCollection(this.userId, collectionExpanded, this.slug, this.serverAddress)
      feedObj = feedObjData.feedObj
      feedEpisodeCreateFuncEntity = feedObjData.booksWithTracks
      feedEpisodeCreateFunc = feedEpisodeModel.createFromBooks.bind(feedEpisodeModel)
    } else if (this.entityType === 'series') {
      /** @type {typeof import('./Series')} */
      const seriesModel = this.sequelize.models.series

      const seriesExpanded = await seriesModel.getExpandedById(this.entityId)
      const feedObjData = Feed.getFeedObjForSeries(this.userId, seriesExpanded, this.slug, this.serverAddress)
      feedObj = feedObjData.feedObj
      feedEpisodeCreateFuncEntity = feedObjData.booksWithTracks
      feedEpisodeCreateFunc = feedEpisodeModel.createFromBooks.bind(feedEpisodeModel)
    } else {
      Logger.error(`[Feed] Invalid entity type ${this.entityType} for feed ${this.id}`)
      return null
    }

    const transaction = await this.sequelize.transaction()
    try {
      const updatedFeed = await this.update(feedObj, { transaction })

      const existingFeedEpisodeIds = this.feedEpisodes.map((ep) => ep.id)

      // Create new feed episodes
      updatedFeed.feedEpisodes = await feedEpisodeCreateFunc(feedEpisodeCreateFuncEntity, updatedFeed, this.slug, transaction)

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

  getEntity(options) {
    if (!this.entityType) return Promise.resolve(null)
    const mixinMethodName = `get${this.sequelize.uppercaseFirst(this.entityType)}`
    return this[mixinMethodName](options)
  }

  /**
   *
   * @param {string} hostPrefix
   */
  buildXml(hostPrefix) {
    const customElements = [
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

    const itunesOwnersData = []
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
    this.feedEpisodes.forEach((ep) => {
      rssfeed.item(ep.getRSSData(hostPrefix))
    })
    return rssfeed.xml()
  }

  /**
   *
   * @param {string} id
   * @returns {string}
   */
  getEpisodePath(id) {
    const episode = this.feedEpisodes.find((ep) => ep.id === id)
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

module.exports = Feed
