const Logger = require('../Logger')
const Library = require('../objects/Library')
const { sort, createNewSortInstance } = require('fast-sort')
const libraryHelpers = require('../utils/libraryHelpers')
const naturalSort = createNewSortInstance({
  comparer: new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare
})
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
    var librariesAccessible = req.user.librariesAccessible || []
    if (librariesAccessible && librariesAccessible.length) {
      return res.json(this.db.libraries.filter(lib => librariesAccessible.includes(lib.id)).map(lib => lib.toJSON()))
    }

    res.json(this.db.libraries.map(lib => lib.toJSON()))
  }

  async findOne(req, res) {
    if (req.query.include && req.query.include === 'filterdata') {
      return res.json({
        filterdata: libraryHelpers.getDistinctFilterDataNew(req.libraryItems),
        issues: libraryHelpers.getNumIssues(req.libraryItems),
        library: req.library
      })
    }
    return res.json(req.library)
  }

  async update(req, res) {
    var library = req.library

    var hasUpdates = library.update(req.body)
    // TODO: Should check if this is an update to folder paths or name only
    if (hasUpdates) {
      // Update watcher
      this.watcher.updateLibrary(library)

      // Remove libraryItems no longer in library
      var itemsToRemove = this.db.libraryItems.filter(li => li.libraryId === library.id && !library.checkFullPathInLibrary(li.path))
      if (itemsToRemove.length) {
        Logger.info(`[Scanner] Updating library, removing ${itemsToRemove.length} items`)
        for (let i = 0; i < itemsToRemove.length; i++) {
          await this.handleDeleteLibraryItem(itemsToRemove[i])
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

    // Remove items in this library
    var libraryItems = this.db.libraryItems.filter(li => li.libraryId === library.id)
    Logger.info(`[Server] deleting library "${library.name}" with ${libraryItems.length} items"`)
    for (let i = 0; i < libraryItems.length; i++) {
      await this.handleDeleteLibraryItem(libraryItems[i])
    }

    var libraryJson = library.toJSON()
    await this.db.removeEntity('library', library.id)
    this.emitter('library_removed', libraryJson)
    return res.json(libraryJson)
  }

  // api/libraries/:id/items
  // TODO: Optimize this method, items are iterated through several times but can be combined
  getLibraryItems(req, res) {
    var media = req.query.media || 'all'
    var libraryItems = req.libraryItems.filter(li => {
      if (media != 'all') return li.mediaType == media
      return true
    })
    var payload = {
      results: [],
      total: libraryItems.length,
      limit: req.query.limit && !isNaN(req.query.limit) ? Number(req.query.limit) : 0,
      page: req.query.page && !isNaN(req.query.page) ? Number(req.query.page) : 0,
      sortBy: req.query.sort,
      sortDesc: req.query.desc === '1',
      filterBy: req.query.filter,
      media,
      minified: req.query.minified === '1',
      collapseseries: req.query.collapseseries === '1'
    }

    if (payload.filterBy) {
      libraryItems = libraryHelpers.getFilteredLibraryItems(libraryItems, payload.filterBy, req.user)
      payload.total = libraryItems.length
    }

    if (payload.sortBy) {
      var sortKey = payload.sortBy

      // old sort key
      if (sortKey.startsWith('book.')) {
        sortKey = sortKey.replace('book.', 'media.metadata.')
      }

      // Handle server setting sortingIgnorePrefix
      if (sortKey === 'media.metadata.title' && this.db.serverSettings.sortingIgnorePrefix) {
        // BookMetadata.js has titleIgnorePrefix getter
        sortKey += 'IgnorePrefix'
      }

      var direction = payload.sortDesc ? 'desc' : 'asc'
      libraryItems = naturalSort(libraryItems)[direction]((li) => {

        // Supports dot notation strings i.e. "media.metadata.title"
        return sortKey.split('.').reduce((a, b) => a[b], li)
      })
    }

    // TODO: Potentially implement collapse series again
    libraryItems = libraryItems.map(ab => payload.minified ? ab.toJSONMinified() : ab.toJSON())

    if (payload.limit) {
      var startIndex = payload.page * payload.limit
      libraryItems = libraryItems.slice(startIndex, startIndex + payload.limit)
    }
    payload.results = libraryItems
    res.json(payload)
  }

  // api/libraries/:id/series
  async getAllSeriesForLibrary(req, res) {
    var libraryItems = req.libraryItems
    var payload = {
      results: [],
      total: 0,
      limit: req.query.limit && !isNaN(req.query.limit) ? Number(req.query.limit) : 0,
      page: req.query.page && !isNaN(req.query.page) ? Number(req.query.page) : 0,
      sortBy: req.query.sort,
      sortDesc: req.query.desc === '1',
      filterBy: req.query.filter,
      minified: req.query.minified === '1'
    }

    var series = libraryHelpers.getSeriesFromBooks(libraryItems, payload.minified)

    var sortingIgnorePrefix = this.db.serverSettings.sortingIgnorePrefix
    series = sort(series).asc(s => {
      if (sortingIgnorePrefix && s.name.toLowerCase().startsWith('the ')) {
        return s.name.substr(4)
      }
      return s.name
    })
    payload.total = series.length

    if (payload.limit) {
      var startIndex = payload.page * payload.limit
      series = series.slice(startIndex, startIndex + payload.limit)
    }

    payload.results = series
    res.json(payload)
  }

  // GET: api/libraries/:id/series/:series
  async getSeriesForLibrary(req, res) {
    if (!req.params.series) {
      return res.status(403).send('Invalid series')
    }
    var libraryItems = this.db.libraryItems.filter(li => li.libraryId === req.library.id && li.book.series === req.params.series)
    if (!libraryItems.length) {
      return res.status(404).send('Series not found')
    }
    var sortedBooks = libraryHelpers.sortSeriesBooks(libraryItems, false)
    res.json({
      results: sortedBooks,
      total: libraryItems.length
    })
  }

  // api/libraries/:id/collections
  async getCollectionsForLibrary(req, res) {
    var libraryItems = req.libraryItems

    var payload = {
      results: [],
      total: 0,
      limit: req.query.limit && !isNaN(req.query.limit) ? Number(req.query.limit) : 0,
      page: req.query.page && !isNaN(req.query.page) ? Number(req.query.page) : 0,
      sortBy: req.query.sort,
      sortDesc: req.query.desc === '1',
      filterBy: req.query.filter,
      minified: req.query.minified === '1'
    }

    var collections = this.db.collections.filter(c => c.libraryId === req.library.id).map(c => c.toJSONExpanded(libraryItems, payload.minified))
    payload.total = collections.length

    if (payload.limit) {
      var startIndex = payload.page * payload.limit
      collections = collections.slice(startIndex, startIndex + payload.limit)
    }

    payload.results = collections
    res.json(payload)
  }

  async getLibraryFilterData(req, res) {
    res.json(libraryHelpers.getDistinctFilterDataNew(req.libraryItems))
  }

  // api/libraries/:id/books/personalized
  async getLibraryUserPersonalized(req, res) {
    var libraryItems = req.libraryItems
    var limitPerShelf = req.query.limit && !isNaN(req.query.limit) ? Number(req.query.limit) : 12
    var minified = req.query.minified === '1'

    var booksWithUserAb = libraryHelpers.getBooksWithUserAudiobook(req.user, libraryItems)

    var categories = [
      {
        id: 'continue-reading',
        label: 'Continue Reading',
        type: 'books',
        entities: libraryHelpers.getBooksMostRecentlyRead(booksWithUserAb, limitPerShelf, minified)
      },
      {
        id: 'recently-added',
        label: 'Recently Added',
        type: 'books',
        entities: libraryHelpers.getBooksMostRecentlyAdded(libraryItems, limitPerShelf, minified)
      },
      {
        id: 'read-again',
        label: 'Read Again',
        type: 'books',
        entities: libraryHelpers.getBooksMostRecentlyFinished(booksWithUserAb, limitPerShelf, minified)
      }
    ].filter(cats => { // Remove categories with no items
      return cats.entities.length
    })

    res.json(categories)
  }

  // LEGACY
  // api/libraries/:id/books/categories
  async getLibraryCategories(req, res) {
    var library = req.library
    var books = this.db.audiobooks.filter(ab => ab.libraryId === library.id)
    var limitPerShelf = req.query.limit && !isNaN(req.query.limit) ? Number(req.query.limit) : 12
    var minified = req.query.minified === '1'

    var booksWithUserAb = libraryHelpers.getBooksWithUserAudiobook(req.user, books)
    var series = libraryHelpers.getSeriesFromBooks(books, minified)
    var seriesWithUserAb = libraryHelpers.getSeriesWithProgressFromBooks(req.user, books)

    var categories = [
      {
        id: 'continue-reading',
        label: 'Continue Reading',
        type: 'books',
        entities: libraryHelpers.getBooksMostRecentlyRead(booksWithUserAb, limitPerShelf, minified)
      },
      {
        id: 'continue-series',
        label: 'Continue Series',
        type: 'books',
        entities: libraryHelpers.getBooksNextInSeries(seriesWithUserAb, limitPerShelf, minified)
      },
      {
        id: 'recently-added',
        label: 'Recently Added',
        type: 'books',
        entities: libraryHelpers.getBooksMostRecentlyAdded(books, limitPerShelf, minified)
      },
      {
        id: 'read-again',
        label: 'Read Again',
        type: 'books',
        entities: libraryHelpers.getBooksMostRecentlyFinished(booksWithUserAb, limitPerShelf, minified)
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
      return res.sendStatus(403)
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
    if (!req.query.q) {
      return res.status(400).send('No query string')
    }
    var libraryItems = req.libraryItems
    var maxResults = req.query.limit && !isNaN(req.query.limit) ? Number(req.query.limit) : 12

    var itemMatches = []
    var authorMatches = {}
    var seriesMatches = {}
    var tagMatches = {}

    libraryItems.forEach((li) => {
      var queryResult = li.searchQuery(req.query.q)
      if (queryResult.matchKey) {
        itemMatches.push({
          libraryItem: li,
          matchKey: queryResult.matchKey,
          matchText: queryResult.matchText
        })
      }
      if (queryResult.series && queryResult.series.length) {
        queryResult.series.forEach((se) => {
          if (!seriesMatches[se.id]) {
            var _series = this.db.series.find(_se => _se.id === se.id)
            if (_series) seriesMatches[se.id] = { series: _series.toJSON(), books: [li.toJSON()] }
          } else {
            seriesMatches[se.id].books.push(li.toJSON())
          }
        })
      }
      if (queryResult.authors && queryResult.authors.length) {
        queryResult.authors.forEach((au) => {
          if (!authorMatches[au.id]) {
            var _author = this.db.authors.find(_au => _au.id === au.id)
            if (_author) {
              authorMatches[au.id] = _author.toJSON()
              authorMatches[au.id].numBooks = 1
            }
          } else {
            authorMatches[au.id].numBooks++
          }
        })
      }
      if (queryResult.tags && queryResult.tags.length) {
        queryResult.tags.forEach((tag) => {
          if (!tagMatches[tag]) {
            tagMatches[tag] = { name: tag, books: [li.toJSON()] }
          } else {
            tagMatches[tag].books.push(li.toJSON())
          }
        })
      }
    })
    var itemKey = req.library.itemMediaType
    var results = {
      [itemKey]: itemMatches.slice(0, maxResults),
      tags: Object.values(tagMatches).slice(0, maxResults),
      authors: Object.values(authorMatches).slice(0, maxResults),
      series: Object.values(seriesMatches).slice(0, maxResults)
    }
    res.json(results)
  }

  async stats(req, res) {
    var libraryItems = req.libraryItems

    var authorsWithCount = libraryHelpers.getAuthorsWithCount(libraryItems)
    var genresWithCount = libraryHelpers.getGenresWithCount(libraryItems)
    var durationStats = libraryHelpers.getItemDurationStats(libraryItems)
    var stats = {
      totalItems: libraryItems.length,
      totalAuthors: Object.keys(authorsWithCount).length,
      totalGenres: Object.keys(genresWithCount).length,
      totalDuration: durationStats.totalDuration,
      longestItems: durationStats.longestItems,
      numAudioTracks: durationStats.numAudioTracks,
      totalSize: libraryHelpers.getLibraryItemsTotalSize(libraryItems),
      authorsWithCount,
      genresWithCount
    }
    res.json(stats)
  }

  async getAuthors(req, res) {
    var libraryItems = req.libraryItems
    var authors = {}
    libraryItems.forEach((li) => {
      if (li.media.metadata.authors && li.media.metadata.authors.length) {
        li.media.metadata.authors.forEach((au) => {
          if (!authors[au.id]) {
            var _author = this.db.authors.find(_au => _au.id === au.id)
            if (_author) {
              authors[au.id] = _author.toJSON()
              authors[au.id].numBooks = 1
            }
          } else {
            authors[au.id].numBooks++
          }
        })
      }
    })
    res.json(Object.values(authors))
  }

  async matchBooks(req, res) {
    if (!req.user.isRoot) {
      Logger.error(`[LibraryController] Non-root user attempted to match library books`, req.user)
      return res.sendStatus(403)
    }
    this.scanner.matchLibraryBooks(req.library)
    res.sendStatus(200)
  }

  middleware(req, res, next) {
    var librariesAccessible = req.user.librariesAccessible || []
    if (librariesAccessible && librariesAccessible.length && !librariesAccessible.includes(req.params.id)) {
      Logger.warn(`[LibraryController] Library ${req.params.id} not accessible to user ${req.user.username}`)
      return res.sendStatus(404)
    }

    var library = this.db.libraries.find(lib => lib.id === req.params.id)
    if (!library) {
      return res.status(404).send('Library not found')
    }
    req.library = library
    req.libraryItems = this.db.libraryItems.filter(li => li.libraryId === library.id)
    next()
  }
}
module.exports = new LibraryController()