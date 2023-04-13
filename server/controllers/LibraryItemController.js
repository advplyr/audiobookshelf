const fs = require('../libs/fsExtra')
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')

const zipHelpers = require('../utils/zipHelpers')
const { reqSupportsWebp, isNullOrNaN } = require('../utils/index')
const { ScanResult } = require('../utils/constants')

class LibraryItemController {
  constructor() { }

  // Example expand with authors: api/items/:id?expanded=1&include=authors
  findOne(req, res) {
    const includeEntities = (req.query.include || '').split(',')
    if (req.query.expanded == 1) {
      var item = req.libraryItem.toJSONExpanded()

      // Include users media progress
      if (includeEntities.includes('progress')) {
        var episodeId = req.query.episode || null
        item.userMediaProgress = req.user.getMediaProgress(item.id, episodeId)
      }

      if (includeEntities.includes('rssfeed')) {
        const feedData = this.rssFeedManager.findFeedForEntityId(item.id)
        item.rssFeed = feedData ? feedData.toJSONMinified() : null
      }

      if (item.mediaType == 'book') {
        if (includeEntities.includes('authors')) {
          item.media.metadata.authors = item.media.metadata.authors.map(au => {
            var author = this.db.authors.find(_au => _au.id === au.id)
            if (!author) return null
            return {
              ...author
            }
          }).filter(au => au)
        }
      } else if (includeEntities.includes('downloads')) {
        const downloadsInQueue = this.podcastManager.getEpisodeDownloadsInQueue(req.libraryItem.id)
        item.episodeDownloadsQueued = downloadsInQueue.map(d => d.toJSONForClient())
        if (this.podcastManager.currentDownload?.libraryItemId === req.libraryItem.id) {
          item.episodesDownloading = [this.podcastManager.currentDownload.toJSONForClient()]
        }
      }

      return res.json(item)
    }
    res.json(req.libraryItem)
  }

  async update(req, res) {
    var libraryItem = req.libraryItem
    // Item has cover and update is removing cover so purge it from cache
    if (libraryItem.media.coverPath && req.body.media && (req.body.media.coverPath === '' || req.body.media.coverPath === null)) {
      await this.cacheManager.purgeCoverCache(libraryItem.id)
    }

    const hasUpdates = libraryItem.update(req.body)
    if (hasUpdates) {
      Logger.debug(`[LibraryItemController] Updated now saving`)
      await this.db.updateLibraryItem(libraryItem)
      SocketAuthority.emitter('item_updated', libraryItem.toJSONExpanded())
    }
    res.json(libraryItem.toJSON())
  }

  async delete(req, res) {
    await this.handleDeleteLibraryItem(req.libraryItem)
    res.sendStatus(200)
  }

  download(req, res) {
    if (!req.user.canDownload) {
      Logger.warn('User attempted to download without permission', req.user)
      return res.sendStatus(403)
    }

    const libraryItemPath = req.libraryItem.path
    const filename = `${req.libraryItem.media.metadata.title}.zip`
    zipHelpers.zipDirectoryPipe(libraryItemPath, filename, res)
  }

