const { Request, Response, NextFunction } = require('express')
const Logger = require('../Logger')

const adminStats = require('../utils/queries/adminStats')

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 */

class StatsController {
  constructor() {}

  /**
   * GET: /api/stats/server
   * Currently not in use
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getServerStats(req, res) {
    Logger.debug('[StatsController] getServerStats')
    const totalSize = await adminStats.getTotalSize()
    const numAudioFiles = await adminStats.getNumAudioFiles()

    res.json({
      books: {
        ...totalSize.books,
        numAudioFiles: numAudioFiles.numBookAudioFiles
      },
      podcasts: {
        ...totalSize.podcasts,
        numAudioFiles: numAudioFiles.numPodcastAudioFiles
      },
      total: {
        ...totalSize.total,
        numAudioFiles: numAudioFiles.numAudioFiles
      }
    })
  }

  /**
   * GET: /api/stats/year/:year
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getAdminStatsForYear(req, res) {
    const year = Number(req.params.year)
    if (isNaN(year) || year < 2000 || year > 9999) {
      Logger.error(`[StatsController] Invalid year "${year}"`)
      return res.status(400).send('Invalid year')
    }
    const stats = await adminStats.getStatsForYear(year)
    res.json(stats)
  }

  /**
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   * @param {NextFunction} next
   */
  async middleware(req, res, next) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[StatsController] Non-admin user "${req.user.username}" attempted to access stats route`)
      return res.sendStatus(403)
    }

    next()
  }
}
module.exports = new StatsController()
