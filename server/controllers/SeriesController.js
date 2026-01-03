const { Request, Response, NextFunction } = require('express')
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')

const RssFeedManager = require('../managers/RssFeedManager')

const libraryItemsBookFilters = require('../utils/queries/libraryItemsBookFilters')

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
   * PATCH /api/series/:id
   * Update series metadata (name, description, audibleSeriesAsin)
   *
   * TODO: should check for duplicate name
   *
   * @param {SeriesControllerRequest} req
   * @param {Response} res
   */
  async update(req, res) {
    const keysToUpdate = ['name', 'description', 'audibleSeriesAsin']
    const payload = {}
    for (const key of keysToUpdate) {
      if (req.body[key] !== undefined) {
        const value = req.body[key]

        // audibleSeriesAsin accepts null, empty string, or string
        // Model hook will normalize (extract from URL, uppercase) and validate
        // SAFEGUARD: null/empty values will NOT clear an existing ASIN (prevents accidental data loss)
        if (key === 'audibleSeriesAsin') {
          if (value === null || value === '') {
            // Skip adding to payload if empty - existing ASIN will be preserved
            // To explicitly clear, user must delete/recreate series or use a special endpoint
            continue
          } else if (typeof value === 'string') {
            payload[key] = value // Model hook will normalize & validate
          } else {
            return res.status(400).send('audibleSeriesAsin must be a string or null')
          }
        } else if (typeof value === 'string') {
          payload[key] = value
        }
      }
    }
    if (!Object.keys(payload).length) {
      return res.status(400).send('No valid fields to update')
    }
    req.series.set(payload)
    if (req.series.changed()) {
      try {
        await req.series.save()
      } catch (error) {
        // Handle model-level validation errors (e.g., invalid ASIN format)
        if (error.message?.includes('ASIN') || error.message?.includes('audibleSeriesAsin')) {
          return res.status(400).send(error.message)
        }
        throw error // Re-throw unexpected errors
      }
      SocketAuthority.emitter('series_updated', req.series.toOldJSON())
    }
    res.json(req.series.toOldJSON())
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
