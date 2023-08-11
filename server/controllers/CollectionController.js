const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')

const Collection = require('../objects/Collection')

class CollectionController {
  constructor() { }

  async create(req, res) {
    const newCollection = new Collection()
    req.body.userId = req.user.id
    if (!newCollection.setData(req.body)) {
      return res.status(500).send('Invalid collection data')
    }

    const libraryItemsInCollection = await Database.models.libraryItem.getForCollection(newCollection)
    const jsonExpanded = newCollection.toJSONExpanded(libraryItemsInCollection)
    await Database.createCollection(newCollection)
    SocketAuthority.emitter('collection_added', jsonExpanded)
    res.json(jsonExpanded)
  }

  async findAll(req, res) {
    const collectionsExpanded = await Database.models.collection.getOldCollectionsJsonExpanded(req.user)
    res.json({
      collections: collectionsExpanded
    })
  }

  async findOne(req, res) {
    const includeEntities = (req.query.include || '').split(',')

    const collectionExpanded = req.collection.toJSONExpanded(Database.libraryItems)

    if (includeEntities.includes('rssfeed')) {
      const feedData = await this.rssFeedManager.findFeedForEntityId(collectionExpanded.id)
      collectionExpanded.rssFeed = feedData?.toJSONMinified() || null
    }

    res.json(collectionExpanded)
  }

  async update(req, res) {
    const collection = req.collection
    const wasUpdated = collection.update(req.body)
    const jsonExpanded = collection.toJSONExpanded(Database.libraryItems)
    if (wasUpdated) {
      await Database.updateCollection(collection)
      SocketAuthority.emitter('collection_updated', jsonExpanded)
    }
    res.json(jsonExpanded)
  }

  async delete(req, res) {
    const collection = req.collection
    const jsonExpanded = collection.toJSONExpanded(Database.libraryItems)

    // Close rss feed - remove from db and emit socket event
    await this.rssFeedManager.closeFeedForEntityId(collection.id)

    await Database.removeCollection(collection.id)
    SocketAuthority.emitter('collection_removed', jsonExpanded)
    res.sendStatus(200)
  }

  async addBook(req, res) {
    const collection = req.collection
    const libraryItem = Database.libraryItems.find(li => li.id === req.body.id)
    if (!libraryItem) {
      return res.status(500).send('Book not found')
    }
    if (libraryItem.libraryId !== collection.libraryId) {
      return res.status(500).send('Book in different library')
    }
    if (collection.books.includes(req.body.id)) {
      return res.status(500).send('Book already in collection')
    }
    collection.addBook(req.body.id)
    const jsonExpanded = collection.toJSONExpanded(Database.libraryItems)

    const collectionBook = {
      collectionId: collection.id,
      bookId: libraryItem.media.id,
      order: collection.books.length
    }
    await Database.createCollectionBook(collectionBook)
    SocketAuthority.emitter('collection_updated', jsonExpanded)
    res.json(jsonExpanded)
  }

  // DELETE: api/collections/:id/book/:bookId
  async removeBook(req, res) {
    const collection = req.collection
    const libraryItem = Database.libraryItems.find(li => li.id === req.params.bookId)
    if (!libraryItem) {
      return res.sendStatus(404)
    }

    if (collection.books.includes(req.params.bookId)) {
      collection.removeBook(req.params.bookId)
      const jsonExpanded = collection.toJSONExpanded(Database.libraryItems)
      SocketAuthority.emitter('collection_updated', jsonExpanded)
      await Database.updateCollection(collection)
    }
    res.json(collection.toJSONExpanded(Database.libraryItems))
  }

  // POST: api/collections/:id/batch/add
  async addBatch(req, res) {
    const collection = req.collection
    if (!req.body.books || !req.body.books.length) {
      return res.status(500).send('Invalid request body')
    }
    const bookIdsToAdd = req.body.books
    const collectionBooksToAdd = []
    let hasUpdated = false

    let order = collection.books.length
    for (const libraryItemId of bookIdsToAdd) {
      const libraryItem = Database.libraryItems.find(li => li.id === libraryItemId)
      if (!libraryItem) continue
      if (!collection.books.includes(libraryItemId)) {
        collection.addBook(libraryItemId)
        collectionBooksToAdd.push({
          collectionId: collection.id,
          bookId: libraryItem.media.id,
          order: order++
        })
        hasUpdated = true
      }
    }

    if (hasUpdated) {
      await Database.createBulkCollectionBooks(collectionBooksToAdd)
      SocketAuthority.emitter('collection_updated', collection.toJSONExpanded(Database.libraryItems))
    }
    res.json(collection.toJSONExpanded(Database.libraryItems))
  }

  // POST: api/collections/:id/batch/remove
  async removeBatch(req, res) {
    const collection = req.collection
    if (!req.body.books || !req.body.books.length) {
      return res.status(500).send('Invalid request body')
    }
    var bookIdsToRemove = req.body.books
    let hasUpdated = false
    for (const libraryItemId of bookIdsToRemove) {
      const libraryItem = Database.libraryItems.find(li => li.id === libraryItemId)
      if (!libraryItem) continue

      if (collection.books.includes(libraryItemId)) {
        collection.removeBook(libraryItemId)
        hasUpdated = true
      }
    }
    if (hasUpdated) {
      await Database.updateCollection(collection)
      SocketAuthority.emitter('collection_updated', collection.toJSONExpanded(Database.libraryItems))
    }
    res.json(collection.toJSONExpanded(Database.libraryItems))
  }

  async middleware(req, res, next) {
    if (req.params.id) {
      const collection = await Database.models.collection.getById(req.params.id)
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