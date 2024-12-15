const { Request, Response, NextFunction } = require('express')
const Sequelize = require('sequelize')
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')

const RssFeedManager = require('../managers/RssFeedManager')
const Collection = require('../objects/Collection')

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
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
    const newCollection = new Collection()
    req.body.userId = req.user.id
    if (!newCollection.setData(req.body)) {
      return res.status(400).send('Invalid collection data')
    }

    // Create collection record
    await Database.collectionModel.createFromOld(newCollection)

    // Get library items in collection
    const libraryItemsInCollection = await Database.libraryItemModel.getForCollection(newCollection)

    // Create collectionBook records
    let order = 1
    const collectionBooksToAdd = []
    for (const libraryItemId of newCollection.books) {
      const libraryItem = libraryItemsInCollection.find((li) => li.id === libraryItemId)
      if (libraryItem) {
        collectionBooksToAdd.push({
          collectionId: newCollection.id,
          bookId: libraryItem.media.id,
          order: order++
        })
      }
    }
    if (collectionBooksToAdd.length) {
      await Database.createBulkCollectionBooks(collectionBooksToAdd)
    }

    const jsonExpanded = newCollection.toJSONExpanded(libraryItemsInCollection)
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
   * @param {RequestWithUser} req
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
   * @param {RequestWithUser} req
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
    if (req.body.name !== undefined && req.body.name !== req.collection.name) {
      collectionUpdatePayload.name = req.body.name
      wasUpdated = true
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
   * @param {RequestWithUser} req
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
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async addBook(req, res) {
    const libraryItem = await Database.libraryItemModel.getOldById(req.body.id)
    if (!libraryItem) {
      return res.status(404).send('Book not found')
    }
    if (libraryItem.libraryId !== req.collection.libraryId) {
      return res.status(400).send('Book in different library')
    }

    // Check if book is already in collection
    const collectionBooks = await req.collection.getCollectionBooks()
    if (collectionBooks.some((cb) => cb.bookId === libraryItem.media.id)) {
      return res.status(400).send('Book already in collection')
    }

    // Create collectionBook record
    await Database.collectionBookModel.create({
      collectionId: req.collection.id,
      bookId: libraryItem.media.id,
      order: collectionBooks.length + 1
    })
    const jsonExpanded = await req.collection.getOldJsonExpanded()
    SocketAuthority.emitter('collection_updated', jsonExpanded)
    res.json(jsonExpanded)
  }

  /**
   * DELETE: /api/collections/:id/book/:bookId
   * Remove a single book from a collection. Re-order books
   * TODO: bookId is actually libraryItemId. Clients need updating to use bookId
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async removeBook(req, res) {
    const libraryItem = await Database.libraryItemModel.getOldById(req.params.bookId)
    if (!libraryItem) {
      return res.sendStatus(404)
    }

    // Get books in collection ordered
    const collectionBooks = await req.collection.getCollectionBooks({
      order: [['order', 'ASC']]
    })

    let jsonExpanded = null
    const collectionBookToRemove = collectionBooks.find((cb) => cb.bookId === libraryItem.media.id)
    if (collectionBookToRemove) {
      // Remove collection book record
      await collectionBookToRemove.destroy()

      // Update order on collection books
      let order = 1
      for (const collectionBook of collectionBooks) {
        if (collectionBook.bookId === libraryItem.media.id) continue
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
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async addBatch(req, res) {
    // filter out invalid libraryItemIds
    const bookIdsToAdd = (req.body.books || []).filter((b) => !!b && typeof b == 'string')
    if (!bookIdsToAdd.length) {
      return res.status(500).send('Invalid request body')
    }

    // Get library items associated with ids
    const libraryItems = await Database.libraryItemModel.findAll({
      where: {
        id: {
          [Sequelize.Op.in]: bookIdsToAdd
        }
      },
      include: {
        model: Database.bookModel
      }
    })

    // Get collection books already in collection
    const collectionBooks = await req.collection.getCollectionBooks()

    let order = collectionBooks.length + 1
    const collectionBooksToAdd = []
    let hasUpdated = false

    // Check and set new collection books to add
    for (const libraryItem of libraryItems) {
      if (!collectionBooks.some((cb) => cb.bookId === libraryItem.media.id)) {
        collectionBooksToAdd.push({
          collectionId: req.collection.id,
          bookId: libraryItem.media.id,
          order: order++
        })
        hasUpdated = true
      } else {
        Logger.warn(`[CollectionController] addBatch: Library item ${libraryItem.id} already in collection`)
      }
    }

    let jsonExpanded = null
    if (hasUpdated) {
      await Database.createBulkCollectionBooks(collectionBooksToAdd)
      jsonExpanded = await req.collection.getOldJsonExpanded()
      SocketAuthority.emitter('collection_updated', jsonExpanded)
    } else {
      jsonExpanded = await req.collection.getOldJsonExpanded()
    }
    res.json(jsonExpanded)
  }

  /**
   * POST: /api/collections/:id/batch/remove
   * Remove multiple books from collection
   * Req.body { books: <Array of library item ids> }
   *
   * @param {RequestWithUser} req
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
        id: {
          [Sequelize.Op.in]: bookIdsToRemove
        }
      },
      include: {
        model: Database.bookModel
      }
    })

    // Get collection books already in collection
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

    if (req.method == 'DELETE' && !req.user.canDelete) {
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
