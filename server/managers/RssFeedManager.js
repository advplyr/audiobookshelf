const { Request, Response } = require('express')
const Path = require('path')

const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')

const fs = require('../libs/fsExtra')
const libraryItemsBookFilters = require('../utils/queries/libraryItemsBookFilters')

class RssFeedManager {
  constructor() {}

  async validateFeedEntity(feedObj) {
    if (feedObj.entityType === 'collection') {
      const collection = await Database.collectionModel.getOldById(feedObj.entityId)
      if (!collection) {
        Logger.error(`[RssFeedManager] Removing feed "${feedObj.id}". Collection "${feedObj.entityId}" not found`)
        return false
      }
    } else if (feedObj.entityType === 'libraryItem') {
      const libraryItemExists = await Database.libraryItemModel.checkExistsById(feedObj.entityId)
      if (!libraryItemExists) {
        Logger.error(`[RssFeedManager] Removing feed "${feedObj.id}". Library item "${feedObj.entityId}" not found`)
        return false
      }
    } else if (feedObj.entityType === 'series') {
      const series = await Database.seriesModel.findByPk(feedObj.entityId)
      if (!series) {
        Logger.error(`[RssFeedManager] Removing feed "${feedObj.id}". Series "${feedObj.entityId}" not found`)
        return false
      }
    } else {
      Logger.error(`[RssFeedManager] Removing feed "${feedObj.id}". Invalid entityType "${feedObj.entityType}"`)
      return false
    }
    return true
  }

  /**
   * Validate all feeds and remove invalid
   */
  async init() {
    const feeds = await Database.feedModel.getOldFeeds()
    for (const feed of feeds) {
      // Remove invalid feeds
      if (!(await this.validateFeedEntity(feed))) {
        await Database.removeFeed(feed.id)
      }
    }
  }

  /**
   * Find open feed for an entity (e.g. collection id, playlist id, library item id)
   * @param {string} entityId
   * @returns {Promise<objects.Feed>} oldFeed
   */
  findFeedForEntityId(entityId) {
    return Database.feedModel.findOneOld({ entityId })
  }

  /**
   * Find open feed for a slug
   * @param {string} slug
   * @returns {Promise<objects.Feed>} oldFeed
   */
  findFeedBySlug(slug) {
    return Database.feedModel.findOneOld({ slug })
  }

