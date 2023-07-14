const uuidv4 = require("uuid").v4

class Collection {
  constructor(collection) {
    this.id = null
    this.libraryId = null

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
      name: this.name,
      description: this.description,
      cover: this.cover,
      coverFullPath: this.coverFullPath,
      books: [...this.books],
      lastUpdate: this.lastUpdate,
      createdAt: this.createdAt
    }
  }

  toJSONExpanded(libraryItems, minifiedBooks = false) {
    const json = this.toJSON()
    json.books = json.books.map(bookId => {
      const book = libraryItems.find(li => li.id === bookId)
      return book ? minifiedBooks ? book.toJSONMinified() : book.toJSONExpanded() : null
    }).filter(b => !!b)
    return json
  }

  // Expanded and filtered out items not accessible to user
  toJSONExpandedForUser(user, libraryItems) {
    const json = this.toJSON()
    json.books = json.books.map(libraryItemId => {
      const libraryItem = libraryItems.find(li => li.id === libraryItemId)
      return libraryItem ? libraryItem.toJSONExpanded() : null
    }).filter(li => {
      return li && user.checkCanAccessLibraryItem(li)
    })
    return json
  }

  construct(collection) {
    this.id = collection.id
    this.libraryId = collection.libraryId
    this.name = collection.name
    this.description = collection.description || null
    this.cover = collection.cover || null
    this.coverFullPath = collection.coverFullPath || null
    this.books = collection.books ? [...collection.books] : []
    this.lastUpdate = collection.lastUpdate || null
    this.createdAt = collection.createdAt || null
  }

  setData(data) {
    if (!data.libraryId || !data.name) {
      return false
    }
    this.id = uuidv4()
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

  update(payload) {
    let hasUpdates = false
    for (const key in payload) {
      if (key === 'books') {
        if (payload.books && this.books.join(',') !== payload.books.join(',')) {
          this.books = [...payload.books]
          hasUpdates = true
        }
      } else if (this[key] !== undefined && this[key] !== payload[key]) {
        hasUpdates = true
        this[key] = payload[key]
      }
    }
    if (hasUpdates) {
      this.lastUpdate = Date.now()
    }
    return hasUpdates
  }
}
module.exports = Collection