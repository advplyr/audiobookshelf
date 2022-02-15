const Logger = require('../Logger')
const { reqSupportsWebp } = require('../utils/index')

class BookController {
  constructor() { }

  findAll(req, res) {
    var audiobooks = []

    if (req.query.q) {
      audiobooks = this.db.audiobooks.filter(ab => {
        return ab.isSearchMatch(req.query.q)
      }).map(ab => ab.toJSONMinified())
    } else {
      audiobooks = this.db.audiobooks.map(ab => ab.toJSONMinified())
    }
    res.json(audiobooks)
  }

  findOne(req, res) {
    var audiobook = this.db.audiobooks.find(a => a.id === req.params.id)
    if (!audiobook) return res.sendStatus(404)

    // Check user can access this audiobooks library
    if (!req.user.checkCanAccessLibrary(audiobook.libraryId)) {
      return res.sendStatus(403)
    }

    res.json(audiobook.toJSONExpanded())
  }

  async update(req, res) {
    if (!req.user.canUpdate) {
      Logger.warn('User attempted to update without permission', req.user)
      return res.sendStatus(403)
    }
    var audiobook = this.db.audiobooks.find(a => a.id === req.params.id)
    if (!audiobook) return res.sendStatus(404)

    // Book has cover and update is removing cover then purge cache
    if (audiobook.cover && req.body.book && (req.body.book.cover === '' || req.body.book.cover === null)) {
      await this.cacheManager.purgeCoverCache(audiobook.id)
    }

    var hasUpdates = audiobook.update(req.body)
    if (hasUpdates) {
      await this.db.updateAudiobook(audiobook)
      this.emitter('audiobook_updated', audiobook.toJSONExpanded())
    }
    res.json(audiobook.toJSON())
  }

  async delete(req, res) {
    if (!req.user.canDelete) {
      Logger.warn('User attempted to delete without permission', req.user)
      return res.sendStatus(403)
    }
    var audiobook = this.db.audiobooks.find(a => a.id === req.params.id)
    if (!audiobook) return res.sendStatus(404)

    await this.handleDeleteAudiobook(audiobook)
    res.sendStatus(200)
  }

  // DELETE: api/books/all
  async deleteAll(req, res) {
    if (!req.user.isRoot) {
      Logger.warn('User other than root attempted to delete all audiobooks', req.user)
      return res.sendStatus(403)
    }
    Logger.info('Removing all Audiobooks')
    var success = await this.db.recreateAudiobookDb()
    if (success) res.sendStatus(200)
    else res.sendStatus(500)
  }


  // POST: api/books/batch/delete
  async batchDelete(req, res) {
    if (!req.user.canDelete) {
      Logger.warn('User attempted to delete without permission', req.user)
      return res.sendStatus(403)
    }
    var { audiobookIds } = req.body
    if (!audiobookIds || !audiobookIds.length) {
      return res.sendStatus(500)
    }

    var audiobooksToDelete = this.db.audiobooks.filter(ab => audiobookIds.includes(ab.id))
    if (!audiobooksToDelete.length) {
      return res.sendStatus(404)
    }
    for (let i = 0; i < audiobooksToDelete.length; i++) {
      Logger.info(`[ApiController] Deleting Audiobook "${audiobooksToDelete[i].title}"`)
      await this.handleDeleteAudiobook(audiobooksToDelete[i])
    }
    res.sendStatus(200)
  }