  /**
   * GET: /feed/:slug
   *
   * @param {Request} req
   * @param {Response} res
   */
  async getFeed(req, res) {
    const feed = await this.findFeedBySlug(req.params.slug)
    if (!feed) {
      Logger.warn(`[RssFeedManager] Feed not found ${req.params.slug}`)
      res.sendStatus(404)
      return
    }

    // Check if feed needs to be updated
    if (feed.entityType === 'libraryItem') {
      const libraryItem = await Database.libraryItemModel.getOldById(feed.entityId)

      let mostRecentlyUpdatedAt = libraryItem.updatedAt
      if (libraryItem.isPodcast) {
        libraryItem.media.episodes.forEach((episode) => {
          if (episode.updatedAt > mostRecentlyUpdatedAt) mostRecentlyUpdatedAt = episode.updatedAt
        })
      }

      if (libraryItem && (!feed.entityUpdatedAt || mostRecentlyUpdatedAt > feed.entityUpdatedAt)) {
        Logger.debug(`[RssFeedManager] Updating RSS feed for item ${libraryItem.id} "${libraryItem.media.metadata.title}"`)

        feed.updateFromItem(libraryItem)
        await Database.updateFeed(feed)
      }
    } else if (feed.entityType === 'collection') {
      const collection = await Database.collectionModel.findByPk(feed.entityId, {
        include: Database.collectionBookModel
      })
      if (collection) {
        const collectionExpanded = await collection.getOldJsonExpanded()

        // Find most recently updated item in collection
        let mostRecentlyUpdatedAt = collectionExpanded.lastUpdate
        // Check for most recently updated book
        collectionExpanded.books.forEach((libraryItem) => {
          if (libraryItem.media.tracks.length && libraryItem.updatedAt > mostRecentlyUpdatedAt) {
            mostRecentlyUpdatedAt = libraryItem.updatedAt
          }
        })
        // Check for most recently added collection book
        collection.collectionBooks.forEach((collectionBook) => {
          if (collectionBook.createdAt.valueOf() > mostRecentlyUpdatedAt) {
            mostRecentlyUpdatedAt = collectionBook.createdAt.valueOf()
          }
        })
        const hasBooksRemoved = collection.collectionBooks.length < feed.episodes.length

        if (!feed.entityUpdatedAt || hasBooksRemoved || mostRecentlyUpdatedAt > feed.entityUpdatedAt) {
          Logger.debug(`[RssFeedManager] Updating RSS feed for collection "${collection.name}"`)

          feed.updateFromCollection(collectionExpanded)
          await Database.updateFeed(feed)
        }
      }
    } else if (feed.entityType === 'series') {
      const series = await Database.seriesModel.findByPk(feed.entityId)
      if (series) {
        const seriesJson = series.toOldJSON()

        // Get books in series that have audio tracks
        seriesJson.books = (await libraryItemsBookFilters.getLibraryItemsForSeries(series)).filter((li) => li.media.numTracks)

        // Find most recently updated item in series
        let mostRecentlyUpdatedAt = seriesJson.updatedAt
        let totalTracks = 0 // Used to detect series items removed
        seriesJson.books.forEach((libraryItem) => {
          totalTracks += libraryItem.media.tracks.length
          if (libraryItem.media.tracks.length && libraryItem.updatedAt > mostRecentlyUpdatedAt) {
            mostRecentlyUpdatedAt = libraryItem.updatedAt
          }
        })
        if (totalTracks !== feed.episodes.length) {
          mostRecentlyUpdatedAt = Date.now()
        }

        if (!feed.entityUpdatedAt || mostRecentlyUpdatedAt > feed.entityUpdatedAt) {
          Logger.debug(`[RssFeedManager] Updating RSS feed for series "${seriesJson.name}"`)

          feed.updateFromSeries(seriesJson)
          await Database.updateFeed(feed)
        }
      }
    }

    const xml = feed.buildXml(req.originalHostPrefix)
    res.set('Content-Type', 'text/xml')
    res.send(xml)
  }

  /**
   * GET: /feed/:slug/item/:episodeId/*
   *
   * @param {Request} req
   * @param {Response} res
   */
  async getFeedItem(req, res) {
    const feed = await this.findFeedBySlug(req.params.slug)
    if (!feed) {
      Logger.debug(`[RssFeedManager] Feed not found ${req.params.slug}`)
      res.sendStatus(404)
      return
    }
    const episodePath = feed.getEpisodePath(req.params.episodeId)
    if (!episodePath) {
      Logger.error(`[RssFeedManager] Feed episode not found ${req.params.episodeId}`)
      res.sendStatus(404)
      return
    }
    res.sendFile(episodePath)
  }

  /**
   * GET: /feed/:slug/cover*
   *
   * @param {Request} req
   * @param {Response} res
   */
  async getFeedCover(req, res) {
    const feed = await this.findFeedBySlug(req.params.slug)
    if (!feed) {
      Logger.debug(`[RssFeedManager] Feed not found ${req.params.slug}`)
      res.sendStatus(404)
      return
    }

    if (!feed.coverPath) {
      res.sendStatus(404)
      return
    }

    const extname = Path.extname(feed.coverPath).toLowerCase().slice(1)
    res.type(`image/${extname}`)
    const readStream = fs.createReadStream(feed.coverPath)
    readStream.pipe(res)
  }

  /**
   *
   * @param {*} options
   * @returns {import('../models/Feed').FeedOptions}
   */
  getFeedOptionsFromReqOptions(options) {
    const metadataDetails = options.metadataDetails || {}

    if (metadataDetails.preventIndexing !== false) {
      metadataDetails.preventIndexing = true
    }

    return {
      preventIndexing: metadataDetails.preventIndexing,
      ownerName: metadataDetails.ownerName && typeof metadataDetails.ownerName === 'string' ? metadataDetails.ownerName : null,
      ownerEmail: metadataDetails.ownerEmail && typeof metadataDetails.ownerEmail === 'string' ? metadataDetails.ownerEmail : null
    }
  }

