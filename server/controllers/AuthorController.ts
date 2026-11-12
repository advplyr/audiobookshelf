import type { Request, Response, NextFunction } from 'express'
import type User from '../models/User'
import type Author from '../models/Author'
import type Book from '../models/Book'
import type LibraryItem from '../models/LibraryItem'
import * as sequelize from 'sequelize'
import fs from '../libs/fsExtra'
import { createNewSortInstance } from '../libs/fastSort'

import Logger from '../Logger'
import SocketAuthority from '../SocketAuthority'
import Database from '../Database'
import CacheManager from '../managers/CacheManager'
import CoverManager from '../managers/CoverManager'
import AuthorFinder from '../finders/AuthorFinder'

import { reqSupportsWebp, isValidASIN, clampPositiveInt } from '../utils/index'

const naturalSort = createNewSortInstance({
  comparer: new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare
})

type AuthorRequest<Body = unknown> = Request<Record<string, string>, unknown, Body, { include?: string; width?: string; height?: string; format?: string; raw?: string }> & { user: User }
type RequestWithAuthor<Body = unknown> = AuthorRequest<Body> & { author: Author }
type SeriesMetadata = { id: string; name: string | null; nameIgnorePrefix: string | null; sequence: string | null }
type SeriesItem = LibraryItem.MinifiedJSON & { media: { metadata: { series: SeriesMetadata } } }
type AuthorSeries = { id: string; name: string | null; items: SeriesItem[] }
type AuthorResponse = ReturnType<Author['toOldJSON']> & { series?: AuthorSeries[]; libraryItems?: LibraryItem.MinifiedJSON[] }

class AuthorController {
  constructor() {}

