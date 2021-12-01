const Logger = require('../Logger')
const Library = require('../objects/Library')
const { sort } = require('fast-sort')
const libraryHelpers = require('../utils/libraryHelpers')

class LibraryController {
  constructor() { }

  async create(req, res) {
    var newLibraryPayload = {
      ...req.body
    }
    if (!newLibraryPayload.name || !newLibraryPayload.folders || !newLibraryPayload.folders.length) {
      return res.status(500).send('Invalid request')
    }

    var library = new Library()
    newLibraryPayload.displayOrder = this.db.libraries.length + 1
    library.setData(newLibraryPayload)
    await this.db.insertEntity('library', library)
    this.emitter('library_added', library.toJSON())

    // Add library watcher
    this.watcher.addLibrary(library)

    res.json(library)
  }

  findAll(req, res) {
    res.json(this.db.libraries.map(lib => lib.toJSON()))
  }

  async findOne(req, res) {
    if (req.query.include && req.query.include === 'filterdata') {
      var books = this.db.audiobooks.filter(ab => ab.libraryId === req.library.id)
      return res.json({
        filterdata: libraryHelpers.getDistinctFilterData(books),
        library: req.library
      })
    }
    return res.json(req.library)
  }

  async update(req, res) {
    var library = req.library
    var hasUpdates = library.update(req.body)
    if (hasUpdates) {
      // Update watcher
      this.watcher.updateLibrary(library)

      // Remove audiobooks no longer in library
      var audiobooksToRemove = this.db.audiobooks.filter(ab => !library.checkFullPathInLibrary(ab.fullPath))
      if (audiobooksToRemove.length) {
        Logger.info(`[Scanner] Updating library, removing ${audiobooksToRemove.length} audiobooks`)
        for (let i = 0; i < audiobooksToRemove.length; i++) {
          await this.handleDeleteAudiobook(audiobooksToRemove[i])
        }
      }
      await this.db.updateEntity('library', library)
      this.emitter('library_updated', library.toJSON())
    }
    return res.json(library.toJSON())
  }

  async delete(req, res) {
    var library = req.library

    // Remove library watcher
    this.watcher.removeLibrary(library)

    // Remove audiobooks in this library
    var audiobooks = this.db.audiobooks.filter(ab => ab.libraryId === library.id)
    Logger.info(`[Server] deleting library "${library.name}" with ${audiobooks.length} audiobooks"`)
    for (let i = 0; i < audiobooks.length; i++) {
      await this.handleDeleteAudiobook(audiobooks[i])
    }

    var libraryJson = library.toJSON()
    await this.db.removeEntity('library', library.id)
    this.emitter('library_removed', libraryJson)
    return res.json(libraryJson)
  }

  // api/libraries/:id/books
  getBooksForLibrary(req, res) {
    var libraryId = req.library.id
    var audiobooks = this.db.audiobooks.filter(ab => ab.libraryId === libraryId)
    // if (req.query.q) {
    //   audiobooks = this.db.audiobooks.filter(ab => {
    //     return ab.libraryId === libraryId && ab.isSearchMatch(req.query.q)
    //   }).map(ab => ab.toJSONMinified())
    // } else {
    //   audiobooks = this.db.audiobooks.filter(ab => ab.libraryId === libraryId).map(ab => ab.toJSONMinified())
    // }

    if (req.query.filter) {
      audiobooks = libraryHelpers.getFiltered(audiobooks, req.query.filter, req.user)
    }


    if (req.query.sort) {
      var orderByNumber = req.query.sort === 'book.volumeNumber'
      var direction = req.query.desc === '1' ? 'desc' : 'asc'
      audiobooks = sort(audiobooks)[direction]((ab) => {
        // Supports dot notation strings i.e. "book.title"
        var value = req.query.sort.split('.').reduce((a, b) => a[b], ab)
        if (orderByNumber && !isNaN(value)) return Number(value)
        return value
      })
    }

    if (req.query.limit && !isNaN(req.query.limit)) {
      var page = req.query.page && !isNaN(req.query.page) ? Number(req.query.page) : 0
      var limit = Number(req.query.limit)
      var startIndex = page * limit
      audiobooks = audiobooks.slice(startIndex, startIndex + limit)
    }
    res.json(audiobooks)
  }