  //
  // PATCH: will create new authors & series if in payload
  //
  async updateMedia(req, res) {
    const libraryItem = req.libraryItem
    const mediaPayload = req.body
    // Item has cover and update is removing cover so purge it from cache
    if (libraryItem.media.coverPath && (mediaPayload.coverPath === '' || mediaPayload.coverPath === null)) {
      await this.cacheManager.purgeCoverCache(libraryItem.id)
    }

    // Book specific
    if (libraryItem.isBook) {
      await this.createAuthorsAndSeriesForItemUpdate(mediaPayload)
    }

    // Podcast specific
    let isPodcastAutoDownloadUpdated = false
    if (libraryItem.isPodcast) {
      if (mediaPayload.autoDownloadEpisodes !== undefined && libraryItem.media.autoDownloadEpisodes !== mediaPayload.autoDownloadEpisodes) {
        isPodcastAutoDownloadUpdated = true
      } else if (mediaPayload.autoDownloadSchedule !== undefined && libraryItem.media.autoDownloadSchedule !== mediaPayload.autoDownloadSchedule) {
        isPodcastAutoDownloadUpdated = true
      }
    }

    // Book specific - Get all series being removed from this item
    let seriesRemoved = []
    if (libraryItem.isBook && mediaPayload.metadata?.series) {
      const seriesIdsInUpdate = (mediaPayload.metadata?.series || []).map(se => se.id)
      seriesRemoved = libraryItem.media.metadata.series.filter(se => !seriesIdsInUpdate.includes(se.id))
    }

    const hasUpdates = libraryItem.media.update(mediaPayload)
    if (hasUpdates) {
      libraryItem.updatedAt = Date.now()

      if (seriesRemoved.length) {
        // Check remove empty series
        Logger.debug(`[LibraryItemController] Series was removed from book. Check if series is now empty.`)
        await this.checkRemoveEmptySeries(seriesRemoved)
      }

      if (isPodcastAutoDownloadUpdated) {
        this.cronManager.checkUpdatePodcastCron(libraryItem)
      }

      Logger.debug(`[LibraryItemController] Updated library item media ${libraryItem.media.metadata.title}`)
      await this.db.updateLibraryItem(libraryItem)
      SocketAuthority.emitter('item_updated', libraryItem.toJSONExpanded())
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
      result = await this.coverManager.downloadCoverFromUrl(libraryItem, req.body.url)
    } else if (req.files && req.files.cover) {
      Logger.debug(`[LibraryItemController] Handling uploaded cover`)
      result = await this.coverManager.uploadCover(libraryItem, req.files.cover)
    } else {
      return res.status(400).send('Invalid request no file or url')
    }

    if (result && result.error) {
      return res.status(400).send(result.error)
    } else if (!result || !result.cover) {
      return res.status(500).send('Unknown error occurred')
    }

    await this.db.updateLibraryItem(libraryItem)
    SocketAuthority.emitter('item_updated', libraryItem.toJSONExpanded())
    res.json({
      success: true,
      cover: result.cover
    })
  }

  // PATCH: api/items/:id/cover
  async updateCover(req, res) {
    const libraryItem = req.libraryItem
    if (!req.body.cover) {
      return res.status(400).send('Invalid request no cover path')
    }

    const validationResult = await this.coverManager.validateCoverPath(req.body.cover, libraryItem)
    if (validationResult.error) {
      return res.status(500).send(validationResult.error)
    }
    if (validationResult.updated) {
      await this.db.updateLibraryItem(libraryItem)
      SocketAuthority.emitter('item_updated', libraryItem.toJSONExpanded())
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
      SocketAuthority.emitter('item_updated', libraryItem.toJSONExpanded())
    }

    res.sendStatus(200)
  }

  // GET api/items/:id/cover
  async getCover(req, res) {
    const { query: { width, height, format, raw }, libraryItem } = req

    if (raw) { // any value
      if (!libraryItem.media.coverPath || !await fs.pathExists(libraryItem.media.coverPath)) {
        return res.sendStatus(404)
      }

      if (global.XAccel) {
        Logger.debug(`Use X-Accel to serve static file ${libraryItem.media.coverPath}`)
        return res.status(204).header({ 'X-Accel-Redirect': global.XAccel + libraryItem.media.coverPath }).send()
      }
      return res.sendFile(libraryItem.media.coverPath)
    }

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
    if (!req.libraryItem.media.numTracks && req.libraryItem.mediaType !== 'video') {
      Logger.error(`[LibraryItemController] startPlaybackSession cannot playback ${req.libraryItem.id}`)
      return res.sendStatus(404)
    }

    this.playbackSessionManager.startSessionRequest(req, res, null)
  }