  // POST: api/books/batch/update
  async batchUpdate(req, res) {
    if (!req.user.canUpdate) {
      Logger.warn('User attempted to batch update without permission', req.user)
      return res.sendStatus(403)
    }
    var updatePayloads = req.body
    if (!updatePayloads || !updatePayloads.length) {
      return res.sendStatus(500)
    }

    var audiobooksUpdated = 0
    var audiobooks = updatePayloads.map((up) => {
      var audiobookUpdates = up.updates
      var ab = this.db.audiobooks.find(_ab => _ab.id === up.id)
      if (!ab) return null
      var hasUpdated = ab.update(audiobookUpdates)
      if (!hasUpdated) return null
      audiobooksUpdated++
      return ab
    }).filter(ab => ab)

    if (audiobooksUpdated) {
      Logger.info(`[ApiController] ${audiobooksUpdated} Audiobooks have updates`)
      for (let i = 0; i < audiobooks.length; i++) {
        await this.db.updateAudiobook(audiobooks[i])
        this.emitter('audiobook_updated', audiobooks[i].toJSONExpanded())
      }
    }

    res.json({
      success: true,
      updates: audiobooksUpdated
    })
  }

  // POST: api/books/batch/get
  async batchGet(req, res) {
    var bookIds = req.body.books || []
    if (!bookIds.length) {
      return res.status(403).send('Invalid payload')
    }
    var audiobooks = this.db.audiobooks.filter(ab => bookIds.includes(ab.id)).map((ab) => ab.toJSONExpanded())
    res.json(audiobooks)
  }

  // PATCH: api/books/:id/tracks
  async updateTracks(req, res) {
    if (!req.user.canUpdate) {
      Logger.warn('User attempted to update audiotracks without permission', req.user)
      return res.sendStatus(403)
    }
    var audiobook = this.db.audiobooks.find(a => a.id === req.params.id)
    if (!audiobook) return res.sendStatus(404)
    var orderedFileData = req.body.orderedFileData
    Logger.info(`Updating audiobook tracks called ${audiobook.id}`)
    audiobook.updateAudioTracks(orderedFileData)
    await this.db.updateAudiobook(audiobook)
    this.emitter('audiobook_updated', audiobook.toJSONExpanded())
    res.json(audiobook.toJSON())
  }

  // GET: api/books/:id/stream
  openStream(req, res) {
    var audiobook = this.db.audiobooks.find(a => a.id === req.params.id)
    if (!audiobook) return res.sendStatus(404)

    this.streamManager.openStreamApiRequest(res, req.user, audiobook)
  }

  // POST: api/books/:id/cover
  async uploadCover(req, res) {
    if (!req.user.canUpload || !req.user.canUpdate) {
      Logger.warn('User attempted to upload a cover without permission', req.user)
      return res.sendStatus(403)
    }

    var audiobookId = req.params.id
    var audiobook = this.db.audiobooks.find(ab => ab.id === audiobookId)
    if (!audiobook) {
      return res.status(404).send('Audiobook not found')
    }

    var result = null
    if (req.body && req.body.url) {
      Logger.debug(`[ApiController] Requesting download cover from url "${req.body.url}"`)
      result = await this.coverController.downloadCoverFromUrl(audiobook, req.body.url)
    } else if (req.files && req.files.cover) {
      Logger.debug(`[ApiController] Handling uploaded cover`)
      var coverFile = req.files.cover
      result = await this.coverController.uploadCover(audiobook, coverFile)
    } else {
      return res.status(400).send('Invalid request no file or url')
    }

    if (result && result.error) {
      return res.status(400).send(result.error)
    } else if (!result || !result.cover) {
      return res.status(500).send('Unknown error occurred')
    }

    await this.db.updateAudiobook(audiobook)
    this.emitter('audiobook_updated', audiobook.toJSONExpanded())
    res.json({
      success: true,
      cover: result.cover
    })
  }

  // PATCH api/books/:id/coverfile
  async updateCoverFromFile(req, res) {
    if (!req.user.canUpdate) {
      Logger.warn('User attempted to update without permission', req.user)
      return res.sendStatus(403)
    }
    var audiobook = this.db.audiobooks.find(a => a.id === req.params.id)
    if (!audiobook) return res.sendStatus(404)

    var coverFile = req.body
    var updated = await audiobook.setCoverFromFile(coverFile)

    if (updated) {
      await this.db.updateAudiobook(audiobook)
      await this.cacheManager.purgeCoverCache(audiobook.id)
      this.emitter('audiobook_updated', audiobook.toJSONExpanded())
    }

    if (updated) res.status(200).send('Cover updated successfully')
    else res.status(200).send('No update was made to cover')
  }

