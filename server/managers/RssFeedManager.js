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

  async init() {
    const feedObjects = await this.db.getAllEntities('feed')
    if (feedObjects && feedObjects.length) {
      feedObjects.forEach((feedObj) => {
        const feed = new Feed(feedObj)
        this.feeds[feed.id] = feed
        Logger.info(`[RssFeedManager] Opened rss feed ${feed.feedUrl}`)
      })
    }
  }

  findFeedForItem(libraryItemId) {
    return Object.values(this.feeds).find(feed => feed.entityId === libraryItemId)
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

    if (feed.entityType === 'item') {
      const libraryItem = this.db.getLibraryItem(feed.entityId)
      if (libraryItem && (!feed.entityUpdatedAt || libraryItem.updatedAt > feed.entityUpdatedAt)) {
        Logger.debug(`[RssFeedManager] Updating RSS feed for item ${libraryItem.id} "${libraryItem.media.metadata.title}"`)
        feed.updateFromItem(libraryItem)
        await this.db.updateEntity('feed', feed)
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

    const feed = new Feed()
    feed.setFromItem(user.id, slug, libraryItem, serverAddress)
    this.feeds[feed.id] = feed

    Logger.debug(`[RssFeedManager] Opened RSS feed "${feed.feedUrl}"`)
    await this.db.insertEntity('feed', feed)
    SocketAuthority.emitter('rss_feed_open', feed.toJSONMinified())
    return feed
  }

  closeFeedForItem(libraryItemId) {
    const feed = this.findFeedForItem(libraryItemId)
    if (!feed) return
    return this.closeRssFeed(feed.id)
  }

  async closeRssFeed(id) {
    if (!this.feeds[id]) return
    const feed = this.feeds[id]
    await this.db.removeEntity('feed', id)
    SocketAuthority.emitter('rss_feed_closed', feed.toJSONMinified())
    delete this.feeds[id]
    Logger.info(`[RssFeedManager] Closed RSS feed "${feed.feedUrl}"`)
  }
}
module.exports = RssFeedManager