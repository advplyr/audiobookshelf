const Path = require('path')
const fs = require('../libs/fsExtra')
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')

const zipHelpers = require('../utils/zipHelpers')
const { reqSupportsWebp } = require('../utils/index')
const { ScanResult } = require('../utils/constants')
const { getAudioMimeTypeFromExtname, encodeUriPath } = require('../utils/fileUtils')
const LibraryItemScanner = require('../scanner/LibraryItemScanner')
const AudioFileScanner = require('../scanner/AudioFileScanner')
const Scanner = require('../scanner/Scanner')
const CacheManager = require('../managers/CacheManager')
const CoverManager = require('../managers/CoverManager')

class LibraryItemController {
  constructor() { }

  /**
   * GET: /api/items/:id
   * Optional query params:
   * ?include=progress,rssfeed,downloads
   * ?expanded=1
   * 
   * @param {import('express').Request} req 
   * @param {import('express').Response} res 
   */
  async findOne(req, res) {
    const includeEntities = (req.query.include || '').split(',')
    if (req.query.expanded == 1) {
      var item = req.libraryItem.toJSONExpanded()

      // Include users media progress
      if (includeEntities.includes('progress')) {
        var episodeId = req.query.episode || null
        item.userMediaProgress = req.user.getMediaProgress(item.id, episodeId)
      }

      if (includeEntities.includes('rssfeed')) {
        const feedData = await this.rssFeedManager.findFeedForEntityId(item.id)
        item.rssFeed = feedData?.toJSONMinified() || null
      }

      if (item.mediaType === 'podcast' && includeEntities.includes('downloads')) {
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
      await CacheManager.purgeCoverCache(libraryItem.id)
    }

    const hasUpdates = libraryItem.update(req.body)
    if (hasUpdates) {
      Logger.debug(`[LibraryItemController] Updated now saving`)
      await Database.updateLibraryItem(libraryItem)
      SocketAuthority.emitter('item_updated', libraryItem.toJSONExpanded())
    }
    res.json(libraryItem.toJSON())
  }

  async delete(req, res) {
    const hardDelete = req.query.hard == 1 // Delete from file system
    const libraryItemPath = req.libraryItem.path
    await this.handleDeleteLibraryItem(req.libraryItem.mediaType, req.libraryItem.id, [req.libraryItem.media.id])
    if (hardDelete) {
      Logger.info(`[LibraryItemController] Deleting library item from file system at "${libraryItemPath}"`)
      await fs.remove(libraryItemPath).catch((error) => {
        Logger.error(`[LibraryItemController] Failed to delete library item from file system at "${libraryItemPath}"`, error)
      })
    }
    await Database.resetLibraryIssuesFilterData(req.libraryItem.libraryId)
    res.sendStatus(200)
  }

  /**
   * GET: /api/items/:id/download
   * Download library item. Zip file if multiple files.
   * 
   * @param {import('express').Request} req 
   * @param {import('express').Response} res 
   */
  download(req, res) {
    if (!req.user.canDownload) {
      Logger.warn('User attempted to download without permission', req.user)
      return res.sendStatus(403)
    }

    // If library item is a single file in root dir then no need to zip
    if (req.libraryItem.isFile) {
      // Express does not set the correct mimetype for m4b files so use our defined mimetypes if available
      const audioMimeType = getAudioMimeTypeFromExtname(Path.extname(req.libraryItem.path))
      if (audioMimeType) {
        res.setHeader('Content-Type', audioMimeType)
      }

      res.download(req.libraryItem.path, req.libraryItem.relPath)
      return
    }

    const libraryItemPath = req.libraryItem.path
    const itemTitle = req.libraryItem.media.metadata.title
    Logger.info(`[LibraryItemController] User "${req.user.username}" requested download for item "${itemTitle}" at "${libraryItemPath}"`)
    const filename = `${itemTitle}.zip`
    zipHelpers.zipDirectoryPipe(libraryItemPath, filename, res)
  }

  //
  // PATCH: will create new authors & series if in payload
  //
  async updateMedia(req, res) {
    const libraryItem = req.libraryItem
    const mediaPayload = req.body

    // Book specific
    if (libraryItem.isBook) {
      await this.createAuthorsAndSeriesForItemUpdate(mediaPayload, libraryItem.libraryId)
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
      const seriesIdsInUpdate = mediaPayload.metadata.series?.map(se => se.id) || []
      seriesRemoved = libraryItem.media.metadata.series.filter(se => !seriesIdsInUpdate.includes(se.id))
    }

    const hasUpdates = libraryItem.media.update(mediaPayload)
    if (hasUpdates) {
      libraryItem.updatedAt = Date.now()

      if (seriesRemoved.length) {
        // Check remove empty series
        Logger.debug(`[LibraryItemController] Series was removed from book. Check if series is now empty.`)
        await this.checkRemoveEmptySeries(libraryItem.media.id, seriesRemoved.map(se => se.id))
      }

      if (isPodcastAutoDownloadUpdated) {
        this.cronManager.checkUpdatePodcastCron(libraryItem)
      }

      Logger.debug(`[LibraryItemController] Updated library item media ${libraryItem.media.metadata.title}`)
      await Database.updateLibraryItem(libraryItem)
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

    let libraryItem = req.libraryItem

    let result = null
    if (req.body?.url) {
      Logger.debug(`[LibraryItemController] Requesting download cover from url "${req.body.url}"`)
      result = await CoverManager.downloadCoverFromUrl(libraryItem, req.body.url)
    } else if (req.files?.cover) {
      Logger.debug(`[LibraryItemController] Handling uploaded cover`)
      result = await CoverManager.uploadCover(libraryItem, req.files.cover)
    } else {
      return res.status(400).send('Invalid request no file or url')
    }

    if (result?.error) {
      return res.status(400).send(result.error)
    } else if (!result?.cover) {
      return res.status(500).send('Unknown error occurred')
    }

    await Database.updateLibraryItem(libraryItem)
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

    const validationResult = await CoverManager.validateCoverPath(req.body.cover, libraryItem)
    if (validationResult.error) {
      return res.status(500).send(validationResult.error)
    }
    if (validationResult.updated) {
      await Database.updateLibraryItem(libraryItem)
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
      await CacheManager.purgeCoverCache(libraryItem.id)
      await Database.updateLibraryItem(libraryItem)
      SocketAuthority.emitter('item_updated', libraryItem.toJSONExpanded())
    }

    res.sendStatus(200)
  }

  /**
   * GET: api/items/:id/cover
   * 
   * @param {import('express').Request} req 
   * @param {import('express').Response} res 
   */
  async getCover(req, res) {
    const { query: { width, height, format, raw } } = req

    const libraryItem = await Database.libraryItemModel.findByPk(req.params.id, {
      attributes: ['id', 'mediaType', 'mediaId', 'libraryId'],
      include: [
        {
          model: Database.bookModel,
          attributes: ['id', 'coverPath', 'tags', 'explicit']
        },
        {
          model: Database.podcastModel,
          attributes: ['id', 'coverPath', 'tags', 'explicit']
        }
      ]
    })
    if (!libraryItem) {
      Logger.warn(`[LibraryItemController] getCover: Library item "${req.params.id}" does not exist`)
      return res.sendStatus(404)
    }

    // Check if user can access this library item
    if (!req.user.checkCanAccessLibraryItemWithData(libraryItem.libraryId, libraryItem.media.explicit, libraryItem.media.tags)) {
      return res.sendStatus(403)
    }

    // Check if library item media has a cover path
    if (!libraryItem.media.coverPath || !await fs.pathExists(libraryItem.media.coverPath)) {
      return res.sendStatus(404)
    }

    if (raw) { // any value
      if (global.XAccel) {
        const encodedURI = encodeUriPath(global.XAccel + libraryItem.media.coverPath)
        Logger.debug(`Use X-Accel to serve static file ${encodedURI}`)
        return res.status(204).header({ 'X-Accel-Redirect': encodedURI }).send()
      }
      return res.sendFile(libraryItem.media.coverPath)
    }

    const options = {
      format: format || (reqSupportsWebp(req) ? 'webp' : 'jpeg'),
      height: height ? parseInt(height) : null,
      width: width ? parseInt(width) : null
    }
    return CacheManager.handleCoverCache(res, libraryItem.id, libraryItem.media.coverPath, options)
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
    await Database.updateLibraryItem(libraryItem)
    SocketAuthority.emitter('item_updated', libraryItem.toJSONExpanded())
    res.json(libraryItem.toJSON())
  }

  // POST api/items/:id/match
  async match(req, res) {
    var libraryItem = req.libraryItem

    var options = req.body || {}
    var matchResult = await Scanner.quickMatchLibraryItem(libraryItem, options)
    res.json(matchResult)
  }

  // POST: api/items/batch/delete
  async batchDelete(req, res) {
    if (!req.user.canDelete) {
      Logger.warn(`[LibraryItemController] User attempted to delete without permission`, req.user)
      return res.sendStatus(403)
    }
    const hardDelete = req.query.hard == 1 // Delete files from filesystem

    const { libraryItemIds } = req.body
    if (!libraryItemIds?.length) {
      return res.status(400).send('Invalid request body')
    }

    const itemsToDelete = await Database.libraryItemModel.getAllOldLibraryItems({
      id: libraryItemIds
    })

    if (!itemsToDelete.length) {
      return res.sendStatus(404)
    }

    const libraryId = itemsToDelete[0].libraryId
    for (const libraryItem of itemsToDelete) {
      const libraryItemPath = libraryItem.path
      Logger.info(`[LibraryItemController] Deleting Library Item "${libraryItem.media.metadata.title}"`)
      await this.handleDeleteLibraryItem(libraryItem.mediaType, libraryItem.id, [libraryItem.media.id])
      if (hardDelete) {
        Logger.info(`[LibraryItemController] Deleting library item from file system at "${libraryItemPath}"`)
        await fs.remove(libraryItemPath).catch((error) => {
          Logger.error(`[LibraryItemController] Failed to delete library item from file system at "${libraryItemPath}"`, error)
        })
      }
    }

    await Database.resetLibraryIssuesFilterData(libraryId)
    res.sendStatus(200)
  }

  // POST: api/items/batch/update
  async batchUpdate(req, res) {
    const updatePayloads = req.body
    if (!updatePayloads?.length) {
      return res.sendStatus(500)
    }

    let itemsUpdated = 0

    for (const updatePayload of updatePayloads) {
      const mediaPayload = updatePayload.mediaPayload
      const libraryItem = await Database.libraryItemModel.getOldById(updatePayload.id)
      if (!libraryItem) return null

      await this.createAuthorsAndSeriesForItemUpdate(mediaPayload, libraryItem.libraryId)

      let seriesRemoved = []
      if (libraryItem.isBook && mediaPayload.metadata?.series) {
        const seriesIdsInUpdate = (mediaPayload.metadata?.series || []).map(se => se.id)
        seriesRemoved = libraryItem.media.metadata.series.filter(se => !seriesIdsInUpdate.includes(se.id))
      }

      if (libraryItem.media.update(mediaPayload)) {
        Logger.debug(`[LibraryItemController] Updated library item media ${libraryItem.media.metadata.title}`)

        if (seriesRemoved.length) {
          // Check remove empty series
          Logger.debug(`[LibraryItemController] Series was removed from book. Check if series is now empty.`)
          await this.checkRemoveEmptySeries(libraryItem.media.id, seriesRemoved.map(se => se.id))
        }

        await Database.updateLibraryItem(libraryItem)
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
    const libraryItems = await Database.libraryItemModel.getAllOldLibraryItems({
      id: libraryItemIds
    })
    res.json({
      libraryItems: libraryItems.map(li => li.toJSONExpanded())
    })
  }

  // POST: api/items/batch/quickmatch
  async batchQuickMatch(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.warn('User other than admin attempted to batch quick match library items', req.user)
      return res.sendStatus(403)
    }

    let itemsUpdated = 0
    let itemsUnmatched = 0

    const options = req.body.options || {}
    if (!req.body.libraryItemIds?.length) {
      return res.sendStatus(400)
    }

    const libraryItems = await Database.libraryItemModel.getAllOldLibraryItems({
      id: req.body.libraryItemIds
    })
    if (!libraryItems?.length) {
      return res.sendStatus(400)
    }

    res.sendStatus(200)

    for (const libraryItem of libraryItems) {
      const matchResult = await Scanner.quickMatchLibraryItem(libraryItem, options)
      if (matchResult.updated) {
        itemsUpdated++
      } else if (matchResult.warning) {
        itemsUnmatched++
      }
    }

    const result = {
      success: itemsUpdated > 0,
      updates: itemsUpdated,
      unmatched: itemsUnmatched
    }
    SocketAuthority.clientEmitter(req.user.id, 'batch_quickmatch_complete', result)
  }

  // POST: api/items/batch/scan
  async batchScan(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.warn('User other than admin attempted to batch scan library items', req.user)
      return res.sendStatus(403)
    }

    if (!req.body.libraryItemIds?.length) {
      return res.sendStatus(400)
    }

    const libraryItems = await Database.libraryItemModel.findAll({
      where: {
        id: req.body.libraryItemIds
      },
      attributes: ['id', 'libraryId', 'isFile']
    })
    if (!libraryItems?.length) {
      return res.sendStatus(400)
    }

    res.sendStatus(200)

    const libraryId = libraryItems[0].libraryId
    for (const libraryItem of libraryItems) {
      if (libraryItem.isFile) {
        Logger.warn(`[LibraryItemController] Re-scanning file library items not yet supported`)
      } else {
        await LibraryItemScanner.scanLibraryItem(libraryItem.id)
      }
    }

    await Database.resetLibraryIssuesFilterData(libraryId)
  }

  // POST: api/items/:id/scan
  async scan(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[LibraryItemController] Non-admin user attempted to scan library item`, req.user)
      return res.sendStatus(403)
    }

    if (req.libraryItem.isFile) {
      Logger.error(`[LibraryItemController] Re-scanning file library items not yet supported`)
      return res.sendStatus(500)
    }

    const result = await LibraryItemScanner.scanLibraryItem(req.libraryItem.id)
    await Database.resetLibraryIssuesFilterData(req.libraryItem.libraryId)
    res.json({
      result: Object.keys(ScanResult).find(key => ScanResult[key] == result)
    })
  }

  getToneMetadataObject(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[LibraryItemController] Non-admin user attempted to get tone metadata object`, req.user)
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
      await Database.updateLibraryItem(req.libraryItem)
      SocketAuthority.emitter('item_updated', req.libraryItem.toJSONExpanded())
    }

    res.json({
      success: true,
      updated: wasUpdated
    })
  }

