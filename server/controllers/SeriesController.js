const { Request, Response, NextFunction } = require('express')
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')
const libraryItemsBookFilters = require('../utils/queries/libraryItemsBookFilters')

/**
 * @typedef RequestUserObjects
 * @property {import('../models/User')} userNew
 * @property {import('../objects/user/User')} user
 *
 * @typedef {Request & RequestUserObjects} RequestWithUser
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
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async findOne(req, res) {
    const include = (req.query.include || '')
      .split(',')
      .map((v) => v.trim())
      .filter((v) => !!v)

    const seriesJson = req.series.toJSON()

    // Add progress map with isFinished flag
    if (include.includes('progress')) {
      const libraryItemsInSeries = req.libraryItemsInSeries
      const libraryItemsFinished = libraryItemsInSeries.filter((li) => {
        return req.userNew.getMediaProgress(li.media.id)?.isFinished
      })
      seriesJson.progress = {
        libraryItemIds: libraryItemsInSeries.map((li) => li.id),
        libraryItemIdsFinished: libraryItemsFinished.map((li) => li.id),
        isFinished: libraryItemsFinished.length === libraryItemsInSeries.length
      }
    }

    if (include.includes('rssfeed')) {
      const feedObj = await this.rssFeedManager.findFeedForEntityId(seriesJson.id)
      seriesJson.rssFeed = feedObj?.toJSONMinified() || null
    }

    res.json(seriesJson)
  }

  /**
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async update(req, res) {
    const hasUpdated = req.series.update(req.body)
    if (hasUpdated) {
      await Database.updateSeries(req.series)
      SocketAuthority.emitter('series_updated', req.series.toJSON())
    }
    res.json(req.series.toJSON())
  }

  /**
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   * @param {NextFunction} next
   */
  async middleware(req, res, next) {
    const series = await Database.seriesModel.getOldById(req.params.id)
    if (!series) return res.sendStatus(404)

    /**
     * Filter out any library items not accessible to user
     */
    const libraryItems = await libraryItemsBookFilters.getLibraryItemsForSeries(series, req.userNew)
    if (!libraryItems.length) {
      Logger.warn(`[SeriesController] User "${req.userNew.username}" attempted to access series "${series.id}" with no accessible books`)
      return res.sendStatus(404)
    }

    if (req.method == 'DELETE' && !req.userNew.canDelete) {
      Logger.warn(`[SeriesController] User "${req.userNew.username}" attempted to delete without permission`)
      return res.sendStatus(403)
    } else if ((req.method == 'PATCH' || req.method == 'POST') && !req.userNew.canUpdate) {
      Logger.warn(`[SeriesController] User "${req.userNew.username}" attempted to update without permission`)
      return res.sendStatus(403)
    }

    req.series = series
    req.libraryItemsInSeries = libraryItems
    next()
  }
}
module.exports = new SeriesController()
