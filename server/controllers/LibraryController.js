const Path = require('path')
const fs = require('fs-extra')
const filePerms = require('../utils/filePerms')
const Logger = require('../Logger')
const Library = require('../objects/Library')
const libraryHelpers = require('../utils/libraryHelpers')
const { sort, createNewSortInstance } = require('../libs/fastSort')
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

    // Validate folder paths exist or can be created & resolve rel paths
    //   returns 400 if a folder fails to access
    newLibraryPayload.folders = newLibraryPayload.folders.map(f => {
      f.fullPath = Path.resolve(f.fullPath)
      return f
    })
    for (var folder of newLibraryPayload.folders) {
      try {
        var direxists = await fs.pathExists(folder.fullPath)
        if (!direxists) { // If folder does not exist try to make it and set file permissions/owner
          await fs.mkdir(folder.fullPath)
          await filePerms.setDefault(folder.fullPath)
        }
      } catch (error) {
        Logger.error(`[LibraryController] Failed to ensure folder dir "${folder.fullPath}"`, error)
        return res.status(400).send(`Invalid folder directory "${folder.fullPath}"`)
      }
    }

    var library = new Library()
    newLibraryPayload.displayOrder = this.db.libraries.length + 1
    library.setData(newLibraryPayload)
    await this.db.insertEntity('library', library)
    // TODO: Only emit to users that have access
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
        issues: req.libraryItems.filter(li => li.hasIssues).length,
        library: req.library
      })
    }
    return res.json(req.library)
  }

  async update(req, res) {
    var library = req.library

    // Validate new folder paths exist or can be created & resolve rel paths
    //   returns 400 if a new folder fails to access
    if (req.body.folders) {
      var newFolderPaths = []
      req.body.folders = req.body.folders.map(f => {
        if (!f.id) {
          f.fullPath = Path.resolve(f.fullPath)
          newFolderPaths.push(f.fullPath)
        }
        return f
      })
      for (var path of newFolderPaths) {
        var pathExists = await fs.pathExists(path)
        if (!pathExists) {
          // Ensure dir will recursively create directories which might be preferred over mkdir
          var success = await fs.ensureDir(path).then(() => true).catch((error) => {
            Logger.error(`[LibraryController] Failed to ensure folder dir "${path}"`, error)
            return false
          })
          if (!success) {
            return res.status(400).send(`Invalid folder directory "${path}"`)
          }
          // Set permissions on newly created path
          await filePerms.setDefault(path)
        }
      }
    }

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
    var libraryItems = req.libraryItems
    var payload = {
      results: [],
      total: libraryItems.length,
      limit: req.query.limit && !isNaN(req.query.limit) ? Number(req.query.limit) : 0,
      page: req.query.page && !isNaN(req.query.page) ? Number(req.query.page) : 0,
      sortBy: req.query.sort,
      sortDesc: req.query.desc === '1',
      filterBy: req.query.filter,
      mediaType: req.library.mediaType,
      minified: req.query.minified === '1',
      collapseseries: req.query.collapseseries === '1'
    }

    var filterSeries = null
    if (payload.filterBy) {
      // If filtering by series, will include seriesName and seriesSequence on media metadata
      filterSeries = (payload.mediaType == 'book' && payload.filterBy.startsWith('series.')) ? libraryHelpers.decode(payload.filterBy.replace('series.', '')) : null

      libraryItems = libraryHelpers.getFilteredLibraryItems(libraryItems, payload.filterBy, req.user)
      payload.total = libraryItems.length
    }

    if (payload.sortBy) {
      var sortKey = payload.sortBy

      // old sort key TODO: should be mutated in dbMigration
      if (sortKey.startsWith('book.')) {
        sortKey = sortKey.replace('book.', 'media.metadata.')
      }

      // Handle server setting sortingIgnorePrefix
      if (sortKey === 'media.metadata.title' && this.db.serverSettings.sortingIgnorePrefix) {
        // BookMetadata.js has titleIgnorePrefix getter
        sortKey += 'IgnorePrefix'
      }

      // Start sort
      var direction = payload.sortDesc ? 'desc' : 'asc'
      var sortArray = [
        {
          [direction]: (li) => {
            // Supports dot notation strings i.e. "media.metadata.title"
            return sortKey.split('.').reduce((a, b) => a[b], li)
          }
        }
      ]

      // Secondary sort when sorting by book author use series sort title
      if (payload.mediaType === 'book' && payload.sortBy.includes('author')) {
        sortArray.push({
          asc: (li) => {
            if (li.media.metadata.series && li.media.metadata.series.length) {
              return li.media.metadata.getSeriesSortTitle(li.media.metadata.series[0])
            }
            return null
          }
        })
      }
      libraryItems = naturalSort(libraryItems).by(sortArray)
    }

    if (payload.collapseseries) {
      libraryItems = libraryHelpers.collapseBookSeries(libraryItems)
      payload.total = libraryItems.length
    } else if (filterSeries) {
      // Book media when filtering series will include series object on media metadata
      libraryItems = libraryItems.map(li => {
        var series = li.media.metadata.getSeries(filterSeries)
        var liJson = payload.minified ? li.toJSONMinified() : li.toJSON()
        liJson.media.metadata.series = series
        return liJson
      })
      libraryItems = naturalSort(libraryItems).asc(li => li.media.metadata.series.sequence)
    } else {
      libraryItems = libraryItems.map(li => payload.minified ? li.toJSONMinified() : li.toJSON())
    }

    if (payload.limit) {
      var startIndex = payload.page * payload.limit
      libraryItems = libraryItems.slice(startIndex, startIndex + payload.limit)
    }
    payload.results = libraryItems
    res.json(payload)
  }

  async removeLibraryItemsWithIssues(req, res) {
    var libraryItemsWithIssues = req.libraryItems.filter(li => li.hasIssues)
    if (!libraryItemsWithIssues.length) {
      Logger.warn(`[LibraryController] No library items have issues`)
      return res.sendStatus(200)
    }

    Logger.info(`[LibraryController] Removing ${libraryItemsWithIssues.length} items with issues`)
    for (const libraryItem of libraryItemsWithIssues) {
      Logger.info(`[LibraryController] Removing library item "${libraryItem.media.metadata.title}"`)
      await this.handleDeleteLibraryItem(libraryItem)
    }

    res.sendStatus(200)
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
    series = sort(series).asc(s => {
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

    var collections = this.db.collections.filter(c => c.libraryId === req.library.id).map(c => {
      var expanded = c.toJSONExpanded(libraryItems, payload.minified)
      // If all books restricted to user in this collection then hide this collection
      if (!expanded.books.length && c.books.length) return null
      return expanded
    }).filter(c => !!c)

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

  // api/libraries/:id/personalized
  // New and improved personalized call only loops through library items once
  async getLibraryUserPersonalizedOptimal(req, res) {
    const mediaType = req.library.mediaType
    const libraryItems = req.libraryItems
    const limitPerShelf = req.query.limit && !isNaN(req.query.limit) ? Number(req.query.limit) : 10

    const categories = libraryHelpers.buildPersonalizedShelves(req.user, libraryItems, mediaType, this.db.series, this.db.authors, limitPerShelf)
    res.json(categories)
  }

  // PATCH: Change the order of libraries
  async reorder(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error('[LibraryController] ReorderLibraries invalid user', req.user)
      return res.sendStatus(403)
    }

    var orderdata = req.body
    var hasUpdates = false
    for (let i = 0; i < orderdata.length; i++) {
      var library = this.db.libraries.find(lib => lib.id === orderdata[i].id)
      if (!library) {
        Logger.error(`[LibraryController] Invalid library not found in reorder ${orderdata[i].id}`)
        return res.sendStatus(500)
      }
      if (library.update({ displayOrder: orderdata[i].newOrder })) {
        hasUpdates = true
        await this.db.updateEntity('library', library)
      }
    }

    if (hasUpdates) {
      this.db.libraries.sort((a, b) => a.displayOrder - b.displayOrder)
      Logger.debug(`[LibraryController] Updated library display orders`)
    } else {
      Logger.debug(`[LibraryController] Library orders were up to date`)
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
          libraryItem: li.toJSONExpanded(),
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
    var itemKey = req.library.mediaType
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

    res.json(naturalSort(Object.values(authors)).asc(au => au.name))
  }

  async matchAll(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[LibraryController] Non-root user attempted to match library items`, req.user)
      return res.sendStatus(403)
    }
    this.scanner.matchLibraryItems(req.library)
    res.sendStatus(200)
  }

  // GET: api/scan (Root)
  async scan(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[LibraryController] Non-root user attempted to scan library`, req.user)
      return res.sendStatus(403)
    }
    var options = {
      forceRescan: req.query.force == 1
    }
    res.sendStatus(200)
    await this.scanner.scan(req.library, options)
    Logger.info('[LibraryController] Scan complete')
  }

  middleware(req, res, next) {
    if (!req.user.checkCanAccessLibrary(req.params.id)) {
      Logger.warn(`[LibraryController] Library ${req.params.id} not accessible to user ${req.user.username}`)
      return res.sendStatus(404)
    }

    var library = this.db.libraries.find(lib => lib.id === req.params.id)
    if (!library) {
      return res.status(404).send('Library not found')
    }
    req.library = library
    req.libraryItems = this.db.libraryItems.filter(li => {
      return li.libraryId === library.id && req.user.checkCanAccessLibraryItem(li)
    })
    next()
  }
}
module.exports = new LibraryController()