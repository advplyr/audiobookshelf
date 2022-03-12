const Logger = require('../Logger')

class SeriesController {
  constructor() { }

  async search(req, res) {
    var q = (req.query.q || '').toLowerCase()
    if (!q) return res.json([])
    var limit = (req.query.limit && !isNaN(req.query.limit)) ? Number(req.query.limit) : 25
    var series = this.db.series.filter(se => se.name.toLowerCase().includes(q))
    series = series.slice(0, limit)
    res.json(series)
  }
}
module.exports = new SeriesController()