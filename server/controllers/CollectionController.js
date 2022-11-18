const Logger = require('../Logger')
const Collection = require('../objects/Collection')

class CollectionController {
  constructor() { }

  async create(req, res) {
    var newCollection = new Collection()
    req.body.userId = req.user.id
    var success = newCollection.setData(req.body)
    if (!success) {
      return res.status(500).send('Invalid collection data')
    }
    var jsonExpanded = newCollection.toJSONExpanded(this.db.libraryItems)
    await this.db.insertEntity('collection', newCollection)
    this.emitter('collection_added', jsonExpanded)
    res.json(jsonExpanded)
  }

  findAll(req, res) {
    var expandedCollections = this.db.collections.map(c => c.toJSONExpanded(this.db.libraryItems))
    res.json(expandedCollections)
  }

  findOne(req, res) {
    res.json(req.collection.toJSONExpanded(this.db.libraryItems))
  }

  async update(req, res) {
    const collection = req.collection
    var wasUpdated = collection.update(req.body)
    var jsonExpanded = collection.toJSONExpanded(this.db.libraryItems)
    if (wasUpdated) {
      await this.db.updateEntity('collection', collection)
      this.emitter('collection_updated', jsonExpanded)
    }
    res.json(jsonExpanded)
  }

  async delete(req, res) {
    const collection = req.collection
    var jsonExpanded = collection.toJSONExpanded(this.db.libraryItems)
    await this.db.removeEntity('collection', collection.id)
    this.emitter('collection_removed', jsonExpanded)
    res.sendStatus(200)
  }

  async addBook(req, res) {
    const collection = req.collection
    var libraryItem = this.db.libraryItems.find(li => li.id === req.body.id)
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
    var jsonExpanded = collection.toJSONExpanded(this.db.libraryItems)
    await this.db.updateEntity('collection', collection)
    this.emitter('collection_updated', jsonExpanded)
    res.json(jsonExpanded)
  }

  // DELETE: api/collections/:id/book/:bookId
  async removeBook(req, res) {
    const collection = req.collection
    if (collection.books.includes(req.params.bookId)) {
      collection.removeBook(req.params.bookId)
      var jsonExpanded = collection.toJSONExpanded(this.db.libraryItems)
      await this.db.updateEntity('collection', collection)
      this.emitter('collection_updated', jsonExpanded)
    }
    res.json(collection.toJSONExpanded(this.db.libraryItems))
  }

  // POST: api/collections/:id/batch/add
  async addBatch(req, res) {
    const collection = req.collection
    if (!req.body.books || !req.body.books.length) {
      return res.status(500).send('Invalid request body')
    }
    var bookIdsToAdd = req.body.books
    var hasUpdated = false
    for (let i = 0; i < bookIdsToAdd.length; i++) {
      if (!collection.books.includes(bookIdsToAdd[i])) {
        collection.addBook(bookIdsToAdd[i])
        hasUpdated = true
      }
    }
    if (hasUpdated) {
      await this.db.updateEntity('collection', collection)
      this.emitter('collection_updated', collection.toJSONExpanded(this.db.libraryItems))
    }
    res.json(collection.toJSONExpanded(this.db.libraryItems))
  }

  // POST: api/collections/:id/batch/remove
  async removeBatch(req, res) {
    const collection = req.collection
    if (!req.body.books || !req.body.books.length) {
      return res.status(500).send('Invalid request body')
    }
    var bookIdsToRemove = req.body.books
    var hasUpdated = false
    for (let i = 0; i < bookIdsToRemove.length; i++) {
      if (collection.books.includes(bookIdsToRemove[i])) {
        collection.removeBook(bookIdsToRemove[i])
        hasUpdated = true
      }
    }
    if (hasUpdated) {
      await this.db.updateEntity('collection', collection)
      this.emitter('collection_updated', collection.toJSONExpanded(this.db.libraryItems))
    }
    res.json(collection.toJSONExpanded(this.db.libraryItems))
  }

  middleware(req, res, next) {
    if (req.params.id) {
      var collection = this.db.collections.find(c => c.id === req.params.id)
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