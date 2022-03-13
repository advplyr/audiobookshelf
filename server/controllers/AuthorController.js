const Logger = require('../Logger')

class AuthorController {
  constructor() { }

  async findOne(req, res) {
    return res.json(req.author)
  }

  async search(req, res) {
    var q = (req.query.q || '').toLowerCase()
    if (!q) return res.json([])
    var limit = (req.query.limit && !isNaN(req.query.limit)) ? Number(req.query.limit) : 25
    var authors = this.db.authors.filter(au => au.name.toLowerCase().includes(q))
    authors = authors.slice(0, limit)
    res.json(authors)
  }

  async match(req, res) {
    var authorData = await this.authorFinder.findAuthorByName(req.body.q)
    if (!authorData) {
      return res.status(404).send('Author not found')
    }
    req.author.asin = authorData.asin
    if (authorData.image) {
      var imageData = await this.authorFinder.saveAuthorImage(req.author.id, authorData.image)
      if (imageData) {
        req.author.imagePath = imageData.path
        req.author.relImagePath = imageData.relPath
      }
    }
    if (authorData.description) {
      req.author.description = authorData.description
    }
    await this.db.updateEntity('author', req.author)
    this.emitter('author_updated', req.author)
    res.json(req.author)
  }

  middleware(req, res, next) {
    var author = this.db.authors.find(au => au.id === req.params.id)
    if (!author) return res.sendStatus(404)

    if (req.method == 'DELETE' && !req.user.canDelete) {
      Logger.warn(`[AuthorController] User attempted to delete without permission`, req.user)
      return res.sendStatus(403)
    } else if ((req.method == 'PATCH' || req.method == 'POST') && !req.user.canUpdate) {
      Logger.warn('[AuthorController] User attempted to update without permission', req.user)
      return res.sendStatus(403)
    }

    req.author = author
    next()
  }
}
module.exports = new AuthorController()