  // POST: api/items/:id/play/:episodeId
  startEpisodePlaybackSession(req, res) {
    var libraryItem = req.libraryItem
    if (!libraryItem.media.numTracks) {
      Logger.error(`[LibraryItemController] startPlaybackSession cannot playback ${libraryItem.id}`)
      return res.sendStatus(404)
    }
    var episodeId = req.params.episodeId
    if (!libraryItem.media.episodes.find(ep => ep.id === episodeId)) {
      Logger.error(`[LibraryItemController] startPlaybackSession episode ${episodeId} not found for item ${libraryItem.id}`)
      return res.sendStatus(404)
    }

    this.playbackSessionManager.startSessionRequest(req, res, episodeId)
  }

  // PATCH: api/items/:id/tracks
  async updateTracks(req, res) {
    var libraryItem = req.libraryItem
    var orderedFileData = req.body.orderedFileData
    if (!libraryItem.media.updateAudioTracks) {
      Logger.error(`[LibraryItemController] updateTracks invalid media type ${libraryItem.id}`)
      return res.sendStatus(500)
    }
    libraryItem.media.updateAudioTracks(orderedFileData)
    await this.db.updateLibraryItem(libraryItem)
    SocketAuthority.emitter('item_updated', libraryItem.toJSONExpanded())
    res.json(libraryItem.toJSON())
  }

  // POST api/items/:id/match
  async match(req, res) {
    var libraryItem = req.libraryItem

    var options = req.body || {}
    var matchResult = await this.scanner.quickMatchLibraryItem(libraryItem, options)
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
        SocketAuthority.emitter('item_updated', libraryItem.toJSONExpanded())
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
    const libraryItemIds = req.body.libraryItemIds || []
    if (!libraryItemIds.length) {
      return res.status(403).send('Invalid payload')
    }
    const libraryItems = []
    libraryItemIds.forEach((lid) => {
      const li = this.db.libraryItems.find(_li => _li.id === lid)
      if (li) libraryItems.push(li.toJSONExpanded())
    })
    res.json({
      libraryItems
    })
  }

  // POST: api/items/batch/quickmatch
  async batchQuickMatch(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.warn('User other than admin attempted to batch quick match library items', req.user)
      return res.sendStatus(403)
    }

    var itemsUpdated = 0
    var itemsUnmatched = 0

    var matchData = req.body
    var options = matchData.options || {}
    var items = matchData.libraryItemIds
    if (!items || !items.length) {
      return res.sendStatus(500)
    }
    res.sendStatus(200)

    for (let i = 0; i < items.length; i++) {
      var libraryItem = this.db.libraryItems.find(_li => _li.id === items[i])
      var matchResult = await this.scanner.quickMatchLibraryItem(libraryItem, options)
      if (matchResult.updated) {
        itemsUpdated++
      } else if (matchResult.warning) {
        itemsUnmatched++
      }
    }

