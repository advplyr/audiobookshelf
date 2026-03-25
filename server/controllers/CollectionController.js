const { Request, Response, NextFunction } = require('express')
const Sequelize = require('sequelize')
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')
const htmlSanitizer = require('../utils/htmlSanitizer')

const RssFeedManager = require('../managers/RssFeedManager')

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 *
 * @typedef RequestEntityObject
 * @property {import('../models/Collection')} collection
 *
 * @typedef {RequestWithUser & RequestEntityObject} CollectionControllerRequest
 */

class CollectionController {
  constructor() {}

  /**
   * POST: /api/collections
   * Create new collection
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async create(req, res) {
    const reqBody = req.body || {}

    const nameCleaned = htmlSanitizer.stripAllTags(reqBody.name)

    // Validation
    if (!nameCleaned || !reqBody.libraryId) {
      return res.status(400).send('Invalid collection data')
    }
    if (reqBody.description && typeof reqBody.description !== 'string') {
      return res.status(400).send('Invalid collection description')
    }
    const libraryItemIds = (reqBody.books || []).filter((b) => !!b && typeof b == 'string')
    const seriesIds = (reqBody.seriesIds || []).filter((id) => !!id && typeof id === 'string')
    const uniqueSeriesIds = [...new Set(seriesIds)]

    // Must have at least one book or series
    if (!libraryItemIds.length && !uniqueSeriesIds.length) {
      return res.status(400).send('Invalid collection data. No books or series')
    }

    // Load and validate library items
    let libraryItems = []
    if (libraryItemIds.length) {
      libraryItems = await Database.libraryItemModel.findAll({
        attributes: ['id', 'mediaId', 'mediaType', 'libraryId'],
        where: {
          id: libraryItemIds,
          libraryId: reqBody.libraryId,
          mediaType: 'book'
        }
      })
      if (libraryItems.length !== libraryItemIds.length) {
        return res.status(400).send('Invalid collection data. Invalid books')
      }
    }

    // Validate series exist in the same library
    if (uniqueSeriesIds.length) {
      const seriesRecords = await Database.seriesModel.findAll({
        attributes: ['id'],
        where: {
          id: uniqueSeriesIds,
          libraryId: reqBody.libraryId
        }
      })
      if (seriesRecords.length !== uniqueSeriesIds.length) {
        return res.status(400).send('Invalid collection data. Invalid series')
      }
    }

    /** @type {import('../models/Collection')} */
    let newCollection = null

    const transaction = await Database.sequelize.transaction()
    try {
      // Create collection
      newCollection = await Database.collectionModel.create(
        {
          libraryId: reqBody.libraryId,
          name: nameCleaned,
          description: reqBody.description || null
        },
        { transaction }
      )

      // Create collectionBooks
      let order = 1
      if (libraryItemIds.length) {
        const collectionBookPayloads = libraryItemIds.map((llid) => {
          const libraryItem = libraryItems.find((li) => li.id === llid)
          return {
            collectionId: newCollection.id,
            bookId: libraryItem.mediaId,
            order: order++
          }
        })
        await Database.collectionBookModel.bulkCreate(collectionBookPayloads, { transaction })
      }

      // Create collectionSeriesItems
      if (uniqueSeriesIds.length) {
        const collectionSeriesPayloads = uniqueSeriesIds.map((seriesId) => ({
          collectionId: newCollection.id,
          seriesId,
          order: order++
        }))
        await Database.collectionSeriesItemModel.bulkCreate(collectionSeriesPayloads, { transaction })
      }

      await transaction.commit()
    } catch (error) {
      await transaction.rollback()
      Logger.error('[CollectionController] create:', error)
      return res.status(500).send('Failed to create collection')
    }

    // Load books and series expanded
    newCollection.books = await newCollection.getBooksExpandedWithLibraryItem()
    newCollection.collectionSeriesItems = await newCollection.getSeriesItemsExpanded()

