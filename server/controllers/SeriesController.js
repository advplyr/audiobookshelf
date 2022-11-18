const Logger = require('../Logger')

class SeriesController {
  constructor() { }

  async findOne(req, res) {
    var include = (req.query.include || '').split(',')

    var seriesJson = req.series.toJSON()

    // Add progress map with isFinished flag
    if (include.includes('progress')) {
      var libraryItemsInSeries = this.db.libraryItems.filter(li => li.mediaType === 'book' && li.media.metadata.hasSeries(seriesJson.id))
      var libraryItemsFinished = libraryItemsInSeries.filter(li => {
        var mediaProgress = req.user.getMediaProgress(li.id)
        return mediaProgress && mediaProgress.isFinished
      })
      seriesJson.progress = {
        libraryItemIds: libraryItemsInSeries.map(li => li.id),
        libraryItemIdsFinished: libraryItemsFinished.map(li => li.id),
        isFinished: libraryItemsFinished.length === libraryItemsInSeries.length
      }
    }

    return res.json(seriesJson)
  }

  async search(req, res) {
    var q = (req.query.q || '').toLowerCase()
    if (!q) return res.json([])
    var limit = (req.query.limit && !isNaN(req.query.limit)) ? Number(req.query.limit) : 25
    var series = this.db.series.filter(se => se.name.toLowerCase().includes(q))
    series = series.slice(0, limit)
    res.json(series)
  }

  async update(req, res) {
    const hasUpdated = req.series.update(req.body)
    if (hasUpdated) {
      await this.db.updateEntity('series', req.series)
      this.emitter('series_updated', req.series)
    }
    res.json(req.series)
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