const Sequelize = require('sequelize')
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')

const Collection = require('../objects/Collection')

class CollectionController {
  constructor() { }

  /**
   * @openapi
   * /api/collections:
   *   post:
   *     operationId: createCollection
   *     summary: Create a new collection
   *     tags:
   *       - Collections
   *     requestBody:
   *       description: Data for creating a new collection
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               description:
   *                 type: string
   *               books:
   *                 type: array
   *                 items:
   *                   type: string
   *             required:
   *               name
   *     responses:
   *       200:
   *         description: Collection created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/collection'
   *       400:
   *         description: Invalid collection data
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
      const libraryItem = libraryItemsInCollection.find(li => li.id === libraryItemId)
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
   * @openapi
   * /api/collections:
   *   get:
   *     operationId: getAllCollections
   *     summary: Get all collections
   *     deprecated: true
   *     tags:
   *       - Collections
   *     responses:
   *       200:
   *         description: Collection created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/collectionExpanded'
   */
  async findAll(req, res) {
    const collectionsExpanded = await Database.collectionModel.getOldCollectionsJsonExpanded(req.user)
    res.json({
      collections: collectionsExpanded
    })
  }

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
   * @openapi
   * /api/collections/{id}:
   *   patch:
   *     operationId: updateCollection
   *     summary: Update an existing collection
   *     tags:
   *       - Collections
   *     parameters:
   *       - name: id
   *         in: path
   *         description: Collection ID
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       description: Data for updating an existing collection
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               libraryId:
   *                 type: string
   *               name:
   *                 type: string
   *               description:
   *                 type: [string, 'null']
   *               books:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       200:
   *         description: Collection created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/collectionExpanded'
   *       403:
   *         A user with update permissions is required to update collections
   *       404:
   *         description: No collection with the specified ID exists
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
    if (req.body.books?.length) {
      const collectionBooks = await req.collection.getCollectionBooks({
        include: {
          model: Database.bookModel,
          include: Database.libraryItemModel
        },
        order: [['order', 'ASC']]
      })
      collectionBooks.sort((a, b) => {
        const aIndex = req.body.books.findIndex(lid => lid === a.book.libraryItem.id)
        const bIndex = req.body.books.findIndex(lid => lid === b.book.libraryItem.id)
        return aIndex - bIndex
      })
      for (let i = 0; i < collectionBooks.length; i++) {
        if (collectionBooks[i].order !== i + 1) {
          await collectionBooks[i].update({
            order: i + 1
          })
          wasUpdated = true
        }
      }
    }

    const jsonExpanded = await req.collection.getOldJsonExpanded()
    if (wasUpdated) {
      SocketAuthority.emitter('collection_updated', jsonExpanded)
    }
    res.json(jsonExpanded)
  }
  /**
   * @openapi
   * /api/collections/{id}:
   *   delete:
   *     operationId: deleteCollection
   *     summary: Delete specified collection
   *     tags:
   *       - Collections
   *     parameters:
   *       - name: id
   *         in: path
   *         description: Collection ID
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Collection created successfully
   *       403:
   *         description: A user with delete permissions is required to delete a collection
   *       404:
   *         description: No collection with the specified ID exists
   */
  async delete(req, res) {
    const jsonExpanded = await req.collection.getOldJsonExpanded()

    // Close rss feed - remove from db and emit socket event
    await this.rssFeedManager.closeFeedForEntityId(req.collection.id)

    await req.collection.destroy()

    SocketAuthority.emitter('collection_removed', jsonExpanded)
    res.sendStatus(200)
  }

  /**
   * POST: /api/collections/:id/book
   * Add a single book to a collection
   * Req.body { id: <library item id> }
   * @param {*} req 
   * @param {*} res 
   */
  /**
   * @openapi
   * /api/collections/{id}/book:
   *   post:
   *     operationId: collectionAddBook
   *     summary: Add a single book to a collection
   *     tags:
   *       - Collections
   *     parameters:
   *       - name: id
   *         in: path
   *         description: Collection ID
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       description: Data for adding a single book to a collection
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               libraryId:
   *                 type: string
   *               books:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       200:
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/collectionExpanded'
   *       403:
   *         A user with update permissions is required to update collections
   *       404:
   *         description: No collection with the specified ID exists
   *       500:
   *         description: The provided library ID could not be found, is in
   *                      a different library, or is already in a collection
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
    if (collectionBooks.some(cb => cb.bookId === libraryItem.media.id)) {
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
   * @param {*} req 
   * @param {*} res 
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
    const collectionBookToRemove = collectionBooks.find(cb => cb.bookId === libraryItem.media.id)
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
   * @param {*} req 
   * @param {*} res 
   */
  async addBatch(req, res) {
    // filter out invalid libraryItemIds
    const bookIdsToAdd = (req.body.books || []).filter(b => !!b && typeof b == 'string')
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
      if (!collectionBooks.some(cb => cb.bookId === libraryItem.media.id)) {
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
   * @param {*} req 
   * @param {*} res 
   */
  async removeBatch(req, res) {
    // filter out invalid libraryItemIds
    const bookIdsToRemove = (req.body.books || []).filter(b => !!b && typeof b == 'string')
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
      if (libraryItems.some(li => li.media.id === collectionBook.bookId)) {
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

  async middleware(req, res, next) {
    if (req.params.id) {
      const collection = await Database.collectionModel.findByPk(req.params.id)
      if (!collection) {
        return res.status(404).send('Collection not found')
      }
      req.collection = collection
    }

    if (req.method == 'DELETE' && !req.user.canDelete) {
      Logger.warn(`[CollectionController] User attempted to delete without permission`, req.user.username)
      return res.sendStatus(403)
    } else if ((req.method == 'PATCH' || req.method == 'POST') && !req.user.canUpdate) {
      Logger.warn('[CollectionController] User attempted to update without permission', req.user.username)
      return res.sendStatus(403)
    }

    next()
  }
}
module.exports = new CollectionController()