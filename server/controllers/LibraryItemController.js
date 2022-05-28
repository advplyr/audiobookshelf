const Logger = require('../Logger')
const { reqSupportsWebp } = require('../utils/index')
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
        var feedData = this.rssFeedManager.findFeedForItem(item.id)
        item.rssFeedUrl = feedData ? feedData.feedUrl : null
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
        var downloadsInQueue = this.podcastManager.getEpisodeDownloadsInQueue(req.libraryItem.id)
        item.episodesDownloading = downloadsInQueue.map(d => d.toJSONForClient())
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

    var hasUpdates = libraryItem.update(req.body)
    if (hasUpdates) {
      // Turn on podcast auto download cron if not already on
      if (libraryItem.mediaType == 'podcast' && req.body.media.autoDownloadEpisodes && !this.podcastManager.episodeScheduleTask) {
        this.podcastManager.schedulePodcastEpisodeCron()
      }

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

    if (libraryItem.isBook) {
      await this.createAuthorsAndSeriesForItemUpdate(mediaPayload)
    }

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

    var validationResult = await this.coverManager.validateCoverPath(req.body.cover, libraryItem)
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
    if (!req.libraryItem.media.numTracks) {
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
    this.emitter('item_updated', libraryItem.toJSONExpanded())
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
    if (!req.user.isAdminOrUp) {
      Logger.warn('User other than admin attempted to delete all library items', req.user)
      return res.sendStatus(403)
    }
    Logger.info('Removing all Library Items')
    var success = await this.db.recreateLibraryItemsDb()
    if (success) res.sendStatus(200)
    else res.sendStatus(500)
  }

  // GET: api/items/:id/scan (admin)
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

  // GET: api/items/:id/audio-metadata
  async updateAudioFileMetadata(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[LibraryItemController] Non-root user attempted to update audio metadata`, req.user)
      return res.sendStatus(403)
    }

    if (req.libraryItem.isMissing || !req.libraryItem.hasAudioFiles || !req.libraryItem.isBook) {
      Logger.error(`[LibraryItemController] Invalid library item`)
      return res.sendStatus(500)
    }

    this.audioMetadataManager.updateAudioFileMetadataForItem(req.user, req.libraryItem)
    res.sendStatus(200)
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

    const chapters = req.body.chapters || []
    if (!chapters.length) {
      Logger.error(`[LibraryItemController] Invalid payload`)
      return res.sendStatus(400)
    }

    const wasUpdated = req.libraryItem.media.updateChapters(chapters)
    if (wasUpdated) {
      await this.db.updateLibraryItem(req.libraryItem)
      this.emitter('item_updated', req.libraryItem.toJSONExpanded())
    }

    res.json({
      success: true,
      updated: wasUpdated
    })
  }

  // POST: api/items/:id/open-feed
  async openRSSFeed(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[LibraryItemController] Non-admin user attempted to open RSS feed`, req.user.username)
      return res.sendStatus(500)
    }

    const feedData = this.rssFeedManager.openFeedForItem(req.user, req.libraryItem, req.body)
    if (feedData.error) {
      return res.json({
        success: false,
        error: feedData.error
      })
    }

    res.json({
      success: true,
      feedUrl: feedData.feedUrl
    })
  }

  async closeRSSFeed(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[LibraryItemController] Non-admin user attempted to close RSS feed`, req.user.username)
      return res.sendStatus(500)
    }

    this.rssFeedManager.closeFeedForItem(req.params.id)

    res.sendStatus(200)
  }

  middleware(req, res, next) {
    var item = this.db.libraryItems.find(li => li.id === req.params.id)
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