  /**
   * GET api/items/:id/ffprobe/:fileid
   * FFProbe JSON result from audio file
   * 
   * @param {express.Request} req
   * @param {express.Response} res 
   */
  async getFFprobeData(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[LibraryItemController] Non-admin user attempted to get ffprobe data`, req.user)
      return res.sendStatus(403)
    }
    if (req.libraryFile.fileType !== 'audio') {
      Logger.error(`[LibraryItemController] Invalid filetype "${req.libraryFile.fileType}" for fileid "${req.params.fileid}". Expected audio file`)
      return res.sendStatus(400)
    }

    const audioFile = req.libraryItem.media.findFileWithInode(req.params.fileid)
    if (!audioFile) {
      Logger.error(`[LibraryItemController] Audio file not found with inode value ${req.params.fileid}`)
      return res.sendStatus(404)
    }

    const ffprobeData = await AudioFileScanner.probeAudioFile(audioFile)
    res.json(ffprobeData)
  }

  /**
   * GET api/items/:id/file/:fileid
   * 
   * @param {express.Request} req
   * @param {express.Response} res 
   */
  async getLibraryFile(req, res) {
    const libraryFile = req.libraryFile

    if (global.XAccel) {
      const encodedURI = encodeUriPath(global.XAccel + libraryFile.metadata.path)
      Logger.debug(`Use X-Accel to serve static file ${encodedURI}`)
      return res.status(204).header({ 'X-Accel-Redirect': encodedURI }).send()
    }

    // Express does not set the correct mimetype for m4b files so use our defined mimetypes if available
    const audioMimeType = getAudioMimeTypeFromExtname(Path.extname(libraryFile.metadata.path))
    if (audioMimeType) {
      res.setHeader('Content-Type', audioMimeType)
    }
    res.sendFile(libraryFile.metadata.path)
  }

  /**
   * DELETE api/items/:id/file/:fileid
   * 
   * @param {express.Request} req
   * @param {express.Response} res 
   */
  async deleteLibraryFile(req, res) {
    const libraryFile = req.libraryFile

    Logger.info(`[LibraryItemController] User "${req.user.username}" requested file delete at "${libraryFile.metadata.path}"`)

    await fs.remove(libraryFile.metadata.path).catch((error) => {
      Logger.error(`[LibraryItemController] Failed to delete library file at "${libraryFile.metadata.path}"`, error)
    })
    req.libraryItem.removeLibraryFile(req.params.fileid)

    if (req.libraryItem.media.removeFileWithInode(req.params.fileid)) {
      // If book has no more media files then mark it as missing
      if (req.libraryItem.mediaType === 'book' && !req.libraryItem.media.hasMediaEntities) {
        req.libraryItem.setMissing()
      }
    }
    req.libraryItem.updatedAt = Date.now()
    await Database.updateLibraryItem(req.libraryItem)
    SocketAuthority.emitter('item_updated', req.libraryItem.toJSONExpanded())
    res.sendStatus(200)
  }

  /**
   * GET api/items/:id/file/:fileid/download
   * Same as GET api/items/:id/file/:fileid but allows logging and restricting downloads
   * @param {express.Request} req
   * @param {express.Response} res 
   */
  async downloadLibraryFile(req, res) {
    const libraryFile = req.libraryFile

    if (!req.user.canDownload) {
      Logger.error(`[LibraryItemController] User without download permission attempted to download file "${libraryFile.metadata.path}"`, req.user)
      return res.sendStatus(403)
    }

    Logger.info(`[LibraryItemController] User "${req.user.username}" requested file download at "${libraryFile.metadata.path}"`)

    if (global.XAccel) {
      const encodedURI = encodeUriPath(global.XAccel + libraryFile.metadata.path)
      Logger.debug(`Use X-Accel to serve static file ${encodedURI}`)
      return res.status(204).header({ 'X-Accel-Redirect': encodedURI }).send()
    }

    // Express does not set the correct mimetype for m4b files so use our defined mimetypes if available
    const audioMimeType = getAudioMimeTypeFromExtname(Path.extname(libraryFile.metadata.path))
    if (audioMimeType) {
      res.setHeader('Content-Type', audioMimeType)
    }

    res.download(libraryFile.metadata.path, libraryFile.metadata.filename)
  }

  /**
   * GET api/items/:id/ebook/:fileid?
   * fileid is the inode value stored in LibraryFile.ino or EBookFile.ino
   * fileid is only required when reading a supplementary ebook
   * when no fileid is passed in the primary ebook will be returned
   * 
   * @param {express.Request} req
   * @param {express.Response} res 
   */
  async getEBookFile(req, res) {
    let ebookFile = null
    if (req.params.fileid) {
      ebookFile = req.libraryItem.libraryFiles.find(lf => lf.ino === req.params.fileid)
      if (!ebookFile?.isEBookFile) {
        Logger.error(`[LibraryItemController] Invalid ebook file id "${req.params.fileid}"`)
        return res.status(400).send('Invalid ebook file id')
      }
    } else {
      ebookFile = req.libraryItem.media.ebookFile
    }

    if (!ebookFile) {
      Logger.error(`[LibraryItemController] No ebookFile for library item "${req.libraryItem.media.metadata.title}"`)
      return res.sendStatus(404)
    }
    const ebookFilePath = ebookFile.metadata.path

    if (global.XAccel) {
      const encodedURI = encodeUriPath(global.XAccel + ebookFilePath)
      Logger.debug(`Use X-Accel to serve static file ${encodedURI}`)
      return res.status(204).header({ 'X-Accel-Redirect': encodedURI }).send()
    }

    res.sendFile(ebookFilePath)
  }

  /**
   * PATCH api/items/:id/ebook/:fileid/status
   * toggle the status of an ebook file.
   * if an ebook file is the primary ebook, then it will be changed to supplementary
   * if an ebook file is supplementary, then it will be changed to primary
   * 
   * @param {express.Request} req
   * @param {express.Response} res 
   */
  async updateEbookFileStatus(req, res) {
    const ebookLibraryFile = req.libraryItem.libraryFiles.find(lf => lf.ino === req.params.fileid)
    if (!ebookLibraryFile?.isEBookFile) {
      Logger.error(`[LibraryItemController] Invalid ebook file id "${req.params.fileid}"`)
      return res.status(400).send('Invalid ebook file id')
    }

    if (ebookLibraryFile.isSupplementary) {
      Logger.info(`[LibraryItemController] Updating ebook file "${ebookLibraryFile.metadata.filename}" to primary`)
      req.libraryItem.setPrimaryEbook(ebookLibraryFile)
    } else {
      Logger.info(`[LibraryItemController] Updating ebook file "${ebookLibraryFile.metadata.filename}" to supplementary`)
      ebookLibraryFile.isSupplementary = true
      req.libraryItem.setPrimaryEbook(null)
    }

    req.libraryItem.updatedAt = Date.now()
    await Database.updateLibraryItem(req.libraryItem)
    SocketAuthority.emitter('item_updated', req.libraryItem.toJSONExpanded())
    res.sendStatus(200)
  }

  async middleware(req, res, next) {
    req.libraryItem = await Database.libraryItemModel.getOldById(req.params.id)
    if (!req.libraryItem?.media) return res.sendStatus(404)

    // Check user can access this library item
    if (!req.user.checkCanAccessLibraryItem(req.libraryItem)) {
      return res.sendStatus(403)
    }

    // For library file routes, get the library file
    if (req.params.fileid) {
      req.libraryFile = req.libraryItem.libraryFiles.find(lf => lf.ino === req.params.fileid)
      if (!req.libraryFile) {
        Logger.error(`[LibraryItemController] Library file "${req.params.fileid}" does not exist for library item`)
        return res.sendStatus(404)
      }
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

    next()
  }
}
module.exports = new LibraryItemController()