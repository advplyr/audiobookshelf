const Path = require('path')
const fs = require('fs-extra')
const { Podcast } = require('podcast')
const { getId } = require('../utils/index')
const Logger = require('../Logger')

// Not functional at the moment
class RssFeedManager {
  constructor(db, emitter) {
    this.db = db
    this.emitter = emitter
    this.feeds = {}
  }

  findFeedForItem(libraryItemId) {
    return Object.values(this.feeds).find(feed => feed.libraryItemId === libraryItemId)
  }

  getFeed(req, res) {
    var feedData = this.feeds[req.params.id]
    if (!feedData) {
      Logger.error(`[RssFeedManager] Feed not found ${req.params.id}`)
      res.sendStatus(404)
      return
    }
    var xml = feedData.feed.buildXml()
    res.set('Content-Type', 'text/xml')
    res.send(xml)
  }

  getFeedItem(req, res) {
    var feedData = this.feeds[req.params.id]
    if (!feedData) {
      Logger.error(`[RssFeedManager] Feed not found ${req.params.id}`)
      res.sendStatus(404)
      return
    }
    var remainingPath = req.params['0']
    var fullPath = Path.join(feedData.libraryItemPath, remainingPath)
    res.sendFile(fullPath)
  }

  getFeedCover(req, res) {
    var feedData = this.feeds[req.params.id]
    if (!feedData) {
      Logger.error(`[RssFeedManager] Feed not found ${req.params.id}`)
      res.sendStatus(404)
      return
    }

    if (!feedData.mediaCoverPath) {
      res.sendStatus(404)
      return
    }

    const extname = Path.extname(feedData.mediaCoverPath).toLowerCase().slice(1)
    res.type(`image/${extname}`)
    var readStream = fs.createReadStream(feedData.mediaCoverPath)
    readStream.pipe(res)
  }

  openFeed(userId, slug, libraryItem, serverAddress) {
    const podcast = libraryItem.media

    const feedUrl = `${serverAddress}/feed/${slug}`
    // Removed Podcast npm package and ip package
    const feed = new Podcast({
      title: podcast.metadata.title,
      description: podcast.metadata.description,
      feedUrl,
      siteUrl: serverAddress,
      imageUrl: podcast.coverPath ? `${serverAddress}/feed/${slug}/cover` : `${serverAddress}/Logo.png`,
      author: podcast.metadata.author || 'advplyr',
      language: 'en'
    })
    podcast.episodes.forEach((episode) => {
      var contentUrl = episode.audioTrack.contentUrl.replace(/\\/g, '/')
      contentUrl = contentUrl.replace(`/s/item/${libraryItem.id}`, `/feed/${slug}/item`)

      feed.addItem({
        title: episode.title,
        description: episode.description || '',
        enclosure: {
          url: `${serverAddress}${contentUrl}`,
          type: episode.audioTrack.mimeType,
          size: episode.size
        },
        date: episode.pubDate || '',
        url: `${serverAddress}${contentUrl}`,
        author: podcast.metadata.author || 'advplyr'
      })
    })

    const feedData = {
      id: slug,
      slug,
      userId,
      libraryItemId: libraryItem.id,
      libraryItemPath: libraryItem.path,
      mediaCoverPath: podcast.coverPath,
      serverAddress: serverAddress,
      feedUrl,
      feed
    }
    this.feeds[slug] = feedData
    return feedData
  }

  openPodcastFeed(user, libraryItem, options) {
    const serverAddress = options.serverAddress
    const slug = options.slug

    if (this.feeds[slug]) {
      Logger.error(`[RssFeedManager] Slug already in use`)
      return {
        error: `Slug "${slug}" already in use`
      }
    }

    const feedData = this.openFeed(user.id, slug, libraryItem, serverAddress)
    Logger.debug(`[RssFeedManager] Opened podcast feed ${feedData.feedUrl}`)
    this.emitter('rss_feed_open', { libraryItemId: libraryItem.id, feedUrl: feedData.feedUrl })
    return feedData
  }

  closePodcastFeedForItem(libraryItemId) {
    var feed = this.findFeedForItem(libraryItemId)
    if (!feed) return
    this.closeRssFeed(feed.id)
  }

  closeRssFeed(id) {
    if (!this.feeds[id]) return
    var feedData = this.feeds[id]
    this.emitter('rss_feed_closed', { libraryItemId: feedData.libraryItemId, feedUrl: feedData.feedUrl })
    delete this.feeds[id]
    Logger.info(`[RssFeedManager] Closed RSS feed "${feedData.feedUrl}"`)
  }
}
module.exports = RssFeedManager