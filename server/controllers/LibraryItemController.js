const Logger = require('../Logger')
const { reqSupportsWebp } = require('../utils/index')

class LibraryItemController {
  constructor() { }

  findOne(req, res) {
    if (req.query.expanded == 1) return res.json(req.libraryItem.toJSONExpanded())
    res.json(req.libraryItem)
  }

  // GET api/items/:id/cover
  async getCover(req, res) {
    let { query: { width, height, format }, libraryItem } = req

    const options = {
      format: format || (reqSupportsWebp(req) ? 'webp' : 'jpeg'),
      height: height ? parseInt(height) : null,
      width: width ? parseInt(width) : null
    }
    return this.cacheManager.handleCoverCache(res, libraryItem, options)
  }

  middleware(req, res, next) {
    var item = this.db.libraryItems.find(li => li.id === req.params.id)
    if (!item || !item.media || !item.media.coverPath) return res.sendStatus(404)

    // Check user can access this audiobooks library
    if (!req.user.checkCanAccessLibrary(item.libraryId)) {
      return res.sendStatus(403)
    }

    req.libraryItem = item
    next()
  }
}
module.exports = new LibraryItemController()