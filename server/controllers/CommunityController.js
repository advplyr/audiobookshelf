const communityStats = require('../utils/queries/communityStats')
const { toNumber } = require('../utils')

class CommunityController {
  ensureEnabled(res) {
    if (!global.ServerSettings?.enableCommunityListeningStats) {
      res.sendStatus(403)
      return false
    }
    return true
  }

  async getLibraryStats(req, res) {
    if (!this.ensureEnabled(res)) return
    res.json(await communityStats.getLibraryStats(req.library.id, req.user))
  }

  async getLibraryActivity(req, res) {
    if (!this.ensureEnabled(res)) return
    const page = Math.max(0, toNumber(req.query.page, 0))
    const itemsPerPage = Math.min(100, Math.max(1, toNumber(req.query.itemsPerPage, 20)))
    res.json(await communityStats.getLibraryActivity(req.library.id, req.user, page, itemsPerPage))
  }

  async getItemListeners(req, res) {
    if (!this.ensureEnabled(res)) return
    res.json(await communityStats.getItemListeners(req.libraryItem))
  }
}

module.exports = new CommunityController()
