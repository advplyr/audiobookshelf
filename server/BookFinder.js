const OpenLibrary = require('./providers/OpenLibrary')
const LibGen = require('./providers/LibGen')
const Logger = require('./Logger')
const { levenshteinDistance } = require('./utils/index')

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

  stripSubtitle(title) {
    if (title.includes(':')) {
      return title.split(':')[0].trim()
    } else if (title.includes(' - ')) {
      return title.split(' - ')[0].trim()
    }
    return title
  }

  cleanTitleForCompares(title) {
    // Remove subtitle if there (i.e. "Cool Book: Coolest Ever" becomes "Cool Book")
    var stripped = this.stripSubtitle(title)

    // Remove text in paranthesis (i.e. "Ender's Game (Ender's Saga)" becomes "Ender's Game")
    var cleaned = stripped.replace(/ *\([^)]*\) */g, "")

    // Remove single quotes (i.e. "Ender's Game" becomes "Enders Game")
    cleaned = cleaned.replace(/'/g, '')
    return cleaned.toLowerCase()
  }

  filterSearchResults(books, title, author, maxTitleDistance, maxAuthorDistance) {
    var searchTitle = this.cleanTitleForCompares(title)
    return books.map(b => {
      b.cleanedTitle = this.cleanTitleForCompares(b.title)
      b.titleDistance = levenshteinDistance(b.cleanedTitle, title)
      if (author) {
        b.authorDistance = levenshteinDistance(b.author || '', author)
      }
      b.totalDistance = b.titleDistance + (b.authorDistance || 0)
      b.totalPossibleDistance = b.title.length

      if (b.cleanedTitle.includes(searchTitle) && searchTitle.length > 4) {
        b.includesSearch = searchTitle
      } else if (b.title.includes(searchTitle) && searchTitle.length > 4) {
        b.includesSearch = searchTitle
      }

      if (author && b.author) b.totalPossibleDistance += b.author.length

      return b
    }).filter(b => {
      if (b.includesSearch) { // If search was found in result title exactly then skip over leven distance check
        Logger.debug(`Exact search was found inside title ${b.cleanedTitle}/${b.includesSearch}`)
      } else if (b.titleDistance > maxTitleDistance) {
        Logger.debug(`Filtering out search result title distance = ${b.titleDistance}: "${b.cleanedTitle}"/"${searchTitle}"`)
        return false
      }

      if (author && b.authorDistance > maxAuthorDistance) {
        Logger.debug(`Filtering out search result "${b.title}", author distance = ${b.authorDistance}: "${b.author}"/"${author}"`)
        return false
      }

      if (b.totalPossibleDistance < 4 && b.totalDistance > 0) return false
      return true
    })
  }

  async getLibGenResults(title, author, maxTitleDistance, maxAuthorDistance) {
    var books = await this.libGen.search(title)
    Logger.info(`LibGen Book Search Results: ${books.length || 0}`)
    if (books.errorCode) {
      Logger.error(`LibGen Search Error ${books.errorCode}`)
      return []
    }
    var booksFiltered = this.filterSearchResults(books, title, author, maxTitleDistance, maxAuthorDistance)
    if (!booksFiltered.length && books.length) {
      Logger.info(`Search has ${books.length} matches, but no close title matches`)
    }
    return booksFiltered
  }

  async getOpenLibResults(title, author, maxTitleDistance, maxAuthorDistance) {
    var books = await this.openLibrary.searchTitle(title)
    Logger.info(`OpenLib Book Search Results: ${books.length || 0}`)
    if (books.errorCode) {
      Logger.error(`OpenLib Search Error ${books.errorCode}`)
      return []
    }
    var booksFiltered = this.filterSearchResults(books, title, author, maxTitleDistance, maxAuthorDistance)
    if (!booksFiltered.length && books.length) {
      Logger.info(`Search has ${books.length} matches, but no close title matches`)
    }
    return booksFiltered
  }

  async search(provider, title, author, options = {}) {
    var books = []
    var maxTitleDistance = !isNaN(options.titleDistance) ? Number(options.titleDistance) : 4
    var maxAuthorDistance = !isNaN(options.authorDistance) ? Number(options.authorDistance) : 4
    Logger.info(`Book Search, title: "${title}", author: "${author}", provider: ${provider}`)

    if (provider === 'libgen') {
      books = await this.getLibGenResults(title, author, maxTitleDistance, maxAuthorDistance)
    } else if (provider === 'openlibrary') {
      books = await this.getOpenLibResults(title, author, maxTitleDistance, maxAuthorDistance)
    } else if (provider === 'all') {
      var lbBooks = await this.getLibGenResults(title, author, maxTitleDistance, maxAuthorDistance)
      var olBooks = await this.getOpenLibResults(title, author, maxTitleDistance, maxAuthorDistance)
      books = books.concat(lbBooks, olBooks)
    } else {
      var olBooks = await this.getOpenLibResults(title, author, maxTitleDistance, maxAuthorDistance)
      var hasCloseMatch = olBooks.find(b => (b.totalDistance < 4 && b.totalPossibleDistance > 4))
      if (hasCloseMatch) {
        books = olBooks
      } else {
        Logger.info(`Book Search, LibGen has no close matches - get openlib results also`)
        var lbBooks = await this.getLibGenResults(title, author, maxTitleDistance, maxAuthorDistance)
        books = books.concat(lbBooks)
      }

      if (!books.length && author) {
        Logger.info(`Book Search, no matches for title and author.. check title only`)
        return this.search(provider, title, null, options)
      }
    }

    return books.sort((a, b) => {
      return a.totalDistance - b.totalDistance
    })
  }

  async findCovers(provider, title, author, options = {}) {
    var searchResults = await this.search(provider, title, author, options)
    console.log('Find Covers search results', searchResults)
    var covers = []
    searchResults.forEach((result) => {
      if (result.covers && result.covers.length) {
        covers = covers.concat(result.covers)
      }
      if (result.cover) {
        covers.push(result.cover)
      }
    })
    return covers
  }
}
module.exports = BookFinder