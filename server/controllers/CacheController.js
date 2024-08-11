const CacheManager = require('../managers/CacheManager')

class CacheController {
  constructor() {}

  // POST: api/cache/purge
  async purgeCache(req, res) {
    if (!req.user.isAdminOrUp) {
      return res.sendStatus(403)
    }
    await CacheManager.purgeAll()
    res.sendStatus(200)
  }

  // POST: api/cache/items/purge
  async purgeItemsCache(req, res) {
    if (!req.user.isAdminOrUp) {
      return res.sendStatus(403)
    }
    await CacheManager.purgeItems()
    res.sendStatus(200)
  }
}
module.exports = new CacheController()
