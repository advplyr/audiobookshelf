const Logger = require('../Logger')
const { reqSupportsWebp } = require('../utils/index')
const { ScanResult } = require('../utils/constants')

class LibraryItemController {
  constructor() { }

  findOne(req, res) {
    if (req.query.expanded == 1) return res.json(req.libraryItem.toJSONExpanded())
    res.json(req.libraryItem)
  }

  async update(req, res) {
    var libraryItem = req.libraryItem
    // Item has cover and update is removing cover so purge it from cache
    if (libraryItem.media.coverPath && req.body.media && (req.body.media.coverPath === '' || req.body.media.coverPath === null)) {
      await this.cacheManager.purgeCoverCache(libraryItem.id)
    }

    var hasUpdates = libraryItem.update(req.body)
    if (hasUpdates) {
      Logger.debug(`[LibraryItemController] Updated now saving`)
      await this.db.updateLibraryItem(libraryItem)
      this.emitter('item_updated', libraryItem.toJSONExpanded())
    }
    res.json(libraryItem.toJSON())
  }

  async delete(req, res) {
    await this.handleDeleteLibraryItem(req.libraryItem)
    res.sendStatus(200)
  }

  //
  // PATCH: will create new authors & series if in payload
  //
  async updateMedia(req, res) {
    var libraryItem = req.libraryItem
    var mediaPayload = req.body
    // Item has cover and update is removing cover so purge it from cache
    if (libraryItem.media.coverPath && (mediaPayload.coverPath === '' || mediaPayload.coverPath === null)) {
      await this.cacheManager.purgeCoverCache(libraryItem.id)
    }

    await this.createAuthorsAndSeriesForItemUpdate(mediaPayload)

    var hasUpdates = libraryItem.media.update(mediaPayload)
    if (hasUpdates) {
      Logger.debug(`[LibraryItemController] Updated library item media ${libraryItem.media.metadata.title}`)
      await this.db.updateLibraryItem(libraryItem)
      this.emitter('item_updated', libraryItem.toJSONExpanded())
    }
    res.json({
      updated: hasUpdates,
      libraryItem
    })
  }

  // POST: api/items/:id/cover
  async uploadCover(req, res) {
    if (!req.user.canUpload) {
      Logger.warn('User attempted to upload a cover without permission', req.user)
      return res.sendStatus(403)
    }

    var libraryItem = req.libraryItem

    var result = null
    if (req.body && req.body.url) {
      Logger.debug(`[LibraryItemController] Requesting download cover from url "${req.body.url}"`)
      result = await this.coverController.downloadCoverFromUrl(libraryItem, req.body.url)
    } else if (req.files && req.files.cover) {
      Logger.debug(`[LibraryItemController] Handling uploaded cover`)
      result = await this.coverController.uploadCover(libraryItem, req.files.cover)
    } else {
      return res.status(400).send('Invalid request no file or url')
    }

    if (result && result.error) {
      return res.status(400).send(result.error)
    } else if (!result || !result.cover) {
      return res.status(500).send('Unknown error occurred')
    }

    await this.db.updateLibraryItem(libraryItem)
    this.emitter('item_updated', libraryItem.toJSONExpanded())
    res.json({
      success: true,
      cover: result.cover
    })
  }

  // PATCH: api/items/:id/cover
  async updateCover(req, res) {
    var libraryItem = req.libraryItem
    if (!req.body.cover) {
      return res.status(400).error('Invalid request no cover path')
    }

    var validationResult = await this.coverController.validateCoverPath(req.body.cover, libraryItem)
    if (validationResult.error) {
      return res.status(500).send(validationResult.error)
    }
    if (validationResult.updated) {
      await this.db.updateLibraryItem(libraryItem)
      this.emitter('item_updated', libraryItem.toJSONExpanded())
    }
    res.json({
      success: true,
      cover: validationResult.cover
    })
  }

  // DELETE: api/items/:id/cover
  async removeCover(req, res) {
    var libraryItem = req.libraryItem

    if (libraryItem.media.coverPath) {
      libraryItem.updateMediaCover('')
      await this.cacheManager.purgeCoverCache(libraryItem.id)
      await this.db.updateLibraryItem(libraryItem)
      this.emitter('item_updated', libraryItem.toJSONExpanded())
    }

    res.sendStatus(200)
  }

  // GET api/items/:id/cover
  async getCover(req, res) {
    let { query: { width, height, format }, libraryItem } = req

    const options = {
      format: format || (reqSupportsWebp(req) ? 'webp' : 'jpeg'),
      height: height ? parseInt(height) : null,
      width: width ? parseInt(width) : null
    }
    return this.cacheManager.handleCoverCache(res, libraryItem, options)
  }

