
const fs = require('../libs/fsExtra')
const { createNewSortInstance } = require('../libs/fastSort')

const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')

const { reqSupportsWebp } = require('../utils/index')

const naturalSort = createNewSortInstance({
  comparer: new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare
})
class AuthorController {
  constructor() { }

  async findOne(req, res) {
    const libraryId = req.query.library
    const include = (req.query.include || '').split(',')

    const authorJson = req.author.toJSON()

    // Used on author landing page to include library items and items grouped in series
    if (include.includes('items')) {
      authorJson.libraryItems = this.db.libraryItems.filter(li => {
        if (libraryId && li.libraryId !== libraryId) return false
        if (!req.user.checkCanAccessLibraryItem(li)) return false // filter out library items user cannot access
        return li.media.metadata.hasAuthor && li.media.metadata.hasAuthor(req.author.id)
      })

      if (include.includes('series')) {
        const seriesMap = {}
        // Group items into series
        authorJson.libraryItems.forEach((li) => {
          if (li.media.metadata.series) {
            li.media.metadata.series.forEach((series) => {

              const itemWithSeries = li.toJSONMinified()
              itemWithSeries.media.metadata.series = series

              if (seriesMap[series.id]) {
                seriesMap[series.id].items.push(itemWithSeries)
              } else {
                seriesMap[series.id] = {
                  id: series.id,
                  name: series.name,
                  items: [itemWithSeries]
                }
              }
            })
          }
        })
        // Sort series items
        for (const key in seriesMap) {
          seriesMap[key].items = naturalSort(seriesMap[key].items).asc(li => li.media.metadata.series.sequence)
        }

        authorJson.series = Object.values(seriesMap)
      }

      // Minify library items
      authorJson.libraryItems = authorJson.libraryItems.map(li => li.toJSONMinified())
    }

    return res.json(authorJson)
  }

  async update(req, res) {
    const payload = req.body
    let hasUpdated = false

    // Updating/removing cover image
    if (payload.imagePath !== undefined && payload.imagePath !== req.author.imagePath) {
      if (!payload.imagePath && req.author.imagePath) { // If removing image then remove file
        await this.cacheManager.purgeImageCache(req.author.id) // Purge cache
        await this.coverManager.removeFile(req.author.imagePath)
      } else if (payload.imagePath.startsWith('http')) { // Check if image path is a url
        const imageData = await this.authorFinder.saveAuthorImage(req.author.id, payload.imagePath)
        if (imageData) {
          if (req.author.imagePath) {
            await this.cacheManager.purgeImageCache(req.author.id) // Purge cache
          }
          payload.imagePath = imageData.path
          payload.relImagePath = imageData.relPath
          hasUpdated = true
        }
      }
    }

    const authorNameUpdate = payload.name !== undefined && payload.name !== req.author.name

    // Check if author name matches another author and merge the authors
    const existingAuthor = authorNameUpdate ? this.db.authors.find(au => au.id !== req.author.id && payload.name === au.name) : false
    if (existingAuthor) {
      const itemsWithAuthor = this.db.libraryItems.filter(li => li.mediaType === 'book' && li.media.metadata.hasAuthor(req.author.id))
      itemsWithAuthor.forEach(libraryItem => { // Replace old author with merging author for each book
        libraryItem.media.metadata.replaceAuthor(req.author, existingAuthor)
      })
      if (itemsWithAuthor.length) {
        await this.db.updateLibraryItems(itemsWithAuthor)
        SocketAuthority.emitter('items_updated', itemsWithAuthor.map(li => li.toJSONExpanded()))
      }

      // Remove old author
      await this.db.removeEntity('author', req.author.id)
      SocketAuthority.emitter('author_removed', req.author.toJSON())

      // Send updated num books for merged author
      const numBooks = this.db.libraryItems.filter(li => {
        return li.media.metadata.hasAuthor && li.media.metadata.hasAuthor(existingAuthor.id)
      }).length
      SocketAuthority.emitter('author_updated', existingAuthor.toJSONExpanded(numBooks))

      res.json({
        author: existingAuthor.toJSON(),
        merged: true
      })
    } else { // Regular author update
      if (req.author.update(payload)) {
        hasUpdated = true
      }

      if (hasUpdated) {
        if (authorNameUpdate) { // Update author name on all books
          const itemsWithAuthor = this.db.libraryItems.filter(li => li.mediaType === 'book' && li.media.metadata.hasAuthor(req.author.id))
          itemsWithAuthor.forEach(libraryItem => {
            libraryItem.media.metadata.updateAuthor(req.author)
          })
          if (itemsWithAuthor.length) {
            await this.db.updateLibraryItems(itemsWithAuthor)
            SocketAuthority.emitter('items_updated', itemsWithAuthor.map(li => li.toJSONExpanded()))
          }
        }

        await this.db.updateEntity('author', req.author)
        const numBooks = this.db.libraryItems.filter(li => {
          return li.media.metadata.hasAuthor && li.media.metadata.hasAuthor(req.author.id)
        }).length
        SocketAuthority.emitter('author_updated', req.author.toJSONExpanded(numBooks))
      }

      res.json({
        author: req.author.toJSON(),
        updated: hasUpdated
      })
    }
  }

  async search(req, res) {
    var q = (req.query.q || '').toLowerCase()
    if (!q) return res.json([])
    var limit = (req.query.limit && !isNaN(req.query.limit)) ? Number(req.query.limit) : 25
    var authors = this.db.authors.filter(au => au.name.toLowerCase().includes(q))
    authors = authors.slice(0, limit)
    res.json({
      results: authors
    })
  }

  async match(req, res) {
    var authorData = null
    if (req.body.asin) {
      authorData = await this.authorFinder.findAuthorByASIN(req.body.asin)
    } else {
      authorData = await this.authorFinder.findAuthorByName(req.body.q)
    }
    if (!authorData) {
      return res.status(404).send('Author not found')
    }
    Logger.debug(`[AuthorController] match author with "${req.body.q || req.body.asin}"`, authorData)

    var hasUpdates = false
    if (authorData.asin && req.author.asin !== authorData.asin) {
      req.author.asin = authorData.asin
      hasUpdates = true
    }

    // Only updates image if there was no image before or the author ASIN was updated
    if (authorData.image && (!req.author.imagePath || hasUpdates)) {
      this.cacheManager.purgeImageCache(req.author.id)

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
      SocketAuthority.emitter('author_updated', req.author.toJSONExpanded(numBooks))
    }

    res.json({
      updated: hasUpdates,
      author: req.author
    })
  }

  // GET api/authors/:id/image
  async getImage(req, res) {
    const { query: { width, height, format, raw }, author } = req

    if (raw) { // any value
      if (!author.imagePath || !await fs.pathExists(author.imagePath)) {
        return res.sendStatus(404)
      }

      return res.sendFile(author.imagePath)
    }

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