    const jsonExpanded = newCollection.toOldJSONExpanded()
    SocketAuthority.emitter('collection_added', jsonExpanded)
    res.json(jsonExpanded)
  }

  /**
   * GET: /api/collections
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async findAll(req, res) {
    const collectionsExpanded = await Database.collectionModel.getOldCollectionsJsonExpanded(req.user)
    res.json({
      collections: collectionsExpanded
    })
  }

  /**
   * GET: /api/collections/:id
   *
   * @param {CollectionControllerRequest} req
   * @param {Response} res
   */
  async findOne(req, res) {
    const includeEntities = (req.query.include || '').split(',')

    const collectionExpanded = await req.collection.getOldJsonExpanded(req.user, includeEntities)
    if (!collectionExpanded) {
      // This may happen if the user is restricted from all books
      return res.sendStatus(404)
    }

    res.json(collectionExpanded)
  }

  /**
   * PATCH: /api/collections/:id
   * Update collection
   *
   * @param {CollectionControllerRequest} req
   * @param {Response} res
   */
  async update(req, res) {
    let wasUpdated = false

    // Update description and name if defined
    const collectionUpdatePayload = {}
    if (req.body.description !== undefined && req.body.description !== req.collection.description) {
      collectionUpdatePayload.description = req.body.description
      wasUpdated = true
    }
    if (req.body.name !== undefined && typeof req.body.name === 'string') {
      const nameCleaned = htmlSanitizer.stripAllTags(req.body.name)
      if (nameCleaned !== req.collection.name) {
        collectionUpdatePayload.name = nameCleaned
        wasUpdated = true
      }
    }

    if (wasUpdated) {
      await req.collection.update(collectionUpdatePayload)
    }

    // If books array is passed in then update order in collection
    let collectionBooksUpdated = false
    if (req.body.books?.length) {
      const collectionBooks = await req.collection.getCollectionBooks({
        include: {
          model: Database.bookModel,
          include: Database.libraryItemModel
        },
        order: [['order', 'ASC']]
      })
      collectionBooks.sort((a, b) => {
        const aIndex = req.body.books.findIndex((lid) => lid === a.book.libraryItem.id)
        const bIndex = req.body.books.findIndex((lid) => lid === b.book.libraryItem.id)
        return aIndex - bIndex
      })
      for (let i = 0; i < collectionBooks.length; i++) {
        if (collectionBooks[i].order !== i + 1) {
          await collectionBooks[i].update({
            order: i + 1
          })
          collectionBooksUpdated = true
        }
      }

      if (collectionBooksUpdated) {
        req.collection.changed('updatedAt', true)
        await req.collection.save()
        wasUpdated = true
      }
    }

    const jsonExpanded = await req.collection.getOldJsonExpanded()
    if (wasUpdated) {
      SocketAuthority.emitter('collection_updated', jsonExpanded)
    }
    res.json(jsonExpanded)
  }

  /**
   * DELETE: /api/collections/:id
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {CollectionControllerRequest} req
   * @param {Response} res
   */
  async delete(req, res) {
    const jsonExpanded = await req.collection.getOldJsonExpanded()

    // Close rss feed - remove from db and emit socket event
    await RssFeedManager.closeFeedForEntityId(req.collection.id)

    await req.collection.destroy()

    SocketAuthority.emitter('collection_removed', jsonExpanded)
    res.sendStatus(200)
  }

  /**
   * POST: /api/collections/:id/book
   * Add a single book to a collection
   * Req.body { id: <library item id> }
   *
   * @param {CollectionControllerRequest} req
   * @param {Response} res
   */
  async addBook(req, res) {
    const libraryItem = await Database.libraryItemModel.findByPk(req.body.id, {
      attributes: ['libraryId', 'mediaId']
    })
    if (!libraryItem) {
      return res.status(404).send('Book not found')
    }
    if (libraryItem.libraryId !== req.collection.libraryId) {
      return res.status(400).send('Book in different library')
    }

    // Check if book is already in collection
    const collectionBooks = await req.collection.getCollectionBooks()
    if (collectionBooks.some((cb) => cb.bookId === libraryItem.mediaId)) {
      return res.status(400).send('Book already in collection')
    }

    // Create collectionBook record
    await Database.collectionBookModel.create({
      collectionId: req.collection.id,
      bookId: libraryItem.mediaId,
      order: collectionBooks.length + 1
    })
    const jsonExpanded = await req.collection.getOldJsonExpanded()
    SocketAuthority.emitter('collection_updated', jsonExpanded)
    res.json(jsonExpanded)
  }

  /**
   * DELETE: /api/collections/:id/book/:bookId
   * Remove a single book from a collection. Re-order books
   * Users with update permission can remove books from collections
   * TODO: bookId is actually libraryItemId. Clients need updating to use bookId
   *
   * @param {CollectionControllerRequest} req
   * @param {Response} res
   */
  async removeBook(req, res) {
    const libraryItem = await Database.libraryItemModel.findByPk(req.params.bookId, {
      attributes: ['mediaId']
    })
    if (!libraryItem) {
      return res.sendStatus(404)
    }

    // Get books in collection ordered
    const collectionBooks = await req.collection.getCollectionBooks({
      order: [['order', 'ASC']]
    })

    let jsonExpanded = null
    const collectionBookToRemove = collectionBooks.find((cb) => cb.bookId === libraryItem.mediaId)
    if (collectionBookToRemove) {
      // Remove collection book record
      await collectionBookToRemove.destroy()

      // Update order on collection books
      let order = 1
      for (const collectionBook of collectionBooks) {
        if (collectionBook.bookId === libraryItem.mediaId) continue
        if (collectionBook.order !== order) {
          await collectionBook.update({
            order
          })
        }
        order++
      }

      jsonExpanded = await req.collection.getOldJsonExpanded()
      SocketAuthority.emitter('collection_updated', jsonExpanded)
    } else {
      jsonExpanded = await req.collection.getOldJsonExpanded()
    }
    res.json(jsonExpanded)
  }

  /**
   * POST: /api/collections/:id/batch/add
   * Add multiple books to collection
   * Req.body { books: <Array of library item ids> }
   *
   * @param {CollectionControllerRequest} req
   * @param {Response} res
   */
  async addBatch(req, res) {
    // filter out invalid libraryItemIds
    const bookIdsToAdd = (req.body.books || []).filter((b) => !!b && typeof b == 'string')
    const seriesIdsToAdd = (req.body.seriesIds || []).filter((id) => !!id && typeof id === 'string')
    const uniqueSeriesIds = [...new Set(seriesIdsToAdd)]

    if (!bookIdsToAdd.length && !uniqueSeriesIds.length) {
      return res.status(400).send('Invalid request body. No books or series')
    }

    // Get library items associated with ids
    let libraryItems = []
    if (bookIdsToAdd.length) {
      libraryItems = await Database.libraryItemModel.findAll({
        attributes: ['id', 'mediaId', 'mediaType', 'libraryId'],
        where: {
          id: bookIdsToAdd,
          libraryId: req.collection.libraryId,
          mediaType: 'book'
        }
      })
      if (!libraryItems.length && !uniqueSeriesIds.length) {
        return res.status(400).send('Invalid request body. No valid books')
      }
    }

    // Validate series
    if (uniqueSeriesIds.length) {
      const seriesRecords = await Database.seriesModel.findAll({
        attributes: ['id'],
        where: {
          id: uniqueSeriesIds,
          libraryId: req.collection.libraryId
        }
      })
      if (seriesRecords.length !== uniqueSeriesIds.length) {
        return res.status(400).send('Invalid request body. Invalid series')
      }
    }

    // Get existing entries in collection
    /** @type {import('../models/CollectionBook')[]} */
    const collectionBooks = await req.collection.getCollectionBooks()
    const collectionSeriesItems = await req.collection.getCollectionSeriesItems()

    // Compute max order across both tables
    const maxBookOrder = collectionBooks.length ? Math.max(...collectionBooks.map((cb) => cb.order)) : 0
    const maxSeriesOrder = collectionSeriesItems.length ? Math.max(...collectionSeriesItems.map((csi) => csi.order)) : 0
    let order = Math.max(maxBookOrder, maxSeriesOrder) + 1

    const collectionBooksToAdd = []
    const collectionSeriesToAdd = []
    let hasUpdated = false

    // Check and set new collection books to add
    for (const libraryItem of libraryItems) {
      if (!collectionBooks.some((cb) => cb.bookId === libraryItem.mediaId)) {
        collectionBooksToAdd.push({
          collectionId: req.collection.id,
          bookId: libraryItem.mediaId,
          order: order++
        })
        hasUpdated = true
      } else {
        Logger.warn(`[CollectionController] addBatch: Library item ${libraryItem.id} already in collection`)
      }
    }

    // Check and set new collection series to add
    for (const seriesId of uniqueSeriesIds) {
      if (!collectionSeriesItems.some((csi) => csi.seriesId === seriesId)) {
        collectionSeriesToAdd.push({
          collectionId: req.collection.id,
          seriesId,
          order: order++
        })
        hasUpdated = true
      } else {
        Logger.warn(`[CollectionController] addBatch: Series ${seriesId} already in collection`)
      }
    }

    if (hasUpdated) {
      if (collectionBooksToAdd.length) {
        await Database.collectionBookModel.bulkCreate(collectionBooksToAdd)
      }
      if (collectionSeriesToAdd.length) {
        await Database.collectionSeriesItemModel.bulkCreate(collectionSeriesToAdd)
      }
    }

    const jsonExpanded = await req.collection.getOldJsonExpanded()
    if (hasUpdated) {
      SocketAuthority.emitter('collection_updated', jsonExpanded)
    }
    res.json(jsonExpanded)
  }

  /**
   * POST: /api/collections/:id/batch/remove
   * Remove multiple books from collection
   * Req.body { books: <Array of library item ids> }
   *
   * @param {CollectionControllerRequest} req
   * @param {Response} res
   */
  async removeBatch(req, res) {
    // filter out invalid libraryItemIds
    const bookIdsToRemove = (req.body.books || []).filter((b) => !!b && typeof b == 'string')
    if (!bookIdsToRemove.length) {
      return res.status(500).send('Invalid request body')
    }

    // Get library items associated with ids
    const libraryItems = await Database.libraryItemModel.findAll({
      where: {
        id: bookIdsToRemove
      },
      include: {
        model: Database.bookModel
      }
    })

    // Get collection books already in collection
    /** @type {import('../models/CollectionBook')[]} */
    const collectionBooks = await req.collection.getCollectionBooks({
      order: [['order', 'ASC']]
    })

    // Remove collection books and update order
    let order = 1
    let hasUpdated = false
    for (const collectionBook of collectionBooks) {
      if (libraryItems.some((li) => li.media.id === collectionBook.bookId)) {
        await collectionBook.destroy()
        hasUpdated = true
        continue
      } else if (collectionBook.order !== order) {
        await collectionBook.update({
          order
        })
        hasUpdated = true
      }
      order++
    }

    let jsonExpanded = await req.collection.getOldJsonExpanded()
    if (hasUpdated) {
      SocketAuthority.emitter('collection_updated', jsonExpanded)
    }
    res.json(jsonExpanded)
  }

  /**
   * DELETE: /api/collections/:id/series/:seriesId
   * Remove a series entry from collection
   *
   * @param {CollectionControllerRequest} req
   * @param {Response} res
   */
  async removeSeries(req, res) {
    const collectionSeriesItem = await Database.collectionSeriesItemModel.findOne({
      where: {
        collectionId: req.collection.id,
        seriesId: req.params.seriesId
      }
    })

    if (!collectionSeriesItem) {
      // Idempotent - return 200 if series not in collection
      const jsonExpanded = await req.collection.getOldJsonExpanded()
      return res.json(jsonExpanded)
    }

    // Remove record
    await collectionSeriesItem.destroy()

    // Re-compact orders across both tables
    const collectionBooks = await req.collection.getCollectionBooks({ order: [['order', 'ASC']] })
    const remainingSeriesItems = await req.collection.getCollectionSeriesItems({ order: [['order', 'ASC']] })

    // Merge and sort by current order
    const allEntries = [
      ...collectionBooks.map((cb) => ({ record: cb, order: cb.order })),
      ...remainingSeriesItems.map((csi) => ({ record: csi, order: csi.order }))
    ].sort((a, b) => a.order - b.order)

    // Reassign sequential orders
    for (let i = 0; i < allEntries.length; i++) {
      if (allEntries[i].record.order !== i + 1) {
        await allEntries[i].record.update({ order: i + 1 })
      }
    }

    const jsonExpanded = await req.collection.getOldJsonExpanded()
    SocketAuthority.emitter('collection_updated', jsonExpanded)
    res.json(jsonExpanded)
  }

  /**
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   * @param {NextFunction} next
   */
  async middleware(req, res, next) {
    if (req.params.id) {
      const collection = await Database.collectionModel.findByPk(req.params.id)
      if (!collection) {
        return res.status(404).send('Collection not found')
      }
      req.collection = collection
    }

    // Users with update permission can remove books/series from collections
    if (req.method == 'DELETE' && !req.params.bookId && !req.params.seriesId && !req.user.canDelete) {
      Logger.warn(`[CollectionController] User "${req.user.username}" attempted to delete without permission`)
      return res.sendStatus(403)
    } else if ((req.method == 'PATCH' || req.method == 'POST') && !req.user.canUpdate) {
      Logger.warn(`[CollectionController] User "${req.user.username}" attempted to update without permission`)
      return res.sendStatus(403)
    }

    next()
  }
}
module.exports = new CollectionController()
