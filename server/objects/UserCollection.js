const Logger = require('../Logger')

class UserCollection {
  constructor(collection) {
    this.id = null
    this.libraryId = null
    this.userId = null

    this.name = null
    this.description = null

    this.cover = null
    this.coverFullPath = null
    this.books = []

    this.lastUpdate = null
    this.createdAt = null

    if (collection) {
      this.construct(collection)
    }
  }

  toJSON() {
    return {
      id: this.id,
      libraryId: this.libraryId,
      userId: this.userId,
      name: this.name,
      description: this.description,
      cover: this.cover,
      coverFullPath: this.coverFullPath,
      books: [...this.books],
      lastUpdate: this.lastUpdate,
      createdAt: this.createdAt
    }
  }

  toJSONExpanded(audiobooks) {
    var json = this.toJSON()
    json.books = json.books.map(bookId => {
      var _ab = audiobooks.find(ab => ab.id === bookId)
      return _ab ? _ab.toJSON() : null
    }).filter(b => !!b)
    return json
  }

  construct(collection) {
    this.id = collection.id
    this.libraryId = collection.libraryId
    this.userId = collection.userId
    this.name = collection.name
    this.description = collection.description || null
    this.cover = collection.cover || null
    this.coverFullPath = collection.coverFullPath || null
    this.books = collection.books ? [...collection.books] : []
    this.lastUpdate = collection.lastUpdate || null
    this.createdAt = collection.createdAt || null
  }

  setData(data) {
    if (!data.userId || !data.libraryId || !data.name) {
      return false
    }
    this.id = (Math.trunc(Math.random() * 1000) + Date.now()).toString(36)
    this.userId = data.userId
    this.libraryId = data.libraryId
    this.name = data.name
    this.description = data.description || null
    this.cover = data.cover || null
    this.coverFullPath = data.coverFullPath || null
    this.books = data.books ? [...data.books] : []
    this.lastUpdate = Date.now()
    this.createdAt = Date.now()
    return true
  }

  addBook(bookId) {
    this.books.push(bookId)
    this.lastUpdate = Date.now()
  }

  removeBook(bookId) {
    this.books = this.books.filter(bid => bid !== bookId)
    this.lastUpdate = Date.now()
  }
}
module.exports = UserCollection