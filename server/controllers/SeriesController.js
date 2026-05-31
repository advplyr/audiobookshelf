const { Request, Response, NextFunction } = require('express')
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')
const OpenAI = require('../providers/OpenAI')

const RssFeedManager = require('../managers/RssFeedManager')

const libraryItemsBookFilters = require('../utils/queries/libraryItemsBookFilters')

const openAI = new OpenAI()

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 *
 * @typedef RequestEntityObject
 * @property {import('../models/Series')} series
 *
 * @typedef {RequestWithUser & RequestEntityObject} SeriesControllerRequest
 */

class SeriesController {
  constructor() {}

  /**
   * @deprecated
   * /api/series/:id
   *
   * TODO: Update mobile app to use /api/libraries/:id/series/:seriesId API route instead
   * Series are not library specific so we need to know what the library id is
   *
   * @param {SeriesControllerRequest} req
   * @param {Response} res
   */
  async findOne(req, res) {
    const include = (req.query.include || '')
      .split(',')
      .map((v) => v.trim())
      .filter((v) => !!v)

    const seriesJson = req.series.toOldJSON()

    // Add progress map with isFinished flag
    if (include.includes('progress')) {
      const libraryItemsInSeries = req.libraryItemsInSeries
      const libraryItemsFinished = libraryItemsInSeries.filter((li) => {
        return req.user.getMediaProgress(li.media.id)?.isFinished
      })
      seriesJson.progress = {
        libraryItemIds: libraryItemsInSeries.map((li) => li.id),
        libraryItemIdsFinished: libraryItemsFinished.map((li) => li.id),
        isFinished: libraryItemsFinished.length === libraryItemsInSeries.length
      }
    }

    if (include.includes('rssfeed')) {
      const feedObj = await RssFeedManager.findFeedForEntityId(seriesJson.id)
      seriesJson.rssFeed = feedObj?.toOldJSONMinified() || null
    }

    res.json(seriesJson)
  }

  /**
   * TODO: Currently unused in the client, should check for duplicate name
   *
   * @param {SeriesControllerRequest} req
   * @param {Response} res
   */
  async update(req, res) {
    const keysToUpdate = ['name', 'description']
    const payload = {}
    for (const key of keysToUpdate) {
      if (req.body[key] !== undefined && typeof req.body[key] === 'string') {
        payload[key] = req.body[key]
      }
    }
    if (!Object.keys(payload).length) {
      return res.status(400).send('No valid fields to update')
    }
    req.series.set(payload)
    if (req.series.changed()) {
      await req.series.save()
      SocketAuthority.emitter('series_updated', req.series.toOldJSON())
    }
    res.json(req.series.toOldJSON())
  }

  /**
   * POST: /api/series/:id/organize-story-order
   *
   * @param {SeriesControllerRequest} req
   * @param {Response} res
   */
  async organizeStoryOrder(req, res) {
    if (!openAI.isConfigured) {
      return res.status(400).send('OpenAI is not configured')
    }

    if (!req.libraryItemsInSeries.length) {
      return res.status(400).send('No books found in this series')
    }

    try {
      const seriesOrder = await openAI.getSeriesOrder(req.series, req.libraryItemsInSeries)
      const sequenceByLibraryItemId = new Map(seriesOrder.map((book) => [book.id, book.sequence]))

      const updatedItems = []
      Logger.info(`[SeriesController] AI story-order evaluation returned ${seriesOrder.length} books for series "${req.series.name}"`)
      for (const libraryItem of req.libraryItemsInSeries) {
        const nextSequence = sequenceByLibraryItemId.get(libraryItem.id)
        if (!nextSequence) continue

        Logger.info(`[SeriesController] AI story-order applying "${libraryItem.media.title}" (${libraryItem.id}) -> sequence "${nextSequence}" in series "${req.series.name}"`)

        const seriesPayload = libraryItem.media.series.map((series) => ({
          id: series.id,
          name: series.name,
          sequence: series.id === req.series.id ? nextSequence : series.bookSeries?.sequence || null
        }))

        const seriesUpdate = await libraryItem.media.updateSeriesFromRequest(seriesPayload, libraryItem.libraryId)
        if (!seriesUpdate?.hasUpdates) {
          Logger.info(`[SeriesController] AI story-order found no change for "${libraryItem.media.title}" (${libraryItem.id})`)
          continue
        }

        libraryItem.changed('updatedAt', true)
        await libraryItem.save()
        await libraryItem.saveMetadataFile()
        updatedItems.push(libraryItem)
        SocketAuthority.libraryItemEmitter('item_updated', libraryItem)
      }

      if (updatedItems.length) {
        SocketAuthority.emitter('series_updated', req.series.toOldJSON())
      }

      Logger.info(`[SeriesController] AI story-order completed for series "${req.series.name}" - updated=${updatedItems.length}, total=${req.libraryItemsInSeries.length}`)

      res.json({
        updated: updatedItems.length,
        total: req.libraryItemsInSeries.length
      })
    } catch (error) {
      Logger.error(`[SeriesController] Failed to organize story order for "${req.series.name}"`, error)
      res.status(500).send(error.message || 'Failed to organize story order')
    }
  }

  /**
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   * @param {NextFunction} next
   */
  async middleware(req, res, next) {
    const series = await Database.seriesModel.findByPk(req.params.id)
    if (!series) return res.sendStatus(404)

    /**
     * Filter out any library items not accessible to user
     */
    const libraryItems = await libraryItemsBookFilters.getLibraryItemsForSeries(series, req.user)
    if (!libraryItems.length) {
      Logger.warn(`[SeriesController] User "${req.user.username}" attempted to access series "${series.id}" with no accessible books`)
      return res.sendStatus(404)
    }

    if (req.method == 'DELETE' && !req.user.canDelete) {
      Logger.warn(`[SeriesController] User "${req.user.username}" attempted to delete without permission`)
      return res.sendStatus(403)
    } else if ((req.method == 'PATCH' || req.method == 'POST') && !req.user.canUpdate) {
      Logger.warn(`[SeriesController] User "${req.user.username}" attempted to update without permission`)
      return res.sendStatus(403)
    }

    req.series = series
    req.libraryItemsInSeries = libraryItems
    next()
  }
}
module.exports = new SeriesController()