  // api/libraries/:id/books/all
  getBooksForLibrary2(req, res) {
    var libraryId = req.library.id

    var audiobooks = this.db.audiobooks.filter(ab => ab.libraryId === libraryId)
    var payload = {
      results: [],
      total: audiobooks.length,
      limit: req.query.limit && !isNaN(req.query.limit) ? Number(req.query.limit) : 0,
      page: req.query.page && !isNaN(req.query.page) ? Number(req.query.page) : 0,
      sortBy: req.query.sort,
      sortDesc: req.query.desc === '1',
      filterBy: req.query.filter
    }

    if (payload.filterBy) {
      audiobooks = libraryHelpers.getFiltered(audiobooks, payload.filterBy, req.user)
      payload.total = audiobooks.length
    }

    if (payload.sortBy) {
      var orderByNumber = payload.sortBy === 'book.volumeNumber'
      var direction = payload.sortDesc ? 'desc' : 'asc'
      audiobooks = sort(audiobooks)[direction]((ab) => {
        // Supports dot notation strings i.e. "book.title"
        var value = payload.sortBy.split('.').reduce((a, b) => a[b], ab)
        if (orderByNumber && !isNaN(value)) return Number(value)
        return value
      })
    }

    if (payload.limit) {
      var startIndex = payload.page * payload.limit
      audiobooks = audiobooks.slice(startIndex, startIndex + payload.limit)
    }
    payload.results = audiobooks.map(ab => ab.toJSONExpanded())
    console.log('returning books', audiobooks.length)

    res.json(payload)
  }

  // api/libraries/:id/series
  async getSeriesForLibrary(req, res) {
    var audiobooks = this.db.audiobooks.filter(ab => ab.libraryId === req.library.id)

    var payload = {
      results: [],
      total: 0,
      limit: req.query.limit && !isNaN(req.query.limit) ? Number(req.query.limit) : 0,
      page: req.query.page && !isNaN(req.query.page) ? Number(req.query.page) : 0,
      sortBy: req.query.sort,
      sortDesc: req.query.desc === '1',
      filterBy: req.query.filter
    }

    var series = libraryHelpers.getSeriesFromBooks(audiobooks)
    payload.total = series.length

    if (payload.limit) {
      var startIndex = payload.page * payload.limit
      series = series.slice(startIndex, startIndex + payload.limit)
    }

    payload.results = series
    console.log('returning series', series.length)

    res.json(payload)
  }

  // api/libraries/:id/series
  async getCollectionsForLibrary(req, res) {
    var audiobooks = this.db.audiobooks.filter(ab => ab.libraryId === req.library.id)

    var payload = {
      results: [],
      total: 0,
      limit: req.query.limit && !isNaN(req.query.limit) ? Number(req.query.limit) : 0,
      page: req.query.page && !isNaN(req.query.page) ? Number(req.query.page) : 0,
      sortBy: req.query.sort,
      sortDesc: req.query.desc === '1',
      filterBy: req.query.filter
    }

    var collections = this.db.collections.filter(c => c.libraryId === req.library.id).map(c => c.toJSONExpanded(audiobooks))
    payload.total = collections.length

    if (payload.limit) {
      var startIndex = payload.page * payload.limit
      collections = collections.slice(startIndex, startIndex + payload.limit)
    }

    payload.results = collections
    console.log('returning collections', collections.length)

    res.json(payload)
  }

  // api/libraries/:id/books/filters
  async getLibraryFilters(req, res) {
    var library = req.library
    var books = this.db.audiobooks.filter(ab => ab.libraryId === library.id)
    res.json(libraryHelpers.getDistinctFilterData(books))
  }