  /**
   *
   * @param {string} userId
   * @param {import('../models/LibraryItem')} libraryItem
   * @param {*} options
   * @returns {Promise<import('../models/Feed').FeedExpanded>}
   */
  async openFeedForItem(userId, libraryItem, options) {
    const serverAddress = options.serverAddress
    const slug = options.slug
    const feedOptions = this.getFeedOptionsFromReqOptions(options)

    Logger.info(`[RssFeedManager] Creating RSS feed for item ${libraryItem.id} "${libraryItem.media.title}"`)
    const feedExpanded = await Database.feedModel.createFeedForLibraryItem(userId, libraryItem, slug, serverAddress, feedOptions)
    if (feedExpanded) {
      Logger.info(`[RssFeedManager] Opened RSS feed "${feedExpanded.feedURL}"`)
      SocketAuthority.emitter('rss_feed_open', feedExpanded.toOldJSONMinified())
    }
    return feedExpanded
  }

  /**
   *
   * @param {string} userId
   * @param {import('../models/Collection')} collectionExpanded
   * @param {*} options
   * @returns {Promise<import('../models/Feed').FeedExpanded>}
   */
  async openFeedForCollection(userId, collectionExpanded, options) {
    const serverAddress = options.serverAddress
    const slug = options.slug
    const feedOptions = this.getFeedOptionsFromReqOptions(options)

    Logger.info(`[RssFeedManager] Creating RSS feed for collection "${collectionExpanded.name}"`)
    const feedExpanded = await Database.feedModel.createFeedForCollection(userId, collectionExpanded, slug, serverAddress, feedOptions)
    if (feedExpanded) {
      Logger.info(`[RssFeedManager] Opened RSS feed "${feedExpanded.feedURL}"`)
      SocketAuthority.emitter('rss_feed_open', feedExpanded.toOldJSONMinified())
    }
    return feedExpanded
  }

  /**
   *
   * @param {string} userId
   * @param {import('../models/Series')} seriesExpanded
   * @param {*} options
   * @returns {Promise<import('../models/Feed').FeedExpanded>}
   */
  async openFeedForSeries(userId, seriesExpanded, options) {
    const serverAddress = options.serverAddress
    const slug = options.slug
    const feedOptions = this.getFeedOptionsFromReqOptions(options)

    Logger.info(`[RssFeedManager] Creating RSS feed for series "${seriesExpanded.name}"`)
    const feedExpanded = await Database.feedModel.createFeedForSeries(userId, seriesExpanded, slug, serverAddress, feedOptions)
    if (feedExpanded) {
      Logger.info(`[RssFeedManager] Opened RSS feed "${feedExpanded.feedURL}"`)
      SocketAuthority.emitter('rss_feed_open', feedExpanded.toOldJSONMinified())
    }
    return feedExpanded
  }

  /**
   * Close Feed and emit Socket event
   *
   * @param {import('../models/Feed')} feed
   * @returns {Promise<boolean>} - true if feed was closed
   */
  async handleCloseFeed(feed) {
    if (!feed) return false
    const wasRemoved = await Database.feedModel.removeById(feed.id)
    SocketAuthority.emitter('rss_feed_closed', feed.toOldJSONMinified())
    Logger.info(`[RssFeedManager] Closed RSS feed "${feed.feedURL}"`)
    return wasRemoved
  }

  /**
   *
   * @param {string} entityId
   * @returns {Promise<boolean>} - true if feed was closed
   */
  async closeFeedForEntityId(entityId) {
    const feed = await Database.feedModel.findOne({
      where: {
        entityId
      }
    })
    if (!feed) {
      Logger.warn(`[RssFeedManager] closeFeedForEntityId: Feed not found for entity id ${entityId}`)
      return false
    }
    return this.handleCloseFeed(feed)
  }

  /**
   *
   * @param {string[]} entityIds
   */
  async closeFeedsForEntityIds(entityIds) {
    const feeds = await Database.feedModel.findAll({
      where: {
        entityId: entityIds
      }
    })
    for (const feed of feeds) {
      await this.handleCloseFeed(feed)
    }
  }

  async getFeeds() {
    const feeds = await Database.models.feed.getOldFeeds()
    Logger.info(`[RssFeedManager] Fetched all feeds`)
    return feeds
  }
}
module.exports = new RssFeedManager()