  // GET: api/items/:id/stream
  openStream(req, res) {
    // this.streamManager.openStreamApiRequest(res, req.user, req.libraryItem)
    res.sendStatus(500)
  }


  // POST: api/items/:id/play
  startPlaybackSession(req, res) {
    var playbackMediaEntity = req.libraryItem.getPlaybackMediaEntity()
    if (!playbackMediaEntity) {
      Logger.error(`[LibraryItemController] startPlaybackSession no playback media entity ${req.libraryItem.id}`)
      return res.sendStatus(404)
    }
    const options = req.body || {}
    this.playbackSessionManager.startSessionRequest(req.user, req.libraryItem, playbackMediaEntity, options, res)
  }

  // POST api/items/:id/match
  async match(req, res) {
    var libraryItem = req.libraryItem

    var options = req.body || {}
    var matchResult = await this.scanner.quickMatchBook(libraryItem, options)
    res.json(matchResult)
  }

  // POST: api/items/batch/delete
  async batchDelete(req, res) {
    if (!req.user.canDelete) {
      Logger.warn(`[LibraryItemController] User attempted to delete without permission`, req.user)
      return res.sendStatus(403)
    }

    var { libraryItemIds } = req.body
    if (!libraryItemIds || !libraryItemIds.length) {
      return res.sendStatus(500)
    }

    var itemsToDelete = this.db.libraryItems.filter(li => libraryItemIds.includes(li.id))
    if (!itemsToDelete.length) {
      return res.sendStatus(404)
    }
    for (let i = 0; i < itemsToDelete.length; i++) {
      Logger.info(`[LibraryItemController] Deleting Library Item "${itemsToDelete[i].media.metadata.title}"`)
      await this.handleDeleteLibraryItem(itemsToDelete[i])
    }
    res.sendStatus(200)
  }

  // POST: api/items/batch/update
  async batchUpdate(req, res) {
    var updatePayloads = req.body
    if (!updatePayloads || !updatePayloads.length) {
      return res.sendStatus(500)
    }

    var itemsUpdated = 0

    for (let i = 0; i < updatePayloads.length; i++) {
      var mediaPayload = updatePayloads[i].mediaPayload
      var libraryItem = this.db.libraryItems.find(_li => _li.id === updatePayloads[i].id)
      if (!libraryItem) return null

      await this.createAuthorsAndSeriesForItemUpdate(mediaPayload)

      var hasUpdates = libraryItem.media.update(mediaPayload)
      if (hasUpdates) {
        Logger.debug(`[LibraryItemController] Updated library item media ${libraryItem.media.metadata.title}`)
        await this.db.updateLibraryItem(libraryItem)
        this.emitter('item_updated', libraryItem.toJSONExpanded())
        itemsUpdated++
      }
    }

    res.json({
      success: true,
      updates: itemsUpdated
    })
  }

  // POST: api/items/batch/get
  async batchGet(req, res) {
    var libraryItemIds = req.body.libraryItemIds || []
    if (!libraryItemIds.length) {
      return res.status(403).send('Invalid payload')
    }
    var libraryItems = this.db.libraryItems.filter(li => libraryItemIds.includes(li.id)).map((li) => li.toJSONExpanded())
    res.json(libraryItems)
  }

  // DELETE: api/items/all
  async deleteAll(req, res) {
    if (!req.user.isRoot) {
      Logger.warn('User other than root attempted to delete all library items', req.user)
      return res.sendStatus(403)
    }
    Logger.info('Removing all Library Items')
    var success = await this.db.recreateLibraryItemsDb()
    if (success) res.sendStatus(200)
    else res.sendStatus(500)
  }

  // GET: api/items/:id/scan (Root)
  async scan(req, res) {
    if (!req.user.isRoot) {
      Logger.error(`[LibraryItemController] Non-root user attempted to scan library item`, req.user)
      return res.sendStatus(403)
    }
    var result = await this.scanner.scanLibraryItemById(req.libraryItem.id)
    res.json({
      result: Object.keys(ScanResult).find(key => ScanResult[key] == result)
    })
  }


  middleware(req, res, next) {
    var item = this.db.libraryItems.find(li => li.id === req.params.id)
    if (!item || !item.media) return res.sendStatus(404)

    // Check user can access this library
    if (!req.user.checkCanAccessLibrary(item.libraryId)) {
      return res.sendStatus(403)
    }

    if (req.method == 'DELETE' && !req.user.canDelete) {
      Logger.warn(`[LibraryItemController] User attempted to delete without permission`, req.user)
      return res.sendStatus(403)
    } else if ((req.method == 'PATCH' || req.method == 'POST') && !req.user.canUpdate) {
      Logger.warn('[LibraryItemController] User attempted to update without permission', req.user)
      return res.sendStatus(403)
    }

    req.libraryItem = item
    next()
  }
}
module.exports = new LibraryItemController()