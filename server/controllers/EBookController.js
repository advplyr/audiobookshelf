const Logger = require('../Logger')
const { isNullOrNaN } = require('../utils/index')

class EBookController {
  constructor() { }

  async getEbookInfo(req, res) {
    const isDev = req.query.dev == 1
    const json = await this.eBookManager.getBookInfo(req.libraryItem, req.user, isDev)
    res.json(json)
  }

  async getEbookPage(req, res) {
    if (isNullOrNaN(req.params.page)) {
      return res.status(400).send('Invalid page params')
    }
    const isDev = req.query.dev == 1
    const pageIndex = Number(req.params.page)
    const page = await this.eBookManager.getBookPage(req.libraryItem, req.user, pageIndex, isDev)
    if (!page) {
      return res.status(500).send('Failed to get page')
    }

    res.send(page)
  }

  async getEbookResource(req, res) {
    if (!req.query.path) {
      return res.status(400).send('Invalid query path')
    }
    const isDev = req.query.dev == 1
    this.eBookManager.getBookResource(req.libraryItem, req.user, req.query.path, isDev, res)
  }

  middleware(req, res, next) {
    const item = this.db.libraryItems.find(li => li.id === req.params.id)
    if (!item || !item.media) return res.sendStatus(404)

    // Check user can access this library item
    if (!req.user.checkCanAccessLibraryItem(item)) {
      return res.sendStatus(403)
    }

    if (!item.isBook || !item.media.ebookFile) {
      return res.status(400).send('Invalid ebook library item')
    }

    req.libraryItem = item
    next()
  }
}
module.exports = new EBookController()