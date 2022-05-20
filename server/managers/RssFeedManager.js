const Path = require('path')
const fs = require('fs-extra')
const date = require('date-and-time')
const { Podcast } = require('podcast')
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
    const media = libraryItem.media
    const mediaMetadata = media.metadata
    const isPodcast = libraryItem.mediaType === 'podcast'

    const feedUrl = `${serverAddress}/feed/${slug}`
    const author = isPodcast ? mediaMetadata.author : mediaMetadata.authorName

    const feed = new Podcast({
      title: mediaMetadata.title,
      description: mediaMetadata.description,
      feedUrl,
      siteUrl: `${serverAddress}/items/${libraryItem.id}`,
      imageUrl: media.coverPath ? `${serverAddress}/feed/${slug}/cover` : `${serverAddress}/Logo.png`,
      author: author || 'advplyr',
      language: 'en'
    })

    if (isPodcast) { // PODCAST EPISODES
      media.episodes.forEach((episode) => {
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
          author: author || 'advplyr'
        })
      })
    } else { // AUDIOBOOK EPISODES

      // Example: <pubDate>Fri, 04 Feb 2015 00:00:00 GMT</pubDate>
      const audiobookPubDate = date.format(new Date(libraryItem.addedAt), 'ddd, DD MMM YYYY HH:mm:ss [GMT]')

      media.tracks.forEach((audioTrack) => {
        var contentUrl = audioTrack.contentUrl.replace(/\\/g, '/')
        contentUrl = contentUrl.replace(`/s/item/${libraryItem.id}`, `/feed/${slug}/item`)

        var title = audioTrack.title
        if (media.chapters.length) {
          // If audio track start and chapter start are within 1 seconds of eachother then use the chapter title
          var matchingChapter = media.chapters.find(ch => Math.abs(ch.start - audioTrack.startOffset) < 1)
          if (matchingChapter && matchingChapter.title) title = matchingChapter.title
        }

        feed.addItem({
          title,
          description: '',
          enclosure: {
            url: `${serverAddress}${contentUrl}`,
            type: audioTrack.mimeType,
            size: audioTrack.metadata.size
          },
          date: audiobookPubDate,
          url: `${serverAddress}${contentUrl}`,
          author: author || 'advplyr'
        })
      })
    }


    const feedData = {
      id: slug,
      slug,
      userId,
      libraryItemId: libraryItem.id,
      libraryItemPath: libraryItem.path,
      mediaCoverPath: media.coverPath,
      serverAddress: serverAddress,
      feedUrl,
      feed
    }
    this.feeds[slug] = feedData
    return feedData
  }

  openFeedForItem(user, libraryItem, options) {
    const serverAddress = options.serverAddress
    const slug = options.slug

    if (this.feeds[slug]) {
      Logger.error(`[RssFeedManager] Slug already in use`)
      return {
        error: `Slug "${slug}" already in use`
      }
    }

    const feedData = this.openFeed(user.id, slug, libraryItem, serverAddress)
    Logger.debug(`[RssFeedManager] Opened RSS feed ${feedData.feedUrl}`)
    this.emitter('rss_feed_open', { libraryItemId: libraryItem.id, feedUrl: feedData.feedUrl })
    return feedData
  }

  closeFeedForItem(libraryItemId) {
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