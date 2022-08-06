const Path = require('path')
const fs = require('../libs/fsExtra')
const Feed = require('../objects/Feed')
const Logger = require('../Logger')

// Not functional at the moment
class RssFeedManager {
  constructor(db, emitter) {
    this.db = db
    this.emitter = emitter
    this.feeds = {}
  }

  get feedsArray() {
    return Object.values(this.feeds)
  }

  async init() {
    var feedObjects = await this.db.getAllEntities('feed')
    if (feedObjects && feedObjects.length) {
      feedObjects.forEach((feedObj) => {
        var feed = new Feed(feedObj)
        this.feeds[feed.id] = feed
        Logger.info(`[RssFeedManager] Opened rss feed ${feed.feedUrl}`)
      })
    }
  }

  findFeedForItem(libraryItemId) {
    return Object.values(this.feeds).find(feed => feed.entityId === libraryItemId)
  }

  getFeed(req, res) {
    var feed = this.feeds[req.params.id]
    if (!feed) {
      Logger.error(`[RssFeedManager] Feed not found ${req.params.id}`)
      res.sendStatus(404)
      return
    }

    var xml = feed.buildXml()
    res.set('Content-Type', 'text/xml')
    res.send(xml)
  }

  getFeedItem(req, res) {
    var feed = this.feeds[req.params.id]
    if (!feed) {
      Logger.error(`[RssFeedManager] Feed not found ${req.params.id}`)
      res.sendStatus(404)
      return
    }
    var episodePath = feed.getEpisodePath(req.params.episodeId)
    if (!episodePath) {
      Logger.error(`[RssFeedManager] Feed episode not found ${req.params.episodeId}`)
      res.sendStatus(404)
      return
    }
    res.sendFile(episodePath)
  }

  getFeedCover(req, res) {
    var feed = this.feeds[req.params.id]
    if (!feed) {
      Logger.error(`[RssFeedManager] Feed not found ${req.params.id}`)
      res.sendStatus(404)
      return
    }

    if (!feed.coverPath) {
      res.sendStatus(404)
      return
    }

    const extname = Path.extname(feed.coverPath).toLowerCase().slice(1)
    res.type(`image/${extname}`)
    var readStream = fs.createReadStream(feed.coverPath)
    readStream.pipe(res)
  }

  async openFeedForItem(user, libraryItem, options) {
    const serverAddress = options.serverAddress
    const slug = options.slug

    if (this.feeds[slug]) {
      Logger.error(`[RssFeedManager] Slug already in use`)
      return {
        error: `Slug "${slug}" already in use`
      }
    }

    const feed = new Feed()
    feed.setFromItem(user.id, slug, libraryItem, serverAddress)
    this.feeds[feed.id] = feed

    Logger.debug(`[RssFeedManager] Opened RSS feed ${feed.feedUrl}`)
    await this.db.insertEntity('feed', feed)
    this.emitter('rss_feed_open', { id: feed.id, entityType: feed.entityType, entityId: feed.entityId, feedUrl: feed.feedUrl })
    return feed
  }

  closeFeedForItem(libraryItemId) {
    var feed = this.findFeedForItem(libraryItemId)
    if (!feed) return
    return this.closeRssFeed(feed.id)
  }

  async closeRssFeed(id) {
    if (!this.feeds[id]) return
    var feed = this.feeds[id]
    await this.db.removeEntity('feed', id)
    this.emitter('rss_feed_closed', { id: feed.id, entityType: feed.entityType, entityId: feed.entityId, feedUrl: feed.feedUrl })
    delete this.feeds[id]
    Logger.info(`[RssFeedManager] Closed RSS feed "${feed.feedUrl}"`)
  }
}
module.exports = RssFeedManager