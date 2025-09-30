const { Request, Response, NextFunction } = require('express')
const sequelize = require('sequelize')
const fs = require('../libs/fsExtra')
const { createNewSortInstance } = require('../libs/fastSort')
const axios = require('axios')
const Path = require('path')

const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')
const CacheManager = require('../managers/CacheManager')
const CoverManager = require('../managers/CoverManager')
const AuthorFinder = require('../finders/AuthorFinder')

const { reqSupportsWebp, isValidASIN } = require('../utils/index')

const naturalSort = createNewSortInstance({
  comparer: new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare
})

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 *
 * @typedef RequestEntityObject
 * @property {import('../models/Author')} author
 *
 * @typedef {RequestWithUser & RequestEntityObject} AuthorControllerRequest
 */

class AuthorController {
  constructor() {}

  /**
   * GET: /api/authors/:id
   *
   * @param {AuthorControllerRequest} req
   * @param {Response} res
   */
  async findOne(req, res) {
    const include = (req.query.include || '').split(',')

    const authorJson = req.author.toOldJSON()

    // Used on author landing page to include library items and items grouped in series
    if (include.includes('items')) {
      const libraryItems = await Database.libraryItemModel.getForAuthor(req.author, req.user)

      if (include.includes('series')) {
        const seriesMap = {}
        // Group items into series
        libraryItems.forEach((li) => {
          if (li.media.series?.length) {
            li.media.series.forEach((series) => {
              const itemWithSeries = li.toOldJSONMinified()
              itemWithSeries.media.metadata.series = {
                id: series.id,
                name: series.name,
                nameIgnorePrefix: series.nameIgnorePrefix,
                sequence: series.bookSeries.sequence
              }

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
          seriesMap[key].items = naturalSort(seriesMap[key].items).asc((li) => li.media.metadata.series.sequence)
        }

        authorJson.series = Object.values(seriesMap)
      }

      // Minify library items
      authorJson.libraryItems = libraryItems.map((li) => li.toOldJSONMinified())
    }

    return res.json(authorJson)
  }

  /**
   * PATCH: /api/authors/:id
   *
   * @param {AuthorControllerRequest} req
   * @param {Response} res
   */
  async update(req, res) {
    const keysToUpdate = ['name', 'description', 'asin']
    const payload = {}
    for (const key in req.body) {
      if (keysToUpdate.includes(key) && (typeof req.body[key] === 'string' || req.body[key] === null)) {
        payload[key] = req.body[key]
      }
    }
    if (!Object.keys(payload).length) {
      Logger.error(`[AuthorController] Invalid request payload. No valid keys found`, req.body)
      return res.status(400).send('Invalid request payload. No valid keys found')
    }

    let hasUpdated = false

    const authorNameUpdate = payload.name !== undefined && payload.name !== req.author.name
    if (authorNameUpdate) {
      payload.lastFirst = Database.authorModel.getLastFirst(payload.name)
    }

    // Check if author name matches another author and merge the authors
    let existingAuthor = null
    if (authorNameUpdate) {
      existingAuthor = await Database.authorModel.findOne({
        where: {
          id: {
            [sequelize.Op.not]: req.author.id
          },
          name: payload.name
        }
      })
    }
    if (existingAuthor) {
      Logger.info(`[AuthorController] Merging author "${req.author.name}" with "${existingAuthor.name}"`)
      const bookAuthorsToCreate = []
      const allItemsWithAuthor = await Database.authorModel.getAllLibraryItemsForAuthor(req.author.id)

      const libraryItems = []
      allItemsWithAuthor.forEach((libraryItem) => {
        // Replace old author with merging author for each book
        libraryItem.media.authors = libraryItem.media.authors.filter((au) => au.id !== req.author.id)
        libraryItem.media.authors.push({
          id: existingAuthor.id,
          name: existingAuthor.name
        })

        libraryItems.push(libraryItem)

        bookAuthorsToCreate.push({
          bookId: libraryItem.media.id,
          authorId: existingAuthor.id
        })
      })
      if (libraryItems.length) {
        await Database.bookAuthorModel.removeByIds(req.author.id) // Remove all old BookAuthor
        await Database.bookAuthorModel.bulkCreate(bookAuthorsToCreate) // Create all new BookAuthor
        for (const libraryItem of libraryItems) {
          await libraryItem.saveMetadataFile()
        }
        SocketAuthority.libraryItemsEmitter('items_updated', libraryItems)
      }

      // Remove old author
      const oldAuthorJSON = req.author.toOldJSON()
      await req.author.destroy()
      SocketAuthority.emitter('author_removed', oldAuthorJSON)
      // Update filter data
      Database.removeAuthorFromFilterData(oldAuthorJSON.libraryId, oldAuthorJSON.id)

      // Send updated num books for merged author
      const numBooks = await Database.bookAuthorModel.getCountForAuthor(existingAuthor.id)
      SocketAuthority.emitter('author_updated', existingAuthor.toOldJSONExpanded(numBooks))

      res.json({
        author: existingAuthor.toOldJSON(),
        merged: true
      })
      return
    }

    // If lastFirst is not set, get it from the name
    if (!authorNameUpdate && !req.author.lastFirst) {
      payload.lastFirst = Database.authorModel.getLastFirst(req.author.name)
    }

    // Regular author update
    req.author.set(payload)
    if (req.author.changed()) {
      await req.author.save()
      hasUpdated = true
    }

    if (hasUpdated) {
      let numBooksForAuthor = 0
      if (authorNameUpdate) {
        const allItemsWithAuthor = await Database.authorModel.getAllLibraryItemsForAuthor(req.author.id)

        numBooksForAuthor = allItemsWithAuthor.length
        const libraryItems = []
        // Update author name on all books
        for (const libraryItem of allItemsWithAuthor) {
          libraryItem.media.authors = libraryItem.media.authors.map((au) => {
            if (au.id === req.author.id) {
              au.name = req.author.name
            }
            return au
          })

          libraryItems.push(libraryItem)

          await libraryItem.saveMetadataFile()
        }

        if (libraryItems.length) {
          SocketAuthority.libraryItemsEmitter('items_updated', libraryItems)
        }
      } else {
        numBooksForAuthor = await Database.bookAuthorModel.getCountForAuthor(req.author.id)
      }

      SocketAuthority.emitter('author_updated', req.author.toOldJSONExpanded(numBooksForAuthor))
    }

    res.json({
      author: req.author.toOldJSON(),
      updated: hasUpdated
    })
  }

  /**
   * DELETE: /api/authors/:id
   * Remove author from all books and delete
   *
   * @param {AuthorControllerRequest} req
   * @param {Response} res
   */
  async delete(req, res) {
    Logger.info(`[AuthorController] Removing author "${req.author.name}"`)

    if (req.author.imagePath) {
      await CacheManager.purgeImageCache(req.author.id) // Purge cache
    }

    // Load library items so that metadata file can be updated
    const allItemsWithAuthor = await Database.authorModel.getAllLibraryItemsForAuthor(req.author.id)
    allItemsWithAuthor.forEach((libraryItem) => {
      libraryItem.media.authors = libraryItem.media.authors.filter((au) => au.id !== req.author.id)
    })

    await req.author.destroy()

    for (const libraryItem of allItemsWithAuthor) {
      await libraryItem.saveMetadataFile()
    }

    SocketAuthority.emitter('author_removed', req.author.toOldJSON())

    // Update filter data
    Database.removeAuthorFromFilterData(req.author.libraryId, req.author.id)

    res.sendStatus(200)
  }

  /**
   * POST: /api/authors/:id/image
   * Upload author image from file (express-fileupload) or URL
   *
   * @param {AuthorControllerRequest} req
   * @param {Response} res
   */
  async uploadImage(req, res) {
    if (!req.user.canUpload) {
      Logger.warn(`User "${req.user.username}" attempted to upload an image without permission`)
      return res.sendStatus(403)
    }

    let imagePath = null

    // 1. File upload (express-fileupload)
    if (req.files && req.files.image) {
      const uploadedFile = req.files.image
      const uploadsDir = Path.join(global.MetadataPath, 'uploads')
      
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true })
      }
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
      const fileName = 'image-' + uniqueSuffix + Path.extname(uploadedFile.name)
      const filePath = Path.join(uploadsDir, fileName)
      await uploadedFile.mv(filePath)
      imagePath = filePath
    }
    // 2. URL upload
    else if (req.body.url && (req.body.url.startsWith('http://') || req.body.url.startsWith('https://'))) {
      const result = await AuthorFinder.saveAuthorImage(req.author.id, req.body.url)
      if (result?.error) {
        return res.status(400).send(result.error)
      } else if (!result?.path) {
        return res.status(500).send('Unknown error occurred')
      }
      imagePath = result.path
    } else {
      Logger.error(`[AuthorController] Invalid request payload. No file or valid url`)
      return res.status(400).send(`Invalid request payload. No file or valid url`)
    }

    if (req.author.imagePath) {
      await CacheManager.purgeImageCache(req.author.id)
    }

    req.author.imagePath = imagePath
    req.author.changed('imagePath', true)
    await req.author.save()

    const numBooks = await Database.bookAuthorModel.getCountForAuthor(req.author.id)
    SocketAuthority.emitter('author_updated', req.author.toOldJSONExpanded(numBooks))
    res.json({
      author: req.author.toOldJSON()
    })
  }

  /**
   * DELETE: /api/authors/:id/image
   * Remove author image & delete image file
   *
   * @param {AuthorControllerRequest} req
   * @param {Response} res
   */
  async deleteImage(req, res) {
    if (!req.author.imagePath) {
      return res.status(400).send('Author has no image path set')
    }

    Logger.info(`[AuthorController] Removing image for author "${req.author.name}" at "${req.author.imagePath}"`)

    // Clear cache
    try {
      await CacheManager.purgeImageCache(req.author.id)
    } catch (e) {
      console.log('Cache purge error (ignored):', e.message)
    }

    // Only local files are deleted
    if (!req.author.imagePath.startsWith('http')) {
      await CoverManager.removeFile(req.author.imagePath)
    }

    req.author.imagePath = null
    // Mark changes and explicitly update updatedAt to ensure the client receives the new timestamp
    req.author.updatedAt = new Date()
    req.author.changed('imagePath', true)
    await req.author.save()

    // Clear cache again
    try {
      await CacheManager.purgeImageCache(req.author.id)
    } catch (e) {
      console.log('Cache purge error (ignored):', e.message)
    }

    const numBooks = await Database.bookAuthorModel.getCountForAuthor(req.author.id)
    SocketAuthority.emitter('author_updated', req.author.toOldJSONExpanded(numBooks))

    res.json({ author: req.author.toOldJSON() })
  }

  /**
   * POST: /api/authors/:id/match
   *
   * @param {AuthorControllerRequest} req
   * @param {Response} res
   */
  async match(req, res) {
    let authorData = null
    const region = req.body.region || 'us'
    if (req.body.asin && isValidASIN(req.body.asin.toUpperCase?.())) {
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
      if (imageData?.path) {
        req.author.imagePath = imageData.path
        hasUpdates = true
      }
    }

    if (authorData.description && req.author.description !== authorData.description) {
      req.author.description = authorData.description
      hasUpdates = true
    }

    if (hasUpdates) {
      await req.author.save()

      const numBooks = await Database.bookAuthorModel.getCountForAuthor(req.author.id)
      SocketAuthority.emitter('author_updated', req.author.toOldJSONExpanded(numBooks))
    }

    res.json({
      updated: hasUpdates,
      author: req.author.toOldJSON()
    })
  }

  /**
   * GET: /api/authors/:id/image
   *
   * @param {AuthorControllerRequest} req
   * @param {Response} res
   */
  async getImage(req, res) {
    const { raw } = req.query
    const author = await Database.authorModel.findByPk(req.params.id)
    if (!author || !author.imagePath) return res.sendStatus(404)

    // Set no-cache headers to always get the latest image
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0'
    })

