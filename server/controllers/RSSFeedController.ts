import type { Request, Response, NextFunction } from 'express'
import type User from '../models/User'
import Logger from '../Logger'
import Database from '../Database'
import { openRSSFeedSchema } from '../utils/rssFeedValidation'

import RssFeedManager from '../managers/RssFeedManager'

type RequestWithUser = Request & { user: User }
type OpenFeedRequest = Request<Record<string, string>, unknown, Parameters<typeof RssFeedManager.openFeedForItem>[2]> & { user: User }

class RSSFeedController {
  constructor() {}

  /**
   * GET: /api/feeds
   */
  async getAll(_req: RequestWithUser, res: Response) {
    const feeds = await RssFeedManager.getFeeds()
    res.json({
      feeds: feeds.map((f) => f.toOldJSON()),
      minified: feeds.map((f) => f.toOldJSONMinified())
    })
  }

  /**
   * POST: /api/feeds/item/:itemId/open
   */
  async openRSSFeedForItem(req: OpenFeedRequest, res: Response) {
    const reqBody = req.body || {}

    const itemExpanded = await Database.libraryItemModel.getExpandedById(req.params.itemId)
    if (!itemExpanded) return res.sendStatus(404)

    // Check user can access this library item
    if (!req.user.checkCanAccessLibraryItem(itemExpanded)) {
      Logger.error(`[RSSFeedController] User "${req.user.username}" attempted to open an RSS feed for item "${itemExpanded.media.title}" that they don\'t have access to`)
      return res.sendStatus(403)
    }

    // Check request body options exist
    if (!openRSSFeedSchema.safeParse(reqBody).success) {
      Logger.error(`[RSSFeedController] Invalid request body to open RSS feed`)
      return res.status(400).send('Invalid request body')
    }

    // Check item has audio tracks
    if (!itemExpanded.hasAudioTracks) {
      Logger.error(`[RSSFeedController] Cannot open RSS feed for item "${itemExpanded.media.title}" because it has no audio tracks`)
      return res.status(400).send('Item has no audio tracks')
    }

    // Check that this slug is not being used for another feed (slug will also be the Feed id)
    if (await RssFeedManager.checkExistsBySlug(req.body.slug)) {
      Logger.error(`[RSSFeedController] Cannot open RSS feed because slug "${req.body.slug}" is already in use`)
      return res.status(400).send('Slug already in use')
    }

    const feed = await RssFeedManager.openFeedForItem(req.user.id, itemExpanded as Parameters<typeof RssFeedManager.openFeedForItem>[1], req.body)
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
   */
  async openRSSFeedForCollection(req: OpenFeedRequest, res: Response) {
    const reqBody = req.body || {}

    // Check request body options exist
    if (!openRSSFeedSchema.safeParse(reqBody).success) {
      Logger.error(`[RSSFeedController] Invalid request body to open RSS feed`)
      return res.status(400).send('Invalid request body')
    }

    // Check that this slug is not being used for another feed (slug will also be the Feed id)
    if (await RssFeedManager.checkExistsBySlug(req.body.slug)) {
      Logger.error(`[RSSFeedController] Cannot open RSS feed because slug "${req.body.slug}" is already in use`)
      return res.status(400).send('Slug already in use')
    }

    const collection = await Database.collectionModel.getExpandedById(req.params.collectionId)
    if (!collection) return res.sendStatus(404)

    // Check collection has audio tracks
    if (!collection.books!.some((book) => book.includedAudioFiles.length)) {
      Logger.error(`[RSSFeedController] Cannot open RSS feed for collection "${collection.name}" because it has no audio tracks`)
      return res.status(400).send('Collection has no audio tracks')
    }

    const feed = await RssFeedManager.openFeedForCollection(req.user.id, collection as Parameters<typeof RssFeedManager.openFeedForCollection>[1], req.body)
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
   */
  async openRSSFeedForSeries(req: OpenFeedRequest, res: Response) {
    const reqBody = req.body || {}

    // Check request body options exist
    if (!openRSSFeedSchema.safeParse(reqBody).success) {
      Logger.error(`[RSSFeedController] Invalid request body to open RSS feed`)
      return res.status(400).send('Invalid request body')
    }

    // Check that this slug is not being used for another feed (slug will also be the Feed id)
    if (await RssFeedManager.checkExistsBySlug(req.body.slug)) {
      Logger.error(`[RSSFeedController] Cannot open RSS feed because slug "${req.body.slug}" is already in use`)
      return res.status(400).send('Slug already in use')
    }

    const series = await Database.seriesModel.getExpandedById(req.params.seriesId)
    if (!series) return res.sendStatus(404)

    // Check series has audio tracks
    if (!series.books!.some((book) => book.includedAudioFiles.length)) {
      Logger.error(`[RSSFeedController] Cannot open RSS feed for series "${series.name}" because it has no audio tracks`)
      return res.status(400).send('Series has no audio tracks')
    }

    const feed = await RssFeedManager.openFeedForSeries(req.user.id, series as Parameters<typeof RssFeedManager.openFeedForSeries>[1], req.body)
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
   */
  async closeRSSFeed(req: RequestWithUser, res: Response) {
    const feed = await Database.feedModel.findByPk(req.params.id)
    if (!feed) {
      Logger.error(`[RSSFeedController] Cannot close RSS feed because feed "${req.params.id}" does not exist`)
      return res.sendStatus(404)
    }

    await RssFeedManager.handleCloseFeed(feed)

    res.sendStatus(200)
  }

  middleware(req: RequestWithUser, res: Response, next: NextFunction) {
    if (!req.user.isAdminOrUp) {
      // Only admins can manage rss feeds
      Logger.error(`[RSSFeedController] Non-admin user "${req.user.username}" attempted to make a request to an RSS feed route`)
      return res.sendStatus(403)
    }

    next()
  }
}
export = new RSSFeedController()
