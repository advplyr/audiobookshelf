const Logger = require('../Logger')
const Database = require('../Database')
const libraryItemsBookFilters = require('../utils/queries/libraryItemsBookFilters')

class RSSFeedController {
  constructor() { }

  // POST: api/feeds/item/:itemId/open
  async openRSSFeedForItem(req, res) {
    const options = req.body || {}

    const item = await Database.libraryItemModel.getOldById(req.params.itemId)
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
    if (await this.rssFeedManager.findFeedBySlug(options.slug)) {
      Logger.error(`[RSSFeedController] Cannot open RSS feed because slug "${options.slug}" is already in use`)
      return res.status(400).send('Slug already in use')
    }

    const feed = await this.rssFeedManager.openFeedForItem(req.user, item, req.body)
    res.json({
      feed: feed.toJSONMinified()
    })
  }

  // POST: api/feeds/collection/:collectionId/open
  async openRSSFeedForCollection(req, res) {
    const options = req.body || {}

    const collection = await Database.collectionModel.findByPk(req.params.collectionId)
    if (!collection) return res.sendStatus(404)

    // Check request body options exist
    if (!options.serverAddress || !options.slug) {
      Logger.error(`[RSSFeedController] Invalid request body to open RSS feed`)
      return res.status(400).send('Invalid request body')
    }

    // Check that this slug is not being used for another feed (slug will also be the Feed id)
    if (await this.rssFeedManager.findFeedBySlug(options.slug)) {
      Logger.error(`[RSSFeedController] Cannot open RSS feed because slug "${options.slug}" is already in use`)
      return res.status(400).send('Slug already in use')
    }

    const collectionExpanded = await collection.getOldJsonExpanded()
    const collectionItemsWithTracks = collectionExpanded.books.filter(li => li.media.tracks.length)

    // Check collection has audio tracks
    if (!collectionItemsWithTracks.length) {
      Logger.error(`[RSSFeedController] Cannot open RSS feed for collection "${collection.name}" because it has no audio tracks`)
      return res.status(400).send('Collection has no audio tracks')
    }

    const feed = await this.rssFeedManager.openFeedForCollection(req.user, collectionExpanded, req.body)
    res.json({
      feed: feed.toJSONMinified()
    })
  }

  // POST: api/feeds/series/:seriesId/open
  async openRSSFeedForSeries(req, res) {
    const options = req.body || {}

    const series = Database.series.find(se => se.id === req.params.seriesId)
    if (!series) return res.sendStatus(404)

    // Check request body options exist
    if (!options.serverAddress || !options.slug) {
      Logger.error(`[RSSFeedController] Invalid request body to open RSS feed`)
      return res.status(400).send('Invalid request body')
    }

    // Check that this slug is not being used for another feed (slug will also be the Feed id)
    if (await this.rssFeedManager.findFeedBySlug(options.slug)) {
      Logger.error(`[RSSFeedController] Cannot open RSS feed because slug "${options.slug}" is already in use`)
      return res.status(400).send('Slug already in use')
    }

    const seriesJson = series.toJSON()

    // Get books in series that have audio tracks
    seriesJson.books = (await libraryItemsBookFilters.getLibraryItemsForSeries(series)).filter(li => li.media.numTracks)

    // Check series has audio tracks
    if (!seriesJson.books.length) {
      Logger.error(`[RSSFeedController] Cannot open RSS feed for series "${seriesJson.name}" because it has no audio tracks`)
      return res.status(400).send('Series has no audio tracks')
    }

    const feed = await this.rssFeedManager.openFeedForSeries(req.user, seriesJson, req.body)
    res.json({
      feed: feed.toJSONMinified()
    })
  }

  // POST: api/feeds/:id/close
  closeRSSFeed(req, res) {
    this.rssFeedManager.closeRssFeed(req, res)
  }

  middleware(req, res, next) {
    if (!req.user.isAdminOrUp) { // Only admins can manage rss feeds
      Logger.error(`[RSSFeedController] Non-admin user attempted to make a request to an RSS feed route`, req.user.username)
      return res.sendStatus(403)
    }

    next()
  }
}
module.exports = new RSSFeedController()
