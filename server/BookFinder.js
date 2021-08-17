const OpenLibrary = require('./providers/OpenLibrary')
const LibGen = require('./providers/LibGen')

class BookFinder {
  constructor() {
    this.openLibrary = new OpenLibrary()
    this.libGen = new LibGen()
  }

  async findByISBN(isbn) {
    var book = await this.openLibrary.isbnLookup(isbn)
    if (book.errorCode) {
      console.error('Book not found')
    }
    return book
  }

  async search(query, provider = 'openlibrary') {
    var books = null

    if (provider === 'libgen') {
      books = await this.libGen.search(query)
      return books
    }

    books = await this.openLibrary.search(query)
    if (books.errorCode) {
      console.error('Books not found')
    }
    return books
  }
}
module.exports = BookFinder