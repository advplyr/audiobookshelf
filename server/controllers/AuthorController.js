const Logger = require('../Logger')
const { reqSupportsWebp } = require('../utils/index')

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
    Logger.debug(`[AuthorController] match author with "${req.body.q}"`, authorData)

    var hasUpdates = false
    if (authorData.asin && req.author.asin !== authorData.asin) {
      req.author.asin = authorData.asin
      hasUpdates = true
    }

    // Only updates image if there was no image before or the author ASIN was updated
    if (authorData.image && (!req.author.imagePath || hasUpdates)) {
      var imageData = await this.authorFinder.saveAuthorImage(req.author.id, authorData.image)
      if (imageData) {
        req.author.imagePath = imageData.path
        req.author.relImagePath = imageData.relPath
        hasUpdates = true
      }
    }

    if (authorData.description && req.author.description !== authorData.description) {
      req.author.description = authorData.description
      hasUpdates = true
    }

    if (hasUpdates) {
      req.author.updatedAt = Date.now()

      await this.db.updateEntity('author', req.author)
      var numBooks = this.db.libraryItems.filter(li => {
        return li.media.metadata.hasAuthor && li.media.metadata.hasAuthor(req.author.id)
      }).length
      this.emitter('author_updated', req.author.toJSONExpanded(numBooks))
    }

    res.json({
      updated: hasUpdates,
      author: req.author
    })
  }

  // GET api/authors/:id/image
  async getImage(req, res) {
    let { query: { width, height, format }, author } = req

    const options = {
      format: format || (reqSupportsWebp(req) ? 'webp' : 'jpeg'),
      height: height ? parseInt(height) : null,
      width: width ? parseInt(width) : null
    }
    return this.cacheManager.handleAuthorCache(res, author, options)
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