    var result = {
      success: itemsUpdated > 0,
      updates: itemsUpdated,
      unmatched: itemsUnmatched
    }
    SocketAuthority.clientEmitter(req.user.id, 'batch_quickmatch_complete', result)
  }

  // DELETE: api/items/all
  async deleteAll(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.warn('User other than admin attempted to delete all library items', req.user)
      return res.sendStatus(403)
    }
    Logger.info('Removing all Library Items')
    var success = await this.db.recreateLibraryItemsDb()
    if (success) res.sendStatus(200)
    else res.sendStatus(500)
  }

  // POST: api/items/:id/scan (admin)
  async scan(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[LibraryItemController] Non-admin user attempted to scan library item`, req.user)
      return res.sendStatus(403)
    }

    if (req.libraryItem.isFile) {
      Logger.error(`[LibraryItemController] Re-scanning file library items not yet supported`)
      return res.sendStatus(500)
    }

    var result = await this.scanner.scanLibraryItemById(req.libraryItem.id)
    res.json({
      result: Object.keys(ScanResult).find(key => ScanResult[key] == result)
    })
  }

  getToneMetadataObject(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[LibraryItemController] Non-root user attempted to get tone metadata object`, req.user)
      return res.sendStatus(403)
    }

    if (req.libraryItem.isMissing || !req.libraryItem.hasAudioFiles || !req.libraryItem.isBook) {
      Logger.error(`[LibraryItemController] Invalid library item`)
      return res.sendStatus(500)
    }

    res.json(this.audioMetadataManager.getToneMetadataObjectForApi(req.libraryItem))
  }

  // POST: api/items/:id/chapters
  async updateMediaChapters(req, res) {
    if (!req.user.canUpdate) {
      Logger.error(`[LibraryItemController] User attempted to update chapters with invalid permissions`, req.user.username)
      return res.sendStatus(403)
    }

    if (req.libraryItem.isMissing || !req.libraryItem.hasAudioFiles || !req.libraryItem.isBook) {
      Logger.error(`[LibraryItemController] Invalid library item`)
      return res.sendStatus(500)
    }

    if (!req.body.chapters) {
      Logger.error(`[LibraryItemController] Invalid payload`)
      return res.sendStatus(400)
    }

    const chapters = req.body.chapters || []
    const wasUpdated = req.libraryItem.media.updateChapters(chapters)
    if (wasUpdated) {
      await this.db.updateLibraryItem(req.libraryItem)
      SocketAuthority.emitter('item_updated', req.libraryItem.toJSONExpanded())
    }

    res.json({
      success: true,
      updated: wasUpdated
    })
  }

  async toneScan(req, res) {
    if (!req.libraryItem.media.audioFiles.length) {
      return res.sendStatus(404)
    }

    const audioFileIndex = isNullOrNaN(req.params.index) ? 1 : Number(req.params.index)
    const audioFile = req.libraryItem.media.audioFiles.find(af => af.index === audioFileIndex)
    if (!audioFile) {
      Logger.error(`[LibraryItemController] toneScan: Audio file not found with index ${audioFileIndex}`)
      return res.sendStatus(404)
    }

    const toneData = await this.scanner.probeAudioFileWithTone(audioFile)
    res.json(toneData)
  }

  async deleteLibraryFile(req, res) {
    const libraryFile = req.libraryItem.libraryFiles.find(lf => lf.ino === req.params.ino)
    if (!libraryFile) {
      Logger.error(`[LibraryItemController] Unable to delete library file. Not found. "${req.params.ino}"`)
      return res.sendStatus(404)
    }

    await fs.remove(libraryFile.metadata.path)
    req.libraryItem.removeLibraryFile(req.params.ino)

    if (req.libraryItem.media.removeFileWithInode(req.params.ino)) {
      // If book has no more media files then mark it as missing
      if (req.libraryItem.mediaType === 'book' && !req.libraryItem.media.hasMediaEntities) {
        req.libraryItem.setMissing()
      }
    }
    req.libraryItem.updatedAt = Date.now()
    await this.db.updateLibraryItem(req.libraryItem)
    SocketAuthority.emitter('item_updated', req.libraryItem.toJSONExpanded())
    res.sendStatus(200)
  }

  middleware(req, res, next) {
    const item = this.db.libraryItems.find(li => li.id === req.params.id)
    if (!item || !item.media) return res.sendStatus(404)

    // Check user can access this library item
    if (!req.user.checkCanAccessLibraryItem(item)) {
      return res.sendStatus(403)
    }

    if (req.path.includes('/play')) {
      // allow POST requests using /play and /play/:episodeId
    } else if (req.method == 'DELETE' && !req.user.canDelete) {
      Logger.warn(`[LibraryItemController] User attempted to delete without permission`, req.user)
      return res.sendStatus(403)
    } else if ((req.method == 'PATCH' || req.method == 'POST') && !req.user.canUpdate) {
      Logger.warn('[LibraryItemController] User attempted to update without permission', req.user.username)
      return res.sendStatus(403)
    }

    req.libraryItem = item
    next()
  }
}
module.exports = new LibraryItemController()