    // Proxy external image URLs
    if (author.imagePath.startsWith('http')) {
      try {
        const response = await axios.get(author.imagePath, { responseType: 'stream' })
        res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg')
        response.data.pipe(res)
      } catch (err) {
        return res.sendStatus(404)
      }
      return
    }

    // Local file
    let imagePath = author.imagePath
    if (!Path.isAbsolute(imagePath)) {
      imagePath = Path.resolve(process.cwd(), imagePath)
    }
    if (!(await fs.pathExists(imagePath))) {
      return res.sendStatus(404)
    }

    if (raw) {
      return res.sendFile(imagePath)
    }

    const options = {
      format: 'jpeg',
      width: req.query.width ? parseInt(req.query.width) : null,
      height: req.query.height ? parseInt(req.query.height) : null
    }
    return CacheManager.handleAuthorCache(res, author.id, options)
  }

  /**
   * Middleware for author routes
   * @param {RequestWithUser} req
   * @param {Response} res
   * @param {NextFunction} next
   */
  async middleware(req, res, next) {
    const author = await Database.authorModel.findByPk(req.params.id)
    if (!author) return res.sendStatus(404)
    req.author = author

    if (req.method == 'DELETE' && !req.user.canDelete) {
      Logger.warn(`[AuthorController] User "${req.user.username}" attempted to delete without permission`)
      return res.sendStatus(403)
    } else if ((req.method == 'PATCH' || req.method == 'POST') && !req.user.canUpdate) {
      Logger.warn(`[AuthorController] User "${req.user.username}" attempted to update without permission`)
      return res.sendStatus(403)
    }

    next()
  }
}
module.exports = new AuthorController()
