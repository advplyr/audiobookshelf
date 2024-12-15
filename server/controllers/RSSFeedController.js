const { Request, Response, NextFunction } = require('express')
const Logger = require('../Logger')
const Database = require('../Database')

const RssFeedManager = require('../managers/RssFeedManager')

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 */

class RSSFeedController {
  constructor() {}

  /**
   * GET: /api/feeds
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getAll(req, res) {
    const feeds = await RssFeedManager.getFeeds()
    res.json({
      feeds: feeds.map((f) => f.toOldJSON()),
      minified: feeds.map((f) => f.toOldJSONMinified())
    })
  }

  /**
   * POST: /api/feeds/item/:itemId/open
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async openRSSFeedForItem(req, res) {
    const reqBody = req.body || {}

    const itemExpanded = await Database.libraryItemModel.getExpandedById(req.params.itemId)
    if (!itemExpanded) return res.sendStatus(404)

    // Check user can access this library item
    if (!req.user.checkCanAccessLibraryItem(itemExpanded)) {
      Logger.error(`[RSSFeedController] User "${req.user.username}" attempted to open an RSS feed for item "${itemExpanded.media.title}" that they don\'t have access to`)
      return res.sendStatus(403)
    }

    // Check request body options exist
    if (!reqBody.serverAddress || !reqBody.slug || typeof reqBody.serverAddress !== 'string' || typeof reqBody.slug !== 'string') {
      Logger.error(`[RSSFeedController] Invalid request body to open RSS feed`)
      return res.status(400).send('Invalid request body')
    }

    // Check item has audio tracks
    if (!itemExpanded.hasAudioTracks()) {
      Logger.error(`[RSSFeedController] Cannot open RSS feed for item "${itemExpanded.media.title}" because it has no audio tracks`)
      return res.status(400).send('Item has no audio tracks')
    }

    // Check that this slug is not being used for another feed (slug will also be the Feed id)
    if (await RssFeedManager.checkExistsBySlug(reqBody.slug)) {
      Logger.error(`[RSSFeedController] Cannot open RSS feed because slug "${reqBody.slug}" is already in use`)
      return res.status(400).send('Slug already in use')
    }

    const feed = await RssFeedManager.openFeedForItem(req.user.id, itemExpanded, reqBody)
    if (!feed) {
      Logger.error(`[RSSFeedController] Failed to open RSS feed for item "${itemExpanded.media.title}"`)
      return res.status(500).send('Failed to open RSS feed')
    }

    res.json({
      feed: feed.toOldJSONMinified()
    })
  }

  /**
   * POST: /api/feeds/collection/:collectionId/open
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async openRSSFeedForCollection(req, res) {
    const reqBody = req.body || {}

    // Check request body options exist
    if (!reqBody.serverAddress || !reqBody.slug || typeof reqBody.serverAddress !== 'string' || typeof reqBody.slug !== 'string') {
      Logger.error(`[RSSFeedController] Invalid request body to open RSS feed`)
      return res.status(400).send('Invalid request body')
    }

    // Check that this slug is not being used for another feed (slug will also be the Feed id)
    if (await RssFeedManager.checkExistsBySlug(reqBody.slug)) {
      Logger.error(`[RSSFeedController] Cannot open RSS feed because slug "${reqBody.slug}" is already in use`)
      return res.status(400).send('Slug already in use')
    }

    const collection = await Database.collectionModel.getExpandedById(req.params.collectionId)
    if (!collection) return res.sendStatus(404)

    // Check collection has audio tracks
    if (!collection.books.some((book) => book.includedAudioFiles.length)) {
      Logger.error(`[RSSFeedController] Cannot open RSS feed for collection "${collection.name}" because it has no audio tracks`)
      return res.status(400).send('Collection has no audio tracks')
    }

    const feed = await RssFeedManager.openFeedForCollection(req.user.id, collection, reqBody)
    if (!feed) {
      Logger.error(`[RSSFeedController] Failed to open RSS feed for collection "${collection.name}"`)
      return res.status(500).send('Failed to open RSS feed')
    }

    res.json({
      feed: feed.toOldJSONMinified()
    })
  }

  /**
   * POST: /api/feeds/series/:seriesId/open
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async openRSSFeedForSeries(req, res) {
    const reqBody = req.body || {}

    // Check request body options exist
    if (!reqBody.serverAddress || !reqBody.slug || typeof reqBody.serverAddress !== 'string' || typeof reqBody.slug !== 'string') {
      Logger.error(`[RSSFeedController] Invalid request body to open RSS feed`)
      return res.status(400).send('Invalid request body')
    }

    // Check that this slug is not being used for another feed (slug will also be the Feed id)
    if (await RssFeedManager.checkExistsBySlug(reqBody.slug)) {
      Logger.error(`[RSSFeedController] Cannot open RSS feed because slug "${reqBody.slug}" is already in use`)
      return res.status(400).send('Slug already in use')
    }

    const series = await Database.seriesModel.getExpandedById(req.params.seriesId)
    if (!series) return res.sendStatus(404)

    // Check series has audio tracks
    if (!series.books.some((book) => book.includedAudioFiles.length)) {
      Logger.error(`[RSSFeedController] Cannot open RSS feed for series "${series.name}" because it has no audio tracks`)
      return res.status(400).send('Series has no audio tracks')
    }

    const feed = await RssFeedManager.openFeedForSeries(req.user.id, series, req.body)
    if (!feed) {
      Logger.error(`[RSSFeedController] Failed to open RSS feed for series "${series.name}"`)
      return res.status(500).send('Failed to open RSS feed')
    }

    res.json({
      feed: feed.toOldJSONMinified()
    })
  }

  /**
   * POST: /api/feeds/:id/close
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async closeRSSFeed(req, res) {
    const feed = await Database.feedModel.findByPk(req.params.id)
    if (!feed) {
      Logger.error(`[RSSFeedController] Cannot close RSS feed because feed "${req.params.id}" does not exist`)
      return res.sendStatus(404)
    }

    await RssFeedManager.handleCloseFeed(feed)

    res.sendStatus(200)
  }

  /**
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   * @param {NextFunction} next
   */
  middleware(req, res, next) {
    if (!req.user.isAdminOrUp) {
      // Only admins can manage rss feeds
      Logger.error(`[RSSFeedController] Non-admin user "${req.user.username}" attempted to make a request to an RSS feed route`)
      return res.sendStatus(403)
    }

    next()
  }
}
module.exports = new RSSFeedController()
