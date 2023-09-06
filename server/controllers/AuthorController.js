const sequelize = require('sequelize')
const fs = require('../libs/fsExtra')
const { createNewSortInstance } = require('../libs/fastSort')

const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')
const CacheManager = require('../managers/CacheManager')
const CoverManager = require('../managers/CoverManager')
const AuthorFinder = require('../finders/AuthorFinder')

const { reqSupportsWebp } = require('../utils/index')

const naturalSort = createNewSortInstance({
  comparer: new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare
})
class AuthorController {
  constructor() { }

  async findOne(req, res) {
    const include = (req.query.include || '').split(',')

    const authorJson = req.author.toJSON()

    // Used on author landing page to include library items and items grouped in series
    if (include.includes('items')) {
      authorJson.libraryItems = await Database.libraryItemModel.getForAuthor(req.author, req.user)

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
        await CacheManager.purgeImageCache(req.author.id) // Purge cache
        await CoverManager.removeFile(req.author.imagePath)
      } else if (payload.imagePath.startsWith('http')) { // Check if image path is a url
        const imageData = await AuthorFinder.saveAuthorImage(req.author.id, payload.imagePath)
        if (imageData) {
          if (req.author.imagePath) {
            await CacheManager.purgeImageCache(req.author.id) // Purge cache
          }
          payload.imagePath = imageData.path
          hasUpdated = true
        }
      } else if (payload.imagePath && payload.imagePath !== req.author.imagePath) { // Changing image path locally
        if (!await fs.pathExists(payload.imagePath)) { // Make sure image path exists
          Logger.error(`[AuthorController] Image path does not exist: "${payload.imagePath}"`)
          return res.status(400).send('Author image path does not exist')
        }

        if (req.author.imagePath) {
          await CacheManager.purgeImageCache(req.author.id) // Purge cache
        }
      }
    }

    const authorNameUpdate = payload.name !== undefined && payload.name !== req.author.name

    // Check if author name matches another author and merge the authors
    let existingAuthor = null
    if (authorNameUpdate) {
      const author = await Database.authorModel.findOne({
        where: {
          id: {
            [sequelize.Op.not]: req.author.id
          },
          name: payload.name
        }
      })
      existingAuthor = author?.getOldAuthor()
    }
    if (existingAuthor) {
      const bookAuthorsToCreate = []
      const itemsWithAuthor = await Database.libraryItemModel.getForAuthor(req.author)
      itemsWithAuthor.forEach(libraryItem => { // Replace old author with merging author for each book
        libraryItem.media.metadata.replaceAuthor(req.author, existingAuthor)
        bookAuthorsToCreate.push({
          bookId: libraryItem.media.id,
          authorId: existingAuthor.id
        })
      })
      if (itemsWithAuthor.length) {
        await Database.removeBulkBookAuthors(req.author.id) // Remove all old BookAuthor
        await Database.createBulkBookAuthors(bookAuthorsToCreate) // Create all new BookAuthor
        SocketAuthority.emitter('items_updated', itemsWithAuthor.map(li => li.toJSONExpanded()))
      }

      // Remove old author
      await Database.removeAuthor(req.author.id)
      SocketAuthority.emitter('author_removed', req.author.toJSON())
      // Update filter data
      Database.removeAuthorFromFilterData(req.author.libraryId, req.author.id)

      // Send updated num books for merged author
      const numBooks = await Database.libraryItemModel.getForAuthor(existingAuthor).length
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
        req.author.updatedAt = Date.now()

        const itemsWithAuthor = await Database.libraryItemModel.getForAuthor(req.author)
        if (authorNameUpdate) { // Update author name on all books
          itemsWithAuthor.forEach(libraryItem => {
            libraryItem.media.metadata.updateAuthor(req.author)
          })
          if (itemsWithAuthor.length) {
            SocketAuthority.emitter('items_updated', itemsWithAuthor.map(li => li.toJSONExpanded()))
          }
        }

        await Database.updateAuthor(req.author)
        SocketAuthority.emitter('author_updated', req.author.toJSONExpanded(itemsWithAuthor.length))
      }

      res.json({
        author: req.author.toJSON(),
        updated: hasUpdated
      })
    }
  }

  async match(req, res) {
    let authorData = null
    const region = req.body.region || 'us'
    if (req.body.asin) {
      authorData = await AuthorFinder.findAuthorByASIN(req.body.asin, region)
    } else {
      authorData = await AuthorFinder.findAuthorByName(req.body.q, region)
    }
    if (!authorData) {
      return res.status(404).send('Author not found')
    }
    Logger.debug(`[AuthorController] match author with "${req.body.q || req.body.asin}"`, authorData)

    let hasUpdates = false
    if (authorData.asin && req.author.asin !== authorData.asin) {
      req.author.asin = authorData.asin
      hasUpdates = true
    }

    // Only updates image if there was no image before or the author ASIN was updated
    if (authorData.image && (!req.author.imagePath || hasUpdates)) {
      await CacheManager.purgeImageCache(req.author.id)

      const imageData = await AuthorFinder.saveAuthorImage(req.author.id, authorData.image)
      if (imageData) {
        req.author.imagePath = imageData.path
        hasUpdates = true
      }
    }

    if (authorData.description && req.author.description !== authorData.description) {
      req.author.description = authorData.description
      hasUpdates = true
    }

    if (hasUpdates) {
      req.author.updatedAt = Date.now()

      await Database.updateAuthor(req.author)

      const numBooks = await Database.libraryItemModel.getForAuthor(req.author).length
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
    return CacheManager.handleAuthorCache(res, author, options)
  }

  async middleware(req, res, next) {
    const author = await Database.authorModel.getOldById(req.params.id)
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