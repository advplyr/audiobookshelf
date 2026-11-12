import type { Request, Response } from 'express'
import type User from '../models/User'
import CacheManager from '../managers/CacheManager'

type RequestWithUser = Request & { user: User }

class CacheController {
  constructor() {}

  /**
   * POST: /api/cache/purge
   */
  async purgeCache(req: RequestWithUser, res: Response) {
    if (!req.user.isAdminOrUp) {
      return res.sendStatus(403)
    }
    await CacheManager.purgeAll()
    res.sendStatus(200)
  }

  /**
   * POST: /api/cache/items/purge
   */
  async purgeItemsCache(req: RequestWithUser, res: Response) {
    if (!req.user.isAdminOrUp) {
      return res.sendStatus(403)
    }
    await CacheManager.purgeItems()
    res.sendStatus(200)
  }
}
export = new CacheController()
