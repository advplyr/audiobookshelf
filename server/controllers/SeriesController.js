const Logger = require('../Logger')

class SeriesController {
  constructor() { }

  async findOne(req, res) {
    return res.json(req.series)
  }

  async search(req, res) {
    var q = (req.query.q || '').toLowerCase()
    if (!q) return res.json([])
    var limit = (req.query.limit && !isNaN(req.query.limit)) ? Number(req.query.limit) : 25
    var series = this.db.series.filter(se => se.name.toLowerCase().includes(q))
    series = series.slice(0, limit)
    res.json(series)
  }

  middleware(req, res, next) {
    var series = this.db.series.find(se => se.id === req.params.id)
    if (!series) return res.sendStatus(404)

    if (req.method == 'DELETE' && !req.user.canDelete) {
      Logger.warn(`[SeriesController] User attempted to delete without permission`, req.user)
      return res.sendStatus(403)
    } else if ((req.method == 'PATCH' || req.method == 'POST') && !req.user.canUpdate) {
      Logger.warn('[SeriesController] User attempted to update without permission', req.user)
      return res.sendStatus(403)
    }

    req.series = series
    next()
  }
}
module.exports = new SeriesController()