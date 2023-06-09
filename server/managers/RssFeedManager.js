const Path = require('path')

const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')

const fs = require('../libs/fsExtra')
const Feed = require('../objects/Feed')

class RssFeedManager {
  constructor(db) {
    this.db = db

    this.feeds = {}
  }

  get feedsArray() {
    return Object.values(this.feeds)
  }

  validateFeedEntity(feedObj) {
    if (feedObj.entityType === 'collection') {
      if (!this.db.collections.some(li => li.id === feedObj.entityId)) {
        Logger.error(`[RssFeedManager] Removing feed "${feedObj.id}". Collection "${feedObj.entityId}" not found`)
        return false
      }
    } else if (feedObj.entityType === 'libraryItem') {
      if (!this.db.libraryItems.some(li => li.id === feedObj.entityId)) {
        Logger.error(`[RssFeedManager] Removing feed "${feedObj.id}". Library item "${feedObj.entityId}" not found`)
        return false
      }
    } else if (feedObj.entityType === 'series') {
      const series = this.db.series.find(s => s.id === feedObj.entityId)
      const hasSeriesBook = this.db.libraryItems.some(li => li.mediaType === 'book' && li.media.metadata.hasSeries(series.id) && li.media.tracks.length)
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

  async init() {
    const feedObjects = await this.db.getAllEntities('feed')
    if (!feedObjects || !feedObjects.length) return

    for (const feedObj of feedObjects) {
      // Migration: In v2.2.12 entityType "item" was updated to "libraryItem"
      if (feedObj.entityType === 'item') {
        feedObj.entityType = 'libraryItem'
        await this.db.updateEntity('feed', feedObj)
      }

      // Remove invalid feeds
      if (!this.validateFeedEntity(feedObj)) {
        await this.db.removeEntity('feed', feedObj.id)
      }

      const feed = new Feed(feedObj)
      this.feeds[feed.id] = feed
      Logger.info(`[RssFeedManager] Opened rss feed ${feed.feedUrl}`)
    }
  }

  findFeedForEntityId(entityId) {
    return Object.values(this.feeds).find(feed => feed.entityId === entityId)
  }

  findFeed(feedId) {
    return this.feeds[feedId] || null
  }

  async getFeed(req, res) {
    const feed = this.feeds[req.params.id]
    if (!feed) {
      Logger.debug(`[RssFeedManager] Feed not found ${req.params.id}`)
      res.sendStatus(404)
      return
    }

    // Check if feed needs to be updated
    if (feed.entityType === 'libraryItem') {
      const libraryItem = this.db.getLibraryItem(feed.entityId)

      let mostRecentlyUpdatedAt = libraryItem.updatedAt
      if (libraryItem.isPodcast) {
        libraryItem.media.episodes.forEach((episode) => {
          if (episode.updatedAt > mostRecentlyUpdatedAt) mostRecentlyUpdatedAt = episode.updatedAt
        })
      }

      if (libraryItem && (!feed.entityUpdatedAt || mostRecentlyUpdatedAt > feed.entityUpdatedAt)) {
        Logger.debug(`[RssFeedManager] Updating RSS feed for item ${libraryItem.id} "${libraryItem.media.metadata.title}"`)
        feed.updateFromItem(libraryItem)
        await this.db.updateEntity('feed', feed)
      }
    } else if (feed.entityType === 'collection') {
      const collection = this.db.collections.find(c => c.id === feed.entityId)
      if (collection) {
        const collectionExpanded = collection.toJSONExpanded(this.db.libraryItems)

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
          await this.db.updateEntity('feed', feed)
        }
      }
    } else if (feed.entityType === 'series') {
      const series = this.db.series.find(s => s.id === feed.entityId)
      if (series) {
        const seriesJson = series.toJSON()
        // Get books in series that have audio tracks
        seriesJson.books = this.db.libraryItems.filter(li => li.mediaType === 'book' && li.media.metadata.hasSeries(series.id) && li.media.tracks.length)

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
          await this.db.updateEntity('feed', feed)
        }
      }
    }

    const xml = feed.buildXml()
    res.set('Content-Type', 'text/xml')
    res.send(xml)
  }

  getFeedItem(req, res) {
    const feed = this.feeds[req.params.id]
    if (!feed) {
      Logger.debug(`[RssFeedManager] Feed not found ${req.params.id}`)
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

  getFeedCover(req, res) {
    const feed = this.feeds[req.params.id]
    if (!feed) {
      Logger.debug(`[RssFeedManager] Feed not found ${req.params.id}`)
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
    this.feeds[feed.id] = feed

    Logger.debug(`[RssFeedManager] Opened RSS feed "${feed.feedUrl}"`)
    await this.db.insertEntity('feed', feed)
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
    this.feeds[feed.id] = feed

    Logger.debug(`[RssFeedManager] Opened RSS feed "${feed.feedUrl}"`)
    await this.db.insertEntity('feed', feed)
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
    this.feeds[feed.id] = feed

    Logger.debug(`[RssFeedManager] Opened RSS feed "${feed.feedUrl}"`)
    await this.db.insertEntity('feed', feed)
    SocketAuthority.emitter('rss_feed_open', feed.toJSONMinified())
    return feed
  }

  async handleCloseFeed(feed) {
    if (!feed) return
    await this.db.removeEntity('feed', feed.id)
    SocketAuthority.emitter('rss_feed_closed', feed.toJSONMinified())
    delete this.feeds[feed.id]
    Logger.info(`[RssFeedManager] Closed RSS feed "${feed.feedUrl}"`)
  }

  closeRssFeed(id) {
    if (!this.feeds[id]) return
    return this.handleCloseFeed(this.feeds[id])
  }

  closeFeedForEntityId(entityId) {
    const feed = this.findFeedForEntityId(entityId)
    if (!feed) return
    return this.handleCloseFeed(feed)
  }
}
module.exports = RssFeedManager
