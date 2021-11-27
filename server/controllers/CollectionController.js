const Logger = require('../Logger')
const UserCollection = require('../objects/UserCollection')

class CollectionController {
  constructor() { }

  async create(req, res) {
    var newCollection = new UserCollection()
    req.body.userId = req.user.id
    var success = newCollection.setData(req.body)
    if (!success) {
      return res.status(500).send('Invalid collection data')
    }
    var jsonExpanded = newCollection.toJSONExpanded(this.db.audiobooks)
    await this.db.insertEntity('collection', newCollection)
    this.emitter('collection_added', jsonExpanded)
    res.json(jsonExpanded)
  }

  findAll(req, res) {
    var collections = this.db.collections.filter(c => c.userId === req.user.id)
    var expandedCollections = collections.map(c => c.toJSONExpanded(this.db.audiobooks))
    res.json(expandedCollections)
  }

  findOne(req, res) {
    var collection = this.db.collections.find(c => c.id === req.params.id)
    if (!collection) {
      return res.status(404).send('Collection not found')
    }
    res.json(collection.toJSONExpanded(this.db.audiobooks))
  }

  async update(req, res) {
    var collection = this.db.collections.find(c => c.id === req.params.id)
    if (!collection) {
      return res.status(404).send('Collection not found')
    }
    var wasUpdated = collection.update(req.body)
    var jsonExpanded = collection.toJSONExpanded(this.db.audiobooks)
    if (wasUpdated) {
      await this.db.updateEntity('collection', collection)
      this.emitter('collection_updated', jsonExpanded)
    }
    res.json(jsonExpanded)
  }

  async delete(req, res) {
    var collection = this.db.collections.find(c => c.id === req.params.id)
    if (!collection) {
      return res.status(404).send('Collection not found')
    }
    var jsonExpanded = collection.toJSONExpanded(this.db.audiobooks)
    await this.db.removeEntity('collection', collection.id)
    this.emitter('collection_removed', jsonExpanded)
    res.sendStatus(200)
  }

  async addBook(req, res) {
    var collection = this.db.collections.find(c => c.id === req.params.id)
    if (!collection) {
      return res.status(404).send('Collection not found')
    }
    var audiobook = this.db.audiobooks.find(ab => ab.id === req.body.id)
    if (!audiobook) {
      return res.status(500).send('Book not found')
    }
    if (audiobook.libraryId !== collection.libraryId) {
      return res.status(500).send('Book in different library')
    }
    if (collection.books.includes(req.body.id)) {
      return res.status(500).send('Book already in collection')
    }
    collection.addBook(req.body.id)
    var jsonExpanded = collection.toJSONExpanded(this.db.audiobooks)
    await this.db.updateEntity('collection', collection)
    this.emitter('collection_updated', jsonExpanded)
    res.json(jsonExpanded)
  }

  // DELETE: api/collections/:id/book/:bookId
  async removeBook(req, res) {
    var collection = this.db.collections.find(c => c.id === req.params.id)
    if (!collection) {
      return res.status(404).send('Collection not found')
    }

    if (collection.books.includes(req.params.bookId)) {
      collection.removeBook(req.params.bookId)
      var jsonExpanded = collection.toJSONExpanded(this.db.audiobooks)
      await this.db.updateEntity('collection', collection)
      this.emitter('collection_updated', jsonExpanded)
    }
    res.json(collection.toJSONExpanded(this.db.audiobooks))
  }

  // POST: api/collections/:id/batch/add
  async addBatch(req, res) {
    var collection = this.db.collections.find(c => c.id === req.params.id)
    if (!collection) {
      return res.status(404).send('Collection not found')
    }
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
      this.emitter('collection_updated', collection.toJSONExpanded(this.db.audiobooks))
    }
    res.json(collection.toJSONExpanded(this.db.audiobooks))
  }

  // POST: api/collections/:id/batch/remove
  async removeBatch(req, res) {
    var collection = this.db.collections.find(c => c.id === req.params.id)
    if (!collection) {
      return res.status(404).send('Collection not found')
    }
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
      this.emitter('collection_updated', collection.toJSONExpanded(this.db.audiobooks))
    }
    res.json(collection.toJSONExpanded(this.db.audiobooks))
  }
}
module.exports = new CollectionController()