  /**
   * GET: /api/authors/:id
   */
  async findOne(req: RequestWithAuthor, res: Response) {
    const include = (req.query.include || '').split(',')

    const authorJson: AuthorResponse = req.author.toOldJSON()

    // Used on author landing page to include library items and items grouped in series
    if (include.includes('items')) {
      const libraryItems = await Database.libraryItemModel.getForAuthor(req.author, req.user)

      if (include.includes('series')) {
        const seriesMap: Record<string, AuthorSeries> = {}
        // Group items into series
        libraryItems.forEach((li) => {
          if (li.media.series?.length) {
            li.media.series.forEach((series) => {
              const itemWithSeries = li.toOldJSONMinified() as SeriesItem
              itemWithSeries.media.metadata.series = {
                id: series.id,
                name: series.name,
                nameIgnorePrefix: series.nameIgnorePrefix,
                sequence: series.bookSeries!.sequence
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
   */
  async update(req: RequestWithAuthor<Record<string, unknown>>, res: Response) {
    const keysToUpdate: readonly string[] = ['name', 'description', 'asin']
    const payload: Partial<Pick<Author, 'name' | 'description' | 'asin' | 'lastFirst'>> = {}
    for (const key in req.body) {
      const value = req.body[key]
      if (keysToUpdate.includes(key) && (typeof value === 'string' || value === null)) {
        payload[key as 'name' | 'description' | 'asin'] = value
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

    // Check if author name matches another author in the same library and merge the authors
    let existingAuthor = null
    if (authorNameUpdate) {
      existingAuthor = await Database.authorModel.findOne({
        where: {
          id: {
            [sequelize.Op.not]: req.author.id
          },
          name: payload.name,
          libraryId: req.author.libraryId
        }
      })
    }
    if (existingAuthor) {
      Logger.info(`[AuthorController] Merging author "${req.author.name}" with "${existingAuthor.name}"`)
      const bookAuthorsToCreate: { bookId: string; authorId: string }[] = []
      const allItemsWithAuthor = await Database.authorModel.getAllLibraryItemsForAuthor(req.author.id)
      const mergedAuthor = existingAuthor

      const libraryItems: LibraryItem[] = []
      allItemsWithAuthor.forEach((libraryItem) => {
        // Replace old author with merging author for each book
        const book = libraryItem.media as Book.BookExpanded
        book.authors = book.authors.filter((au) => au.id !== req.author.id)
        // The legacy merge appends just the fields needed to write book metadata.
        const authors: Pick<Author, 'id' | 'name'>[] = book.authors
        authors.push({ id: mergedAuthor.id, name: mergedAuthor.name })

        libraryItems.push(libraryItem)

        bookAuthorsToCreate.push({
          bookId: book.id,
          authorId: mergedAuthor.id
        })
      })
      if (libraryItems.length) {
        await Database.bookAuthorModel.removeByIds(req.author.id) // Remove all old BookAuthor
        await Database.bookAuthorModel.bulkCreate(bookAuthorsToCreate, { ignoreDuplicates: true }) // Create all new unique BookAuthor
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
      Database.removeAuthorFromFilterData(oldAuthorJSON.libraryId!, oldAuthorJSON.id)

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
        const libraryItems: LibraryItem[] = []
        // Update author name on all books
        for (const libraryItem of allItemsWithAuthor) {
          const book = libraryItem.media as Book.BookExpanded
          book.authors = book.authors.map((au) => {
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
   */
  async delete(req: RequestWithAuthor, res: Response) {
    Logger.info(`[AuthorController] Removing author "${req.author.name}"`)

    if (req.author.imagePath) {
      await CacheManager.purgeImageCache(req.author.id) // Purge cache
    }

    // Load library items so that metadata file can be updated
    const allItemsWithAuthor = await Database.authorModel.getAllLibraryItemsForAuthor(req.author.id)
    allItemsWithAuthor.forEach((libraryItem) => {
      const book = libraryItem.media as Book.BookExpanded
      book.authors = book.authors.filter((au) => au.id !== req.author.id)
    })

    await req.author.destroy()

    for (const libraryItem of allItemsWithAuthor) {
      await libraryItem.saveMetadataFile()
    }

    SocketAuthority.emitter('author_removed', req.author.toOldJSON())

    // Update filter data
    Database.removeAuthorFromFilterData(req.author.libraryId!, req.author.id)

    res.sendStatus(200)
  }

  /**
   * POST: /api/authors/:id/image
   * Upload author image from web URL
   */
  async uploadImage(req: RequestWithAuthor<{ url?: string }>, res: Response) {
    if (!req.user.canUpload) {
      Logger.warn(`User "${req.user.username}" attempted to upload an image without permission`)
      return res.sendStatus(403)
    }
    if (!req.body.url) {
      Logger.error(`[AuthorController] Invalid request payload. 'url' not in request body`)
      return res.status(400).send(`Invalid request payload. 'url' not in request body`)
    }
    if (!req.body.url.startsWith?.('http:') && !req.body.url.startsWith?.('https:')) {
      Logger.error(`[AuthorController] Invalid request payload. Invalid url "${req.body.url}"`)
      return res.status(400).send(`Invalid request payload. Invalid url "${req.body.url}"`)
    }

    Logger.debug(`[AuthorController] Requesting download author image from url "${req.body.url}"`)
    const result: { path?: string; error?: string } = await AuthorFinder.saveAuthorImage(req.author.id, req.body.url)

    if (result?.error) {
      return res.status(400).send(result.error)
    } else if (!result?.path) {
      return res.status(500).send('Unknown error occurred')
    }

    if (req.author.imagePath) {
      await CacheManager.purgeImageCache(req.author.id) // Purge cache
    }

    req.author.imagePath = result.path
    // imagePath may not have changed, but we still want to update the updatedAt field to bust image cache
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
   */
  async deleteImage(req: RequestWithAuthor, res: Response) {
    if (!req.author.imagePath) {
      Logger.error(`[AuthorController] Author "${req.author.imagePath}" has no imagePath set`)
      return res.status(400).send('Author has no image path set')
    }
    Logger.info(`[AuthorController] Removing image for author "${req.author.name}" at "${req.author.imagePath}"`)
    await CacheManager.purgeImageCache(req.author.id) // Purge cache
    await CoverManager.removeFile(req.author.imagePath)
    req.author.imagePath = null
    await req.author.save()

    const numBooks = await Database.bookAuthorModel.getCountForAuthor(req.author.id)
    SocketAuthority.emitter('author_updated', req.author.toOldJSONExpanded(numBooks))
    res.json({
      author: req.author.toOldJSON()
    })
  }

  /**
   * POST: /api/authors/:id/match
   */
  async match(req: RequestWithAuthor<{ region?: string; asin?: string; q: string }>, res: Response) {
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

      const imageData: { path?: string; error?: string } = await AuthorFinder.saveAuthorImage(req.author.id, authorData.image)
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
   */
  async getImage(req: AuthorRequest, res: Response) {
    const {
      query: { width, height, format, raw }
    } = req

    const authorId = req.params.id

    if (raw) {
      const author = await Database.authorModel.findByPk(authorId)
      if (!author) {
        Logger.warn(`[AuthorController] Author "${authorId}" not found`)
        return res.sendStatus(404)
      }

      if (!author.imagePath || !(await fs.pathExists(author.imagePath))) {
        Logger.warn(`[AuthorController] Author "${author.name}" has invalid imagePath: ${author.imagePath}`)
        return res.sendStatus(404)
      }

      return res.sendFile(author.imagePath)
    }

    const options = {
      format: format || (reqSupportsWebp(req) ? 'webp' : 'jpeg'),
      height: clampPositiveInt(height ? parseInt(height) : null, 4096),
      width: clampPositiveInt(width ? parseInt(width) : null, 4096)
    }
    return CacheManager.handleAuthorCache(res, authorId, options)
  }

  async middleware(req: AuthorRequest & { author?: Author }, res: Response, next: NextFunction) {
    const author = await Database.authorModel.findByPk(req.params.id)
    if (!author) return res.sendStatus(404)
    if (!req.user.checkCanAccessLibrary(author.libraryId)) return res.sendStatus(404)

    if (req.method == 'DELETE' && !req.user.canDelete) {
      Logger.warn(`[AuthorController] User "${req.user.username}" attempted to delete without permission`)
      return res.sendStatus(403)
    } else if ((req.method == 'PATCH' || req.method == 'POST') && !req.user.canUpdate) {
      Logger.warn(`[AuthorController] User "${req.user.username}" attempted to update without permission`)
      return res.sendStatus(403)
    }

    req.author = author
    next()
  }
}
export = new AuthorController()
