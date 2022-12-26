const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')

class RSSFeedController {
  constructor() { }

  // POST: api/feeds/item/:itemId/open
  async openRSSFeedForItem(req, res) {
    const options = req.body || {}

    const item = this.db.libraryItems.find(li => li.id === req.params.itemId)
    if (!item) return res.sendStatus(404)

    // Check user can access this library item
    if (!req.user.checkCanAccessLibraryItem(item)) {
      Logger.error(`[RSSFeedController] User "${req.user.username}" attempted to open an RSS feed for item "${item.media.metadata.title}" that they don\'t have access to`)
      return res.sendStatus(403)
    }

    // Check request body options exist
    if (!options.serverAddress || !options.slug) {
      Logger.error(`[RSSFeedController] Invalid request body to open RSS feed`)
      return res.status(400).send('Invalid request body')
    }

    // Check item has audio tracks
    if (!item.media.numTracks) {
      Logger.error(`[RSSFeedController] Cannot open RSS feed for item "${item.media.metadata.title}" because it has no audio tracks`)
      return res.status(400).send('Item has no audio tracks')
    }

    // Check that this slug is not being used for another feed (slug will also be the Feed id)
    if (this.rssFeedManager.feeds[options.slug]) {
      Logger.error(`[RSSFeedController] Cannot open RSS feed because slug "${options.slug}" is already in use`)
      return res.status(400).send('Slug already in use')
    }

    const feed = await this.rssFeedManager.openFeedForItem(req.user, item, req.body)
    res.json({
      feed: feed.toJSONMinified()
    })
  }

  // POST: api/feeds/:id/close
  async closeRSSFeed(req, res) {
    await this.rssFeedManager.closeRssFeed(req.params.id)

    res.sendStatus(200)
  }

  middleware(req, res, next) {
    if (!req.user.isAdminOrUp) { // Only admins can manage rss feeds
      Logger.error(`[RSSFeedController] Non-admin user attempted to make a request to an RSS feed route`, req.user.username)
      return res.sendStatus(403)
    }

    if (req.params.id) {
      const feed = this.rssFeedManager.findFeed(req.params.id)
      if (!feed) {
        Logger.error(`[RSSFeedController] RSS feed not found with id "${req.params.id}"`)
        return res.sendStatus(404)
      }
    }

    next()
  }
}
module.exports = new RSSFeedController()