const Logger = require('../Logger')
const Library = require('../objects/Library')

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

  findOne(req, res) {
    if (!req.params.id) return res.status(500).send('Invalid id parameter')

    var library = this.db.libraries.find(lib => lib.id === req.params.id)
    if (!library) {
      return res.status(404).send('Library not found')
    }
    return res.json(library.toJSON())
  }

  async update(req, res) {
    var library = this.db.libraries.find(lib => lib.id === req.params.id)
    if (!library) {
      return res.status(404).send('Library not found')
    }
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
    var library = this.db.libraries.find(lib => lib.id === req.params.id)
    if (!library) {
      return res.status(404).send('Library not found')
    }

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
    var libraryId = req.params.id
    var library = this.db.libraries.find(lib => lib.id === libraryId)
    if (!library) {
      return res.status(400).send('Library does not exist')
    }

    var audiobooks = []
    if (req.query.q) {
      audiobooks = this.db.audiobooks.filter(ab => {
        return ab.libraryId === libraryId && ab.isSearchMatch(req.query.q)
      }).map(ab => ab.toJSONMinified())
    } else {
      audiobooks = this.db.audiobooks.filter(ab => ab.libraryId === libraryId).map(ab => ab.toJSONMinified())
    }
    res.json(audiobooks)
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
    var library = this.db.libraries.find(lib => lib.id === req.params.id)
    if (!library) {
      return res.status(404).send('Library not found')
    }
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
}
module.exports = new LibraryController()