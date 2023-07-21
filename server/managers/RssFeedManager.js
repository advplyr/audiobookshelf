const Path = require('path')

const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')

const fs = require('../libs/fsExtra')
const Feed = require('../objects/Feed')

class RssFeedManager {
  constructor() { }

  validateFeedEntity(feedObj) {
    if (feedObj.entityType === 'collection') {
      if (!Database.collections.some(li => li.id === feedObj.entityId)) {
        Logger.error(`[RssFeedManager] Removing feed "${feedObj.id}". Collection "${feedObj.entityId}" not found`)
        return false
      }
    } else if (feedObj.entityType === 'libraryItem') {
      if (!Database.libraryItems.some(li => li.id === feedObj.entityId)) {
        Logger.error(`[RssFeedManager] Removing feed "${feedObj.id}". Library item "${feedObj.entityId}" not found`)
        return false
      }
    } else if (feedObj.entityType === 'series') {
      const series = Database.series.find(s => s.id === feedObj.entityId)
      const hasSeriesBook = series ? Database.libraryItems.some(li => li.mediaType === 'book' && li.media.metadata.hasSeries(series.id) && li.media.tracks.length) : false
      if (!hasSeriesBook) {
        Logger.error(`[RssFeedManager] Removing feed "${feedObj.id}". Series "${feedObj.entityId}" not found or has no audio tracks`)
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
    const feeds = await Database.models.feed.getOldFeeds()
    for (const feed of feeds) {
      // Remove invalid feeds
      if (!this.validateFeedEntity(feed)) {
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
    return Database.models.feed.findOneOld({ entityId })
  }

  /**
   * Find open feed for a slug
   * @param {string} slug 
   * @returns {Promise<objects.Feed>} oldFeed
   */
  findFeedBySlug(slug) {
    return Database.models.feed.findOneOld({ slug })
  }

  /**
   * Find open feed for a slug
   * @param {string} slug 
   * @returns {Promise<objects.Feed>} oldFeed
   */
  findFeed(id) {
    return Database.models.feed.findByPkOld(id)
  }

  async getFeed(req, res) {
    const feed = await this.findFeedBySlug(req.params.slug)
    if (!feed) {
      Logger.warn(`[RssFeedManager] Feed not found ${req.params.slug}`)
      res.sendStatus(404)
      return
    }

    // Check if feed needs to be updated
    if (feed.entityType === 'libraryItem') {
      const libraryItem = Database.getLibraryItem(feed.entityId)

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
      const collection = Database.collections.find(c => c.id === feed.entityId)
      if (collection) {
        const collectionExpanded = collection.toJSONExpanded(Database.libraryItems)

        // Find most recently updated item in collection
        let mostRecentlyUpdatedAt = collectionExpanded.lastUpdate
        collectionExpanded.books.forEach((libraryItem) => {
          if (libraryItem.media.tracks.length && libraryItem.updatedAt > mostRecentlyUpdatedAt) {
            mostRecentlyUpdatedAt = libraryItem.updatedAt
          }
        })

        if (!feed.entityUpdatedAt || mostRecentlyUpdatedAt > feed.entityUpdatedAt) {
          Logger.debug(`[RssFeedManager] Updating RSS feed for collection "${collection.name}"`)

          feed.updateFromCollection(collectionExpanded)
          await Database.updateFeed(feed)
        }
      }
    } else if (feed.entityType === 'series') {
      const series = Database.series.find(s => s.id === feed.entityId)
      if (series) {
        const seriesJson = series.toJSON()
        // Get books in series that have audio tracks
        seriesJson.books = Database.libraryItems.filter(li => li.mediaType === 'book' && li.media.metadata.hasSeries(series.id) && li.media.tracks.length)

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

    const xml = feed.buildXml()
    res.set('Content-Type', 'text/xml')
    res.send(xml)
  }

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

  async openFeedForItem(user, libraryItem, options) {
    const serverAddress = options.serverAddress
    const slug = options.slug
    const preventIndexing = options.metadataDetails?.preventIndexing ?? true
    const ownerName = options.metadataDetails?.ownerName
    const ownerEmail = options.metadataDetails?.ownerEmail

    const feed = new Feed()
    feed.setFromItem(user.id, slug, libraryItem, serverAddress, preventIndexing, ownerName, ownerEmail)

    Logger.info(`[RssFeedManager] Opened RSS feed "${feed.feedUrl}"`)
    await Database.createFeed(feed)
    SocketAuthority.emitter('rss_feed_open', feed.toJSONMinified())
    return feed
  }

  async openFeedForCollection(user, collectionExpanded, options) {
    const serverAddress = options.serverAddress
    const slug = options.slug
    const preventIndexing = options.metadataDetails?.preventIndexing ?? true
    const ownerName = options.metadataDetails?.ownerName
    const ownerEmail = options.metadataDetails?.ownerEmail

    const feed = new Feed()
    feed.setFromCollection(user.id, slug, collectionExpanded, serverAddress, preventIndexing, ownerName, ownerEmail)

    Logger.info(`[RssFeedManager] Opened RSS feed "${feed.feedUrl}"`)
    await Database.createFeed(feed)
    SocketAuthority.emitter('rss_feed_open', feed.toJSONMinified())
    return feed
  }

  async openFeedForSeries(user, seriesExpanded, options) {
    const serverAddress = options.serverAddress
    const slug = options.slug
    const preventIndexing = options.metadataDetails?.preventIndexing ?? true
    const ownerName = options.metadataDetails?.ownerName
    const ownerEmail = options.metadataDetails?.ownerEmail

    const feed = new Feed()
    feed.setFromSeries(user.id, slug, seriesExpanded, serverAddress, preventIndexing, ownerName, ownerEmail)

    Logger.info(`[RssFeedManager] Opened RSS feed "${feed.feedUrl}"`)
    await Database.createFeed(feed)
    SocketAuthority.emitter('rss_feed_open', feed.toJSONMinified())
    return feed
  }

  async handleCloseFeed(feed) {
    if (!feed) return
    await Database.removeFeed(feed.id)
    SocketAuthority.emitter('rss_feed_closed', feed.toJSONMinified())
    Logger.info(`[RssFeedManager] Closed RSS feed "${feed.feedUrl}"`)
  }

  async closeRssFeed(req, res) {
    const feed = await this.findFeed(req.params.id)
    if (!feed) {
      Logger.error(`[RssFeedManager] RSS feed not found with id "${req.params.id}"`)
      return res.sendStatus(404)
    }
    await this.handleCloseFeed(feed)
    res.sendStatus(200)
  }

  async closeFeedForEntityId(entityId) {
    const feed = await this.findFeedForEntityId(entityId)
    if (!feed) return
    return this.handleCloseFeed(feed)
  }
}
module.exports = RssFeedManager