  // api/libraries/:id/books/categories
  async getLibraryCategories(req, res) {
    var library = req.library
    var books = this.db.audiobooks.filter(ab => ab.libraryId === library.id)
    var limitPerShelf = req.query.limit && !isNaN(req.query.limit) ? Number(req.query.limit) : 12

    var booksWithUserAb = libraryHelpers.getBooksWithUserAudiobook(req.user, books)
    var series = libraryHelpers.getSeriesFromBooks(books)

    var categories = [
      {
        id: 'continue-reading',
        label: 'Continue Reading',
        type: 'books',
        entities: libraryHelpers.getBooksMostRecentlyRead(booksWithUserAb, limitPerShelf)
      },
      {
        id: 'recently-added',
        label: 'Recently Added',
        type: 'books',
        entities: libraryHelpers.getBooksMostRecentlyAdded(books, limitPerShelf)
      },
      {
        id: 'read-again',
        label: 'Read Again',
        type: 'books',
        entities: libraryHelpers.getBooksMostRecentlyFinished(booksWithUserAb, limitPerShelf)
      },
      {
        id: 'recent-series',
        label: 'Recent Series',
        type: 'series',
        entities: libraryHelpers.getSeriesMostRecentlyAdded(series, limitPerShelf)
      }
    ].filter(cats => { // Remove categories with no items
      return cats.entities.length
    })

    res.json(categories)
  }

  // PATCH: Change the order of libraries
  async reorder(req, res) {
    if (!req.user.isRoot) {
      Logger.error('[ApiController] ReorderLibraries invalid user', req.user)
      return res.sendStatus(401)
    }

    var orderdata = req.body
    var hasUpdates = false
    for (let i = 0; i < orderdata.length; i++) {
      var library = this.db.libraries.find(lib => lib.id === orderdata[i].id)
      if (!library) {
        Logger.error(`[ApiController] Invalid library not found in reorder ${orderdata[i].id}`)
        return res.sendStatus(500)
      }
      if (library.update({ displayOrder: orderdata[i].newOrder })) {
        hasUpdates = true
        await this.db.updateEntity('library', library)
      }
    }

    if (hasUpdates) {
      Logger.info(`[ApiController] Updated library display orders`)
    } else {
      Logger.info(`[ApiController] Library orders were up to date`)
    }

    var libraries = this.db.libraries.map(lib => lib.toJSON())
    res.json(libraries)
  }

  // GET: Global library search
  search(req, res) {
    var library = req.library
    if (!req.query.q) {
      return res.status(400).send('No query string')
    }
    var maxResults = req.query.max || 3

    var bookMatches = []
    var authorMatches = {}
    var seriesMatches = {}
    var tagMatches = {}

    var audiobooksInLibrary = this.db.audiobooks.filter(ab => ab.libraryId === library.id)
    audiobooksInLibrary.forEach((ab) => {
      var queryResult = ab.searchQuery(req.query.q)
      if (queryResult.book) {
        var bookMatchObj = {
          audiobook: ab,
          matchKey: queryResult.book,
          matchText: queryResult.bookMatchText
        }
        bookMatches.push(bookMatchObj)
      }
      if (queryResult.authors) {
        queryResult.authors.forEach((author) => {
          if (!authorMatches[author]) {
            authorMatches[author] = {
              author: author
            }
          }
        })
      }
      if (queryResult.series) {
        if (!seriesMatches[queryResult.series]) {
          seriesMatches[queryResult.series] = {
            series: queryResult.series,
            audiobooks: [ab]
          }
        } else {
          seriesMatches[queryResult.series].audiobooks.push(ab)
        }
      }
      if (queryResult.tags && queryResult.tags.length) {
        queryResult.tags.forEach((tag) => {
          if (!tagMatches[tag]) {
            tagMatches[tag] = {
              tag,
              audiobooks: [ab]
            }
          } else {
            tagMatches[tag].audiobooks.push(ab)
          }
        })
      }
    })

    res.json({
      audiobooks: bookMatches.slice(0, maxResults),
      tags: Object.values(tagMatches).slice(0, maxResults),
      authors: Object.values(authorMatches).slice(0, maxResults),
      series: Object.values(seriesMatches).slice(0, maxResults)
    })
  }

  middleware(req, res, next) {
    var library = this.db.libraries.find(lib => lib.id === req.params.id)
    if (!library) {
      return res.status(404).send('Library not found')
    }
    req.library = library
    next()
  }
}
module.exports = new LibraryController()