  // GET api/books/:id/cover
  async getCover(req, res) {
    let { query: { width, height, format }, params: { id } } = req
    var audiobook = this.db.audiobooks.find(a => a.id === id)
    if (!audiobook || !audiobook.book.cover) return res.sendStatus(404)

    // Check user can access this audiobooks library
    if (!req.user.checkCanAccessLibrary(audiobook.libraryId)) {
      return res.sendStatus(403)
    }

    // Temp fix for books without a full cover path
    if (audiobook.book.cover && !audiobook.book.coverFullPath) {
      var isFixed = audiobook.fixFullCoverPath()
      if (!isFixed) {
        Logger.warn(`[BookController] Failed to fix full cover path "${audiobook.book.cover}" for "${audiobook.book.title}"`)
        return res.sendStatus(404)
      }
      await this.db.updateEntity('audiobook', audiobook)
    }

    const options = {
      format: format || (reqSupportsWebp(req) ? 'webp' : 'jpeg'),
      height: height ? parseInt(height) : null,
      width: width ? parseInt(width) : null
    }
    return this.cacheManager.handleCoverCache(res, audiobook, options)
  }

  // POST api/books/:id/match
  async match(req, res) {
    if (!req.user.canUpdate) {
      Logger.warn('User attempted to match without permission', req.user)
      return res.sendStatus(403)
    }
    var audiobook = this.db.audiobooks.find(a => a.id === req.params.id)
    if (!audiobook || !audiobook.book.cover) return res.sendStatus(404)

    // Check user can access this audiobooks library
    if (!req.user.checkCanAccessLibrary(audiobook.libraryId)) {
      return res.sendStatus(403)
    }

    var options = req.body || {}
    var provider = options.provider || 'google'
    var searchTitle = options.title || audiobook.book._title
    var searchAuthor = options.author || audiobook.book._author

    var results = await this.bookFinder.search(provider, searchTitle, searchAuthor)
    if (!results.length) {
      return res.json({
        warning: `No ${provider} match found`
      })
    }
    var matchData = results[0]

    // Update cover if not set OR overrideCover flag
    var hasUpdated = false
    if (matchData.cover && (!audiobook.book.cover || options.overrideCover)) {
      Logger.debug(`[BookController] Updating cover "${matchData.cover}"`)
      var coverResult = await this.coverController.downloadCoverFromUrl(audiobook, matchData.cover)
      if (!coverResult || coverResult.error || !coverResult.cover) {
        Logger.warn(`[BookController] Match cover "${matchData.cover}" failed to use: ${coverResult ? coverResult.error : 'Unknown Error'}`)
      } else {
        hasUpdated = true
      }
    }

    // Update book details if not set OR overrideDetails flag
    const detailKeysToUpdate = ['title', 'subtitle', 'author', 'narrator', 'publisher', 'publishYear', 'series', 'volumeNumber', 'asin', 'isbn']
    const updatePayload = {}
    for (const key in matchData) {
      if (matchData[key] && detailKeysToUpdate.includes(key) && (!audiobook.book[key] || options.overrideDetails)) {
        updatePayload[key] = matchData[key]
      }
    }

    if (Object.keys(updatePayload).length) {
      Logger.debug('[BookController] Updating details', updatePayload)
      if (audiobook.update({ book: updatePayload })) {
        hasUpdated = true
      }
    }

    if (hasUpdated) {
      await this.db.updateEntity('audiobook', audiobook)
      this.emitter('audiobook_updated', audiobook.toJSONExpanded())
    }

    res.json({
      updated: hasUpdated,
      audiobook: audiobook.toJSONExpanded()
    })
  }
}
module.exports = new BookController()