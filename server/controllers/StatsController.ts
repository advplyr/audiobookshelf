import type { Request, Response, NextFunction } from 'express'
import type User from '../models/User'
import Logger from '../Logger'

import adminStats from '../utils/queries/adminStats'

type RequestWithUser = Request & { user: User }

class StatsController {
  constructor() {}

  /**
   * GET: /api/stats/server
   * Currently not in use
   */
  async getServerStats(_req: RequestWithUser, res: Response) {
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
   */
  async getAdminStatsForYear(req: RequestWithUser, res: Response) {
    const year = Number(req.params.year)
    if (isNaN(year) || year < 2000 || year > 9999) {
      Logger.error(`[StatsController] Invalid year "${year}"`)
      return res.status(400).send('Invalid year')
    }
    const stats = await adminStats.getStatsForYear(year)
    res.json(stats)
  }

  async middleware(req: RequestWithUser, res: Response, next: NextFunction) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[StatsController] Non-admin user "${req.user.username}" attempted to access stats route`)
      return res.sendStatus(403)
    }

    next()
    return Promise.resolve()
  }
}
export = new StatsController()
