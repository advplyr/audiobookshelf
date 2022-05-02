const Path = require('path')
const { Podcast } = require('podcast')
const { getId } = require('../utils/index')
const Logger = require('../Logger')

// Not functional at the moment
class RssFeedManager {
  constructor(db) {
    this.db = db
    this.feeds = {}
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

  openFeed(feedId, libraryItem, serverAddress) {
    const podcast = libraryItem.media

    const feedUrl = `${serverAddress}/feed/${feedId}`
    // Removed Podcast npm package and ip package
    const feed = new Podcast({
      title: podcast.metadata.title,
      description: podcast.metadata.description,
      feedUrl,
      imageUrl: `${serverAddress}/Logo.png`,
      author: podcast.metadata.author || 'advplyr',
      language: 'en'
    })
    podcast.episodes.forEach((episode) => {
      var contentUrl = episode.audioTrack.contentUrl.replace(/\\/g, '/')
      contentUrl = contentUrl.replace(`/s/item/${libraryItem.id}`, `/feed/${feedId}/item`)

      feed.addItem({
        title: episode.title,
        description: episode.description || '',
        enclosure: {
          url: `${serverAddress}${contentUrl}`,
          type: episode.audioTrack.mimeType,
          size: episode.size
        },
        url: `${serverAddress}${contentUrl}`,
        author: podcast.metadata.author || 'advplyr'
      })
    })

    const feedData = {
      id: feedId,
      libraryItemId: libraryItem.id,
      libraryItemPath: libraryItem.path,
      serverAddress: serverAddress,
      feedUrl,
      feed
    }
    this.feeds[feedId] = feedData
    return feedData
  }

  openPodcastFeed(user, libraryItem, options) {
    const serverAddress = options.serverAddress
    const feedId = getId('feed')
    const feedData = this.openFeed(feedId, libraryItem, serverAddress)
    Logger.debug(`[RssFeedManager] Opened podcast feed ${feedData.feedUrl}`)
    return feedData
  }
}
module.exports = RssFeedManager