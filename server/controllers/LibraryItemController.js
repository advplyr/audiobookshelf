const { Request, Response, NextFunction } = require('express')
const Path = require('path')
const fs = require('../libs/fsExtra')
const uaParserJs = require('../libs/uaParser')
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')

const zipHelpers = require('../utils/zipHelpers')
const { reqSupportsWebp } = require('../utils/index')
const { ScanResult, AudioMimeType } = require('../utils/constants')
const { getAudioMimeTypeFromExtname, encodeUriPath } = require('../utils/fileUtils')
const LibraryItemScanner = require('../scanner/LibraryItemScanner')
const AudioFileScanner = require('../scanner/AudioFileScanner')
const Scanner = require('../scanner/Scanner')

const RssFeedManager = require('../managers/RssFeedManager')
const CacheManager = require('../managers/CacheManager')
const CoverManager = require('../managers/CoverManager')
const ShareManager = require('../managers/ShareManager')

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 */

class LibraryItemController {
  constructor() {}

  /**
   * GET: /api/items/:id
   * Optional query params:
   * ?include=progress,rssfeed,downloads,share
   * ?expanded=1
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async findOne(req, res) {
    const includeEntities = (req.query.include || '').split(',')
    if (req.query.expanded == 1) {
      var item = req.libraryItem.toJSONExpanded()

      // Include users media progress
      if (includeEntities.includes('progress')) {
        var episodeId = req.query.episode || null
        item.userMediaProgress = req.user.getOldMediaProgress(item.id, episodeId)
      }

      if (includeEntities.includes('rssfeed')) {
        const feedData = await RssFeedManager.findFeedForEntityId(item.id)
        item.rssFeed = feedData?.toOldJSONMinified() || null
      }

      if (item.mediaType === 'book' && req.user.isAdminOrUp && includeEntities.includes('share')) {
        item.mediaItemShare = ShareManager.findByMediaItemId(item.media.id)
      }

      if (item.mediaType === 'podcast' && includeEntities.includes('downloads')) {
        const downloadsInQueue = this.podcastManager.getEpisodeDownloadsInQueue(req.libraryItem.id)
        item.episodeDownloadsQueued = downloadsInQueue.map((d) => d.toJSONForClient())
        if (this.podcastManager.currentDownload?.libraryItemId === req.libraryItem.id) {
          item.episodesDownloading = [this.podcastManager.currentDownload.toJSONForClient()]
        }
      }

      return res.json(item)
    }
    res.json(req.libraryItem)
  }

  /**
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
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

  /**
   * DELETE: /api/items/:id
   * Delete library item. Will delete from database and file system if hard delete is requested.
   * Optional query params:
   * ?hard=1
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async delete(req, res) {
    const hardDelete = req.query.hard == 1 // Delete from file system
    const libraryItemPath = req.libraryItem.path

    const mediaItemIds = []
    const authorIds = []
    const seriesIds = []
    if (req.libraryItem.isPodcast) {
      mediaItemIds.push(...req.libraryItem.media.episodes.map((ep) => ep.id))
    } else {
      mediaItemIds.push(req.libraryItem.media.id)
      if (req.libraryItem.media.metadata.authors?.length) {
        authorIds.push(...req.libraryItem.media.metadata.authors.map((au) => au.id))
      }
      if (req.libraryItem.media.metadata.series?.length) {
        seriesIds.push(...req.libraryItem.media.metadata.series.map((se) => se.id))
      }
    }

    await this.handleDeleteLibraryItem(req.libraryItem.id, mediaItemIds)
    if (hardDelete) {
      Logger.info(`[LibraryItemController] Deleting library item from file system at "${libraryItemPath}"`)
      await fs.remove(libraryItemPath).catch((error) => {
        Logger.error(`[LibraryItemController] Failed to delete library item from file system at "${libraryItemPath}"`, error)
      })
    }

    if (authorIds.length) {
      await this.checkRemoveAuthorsWithNoBooks(authorIds)
    }
    if (seriesIds.length) {
      await this.checkRemoveEmptySeries(seriesIds)
    }

    await Database.resetLibraryIssuesFilterData(req.libraryItem.libraryId)
    res.sendStatus(200)
  }

  static handleDownloadError(error, res) {
    if (!res.headersSent) {
      if (error.code === 'ENOENT') {
        return res.status(404).send('File not found')
      } else {
        return res.status(500).send('Download failed')
      }
    }
  }

  /**
   * GET: /api/items/:id/download
   * Download library item. Zip file if multiple files.
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async download(req, res) {
    if (!req.user.canDownload) {
      Logger.warn(`User "${req.user.username}" attempted to download without permission`)
      return res.sendStatus(403)
    }
    const libraryItemPath = req.libraryItem.path
    const itemTitle = req.libraryItem.media.metadata.title

    Logger.info(`[LibraryItemController] User "${req.user.username}" requested download for item "${itemTitle}" at "${libraryItemPath}"`)

    try {
      // If library item is a single file in root dir then no need to zip
      if (req.libraryItem.isFile) {
        // Express does not set the correct mimetype for m4b files so use our defined mimetypes if available
        const audioMimeType = getAudioMimeTypeFromExtname(Path.extname(libraryItemPath))
        if (audioMimeType) {
          res.setHeader('Content-Type', audioMimeType)
        }
        await new Promise((resolve, reject) => res.download(libraryItemPath, req.libraryItem.relPath, (error) => (error ? reject(error) : resolve())))
      } else {
        const filename = `${itemTitle}.zip`
        await zipHelpers.zipDirectoryPipe(libraryItemPath, filename, res)
      }
      Logger.info(`[LibraryItemController] Downloaded item "${itemTitle}" at "${libraryItemPath}"`)
    } catch (error) {
      Logger.error(`[LibraryItemController] Download failed for item "${itemTitle}" at "${libraryItemPath}"`, error)
      LibraryItemController.handleDownloadError(error, res)
    }
  }

  /**
   * PATCH: /items/:id/media
   * Update media for a library item. Will create new authors & series when necessary
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async updateMedia(req, res) {
    const libraryItem = req.libraryItem
    const mediaPayload = req.body

    if (mediaPayload.url) {
      await LibraryItemController.prototype.uploadCover.bind(this)(req, res, false)
      if (res.writableEnded || res.headersSent) return
    }

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
      const seriesIdsInUpdate = mediaPayload.metadata.series?.map((se) => se.id) || []
      seriesRemoved = libraryItem.media.metadata.series.filter((se) => !seriesIdsInUpdate.includes(se.id))
    }

    let authorsRemoved = []
    if (libraryItem.isBook && mediaPayload.metadata?.authors) {
      const authorIdsInUpdate = mediaPayload.metadata.authors.map((au) => au.id)
      authorsRemoved = libraryItem.media.metadata.authors.filter((au) => !authorIdsInUpdate.includes(au.id))
    }

    const hasUpdates = libraryItem.media.update(mediaPayload) || mediaPayload.url
    if (hasUpdates) {
      libraryItem.updatedAt = Date.now()

      if (isPodcastAutoDownloadUpdated) {
        this.cronManager.checkUpdatePodcastCron(libraryItem)
      }

      Logger.debug(`[LibraryItemController] Updated library item media ${libraryItem.media.metadata.title}`)
      await Database.updateLibraryItem(libraryItem)
      SocketAuthority.emitter('item_updated', libraryItem.toJSONExpanded())

      if (authorsRemoved.length) {
        // Check remove empty authors
        Logger.debug(`[LibraryItemController] Authors were removed from book. Check if authors are now empty.`)
        await this.checkRemoveAuthorsWithNoBooks(authorsRemoved.map((au) => au.id))
      }
      if (seriesRemoved.length) {
        // Check remove empty series
        Logger.debug(`[LibraryItemController] Series were removed from book. Check if series are now empty.`)
        await this.checkRemoveEmptySeries(seriesRemoved.map((se) => se.id))
      }
    }
    res.json({
      updated: hasUpdates,
      libraryItem
    })
  }

  /**
   * POST: /api/items/:id/cover
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   * @param {boolean} [updateAndReturnJson=true]
   */
  async uploadCover(req, res, updateAndReturnJson = true) {
    if (!req.user.canUpload) {
      Logger.warn(`User "${req.user.username}" attempted to upload a cover without permission`)
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

    if (updateAndReturnJson) {
      await Database.updateLibraryItem(libraryItem)
      SocketAuthority.emitter('item_updated', libraryItem.toJSONExpanded())
      res.json({
        success: true,
        cover: result.cover
      })
    }
  }

  /**
   * PATCH: /api/items/:id/cover
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
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

  /**
   * DELETE: /api/items/:id/cover
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
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
   * GET: /api/items/:id/cover
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getCover(req, res) {
    const {
      query: { width, height, format, raw }
    } = req

    if (req.query.ts) res.set('Cache-Control', 'private, max-age=86400')

    const libraryItemId = req.params.id
    if (!libraryItemId) {
      return res.sendStatus(400)
    }

    if (raw) {
      const coverPath = await Database.libraryItemModel.getCoverPath(libraryItemId)
      if (!coverPath || !(await fs.pathExists(coverPath))) {
        return res.sendStatus(404)
      }
      // any value
      if (global.XAccel) {
        const encodedURI = encodeUriPath(global.XAccel + coverPath)
        Logger.debug(`Use X-Accel to serve static file ${encodedURI}`)
        return res.status(204).header({ 'X-Accel-Redirect': encodedURI }).send()
      }
      return res.sendFile(coverPath)
    }

    const options = {
      format: format || (reqSupportsWebp(req) ? 'webp' : 'jpeg'),
      height: height ? parseInt(height) : null,
      width: width ? parseInt(width) : null
    }
    return CacheManager.handleCoverCache(res, libraryItemId, options)
  }

  /**
   * POST: /api/items/:id/play
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  startPlaybackSession(req, res) {
    if (!req.libraryItem.media.numTracks) {
      Logger.error(`[LibraryItemController] startPlaybackSession cannot playback ${req.libraryItem.id}`)
      return res.sendStatus(404)
    }

    this.playbackSessionManager.startSessionRequest(req, res, null)
  }

  /**
   * POST: /api/items/:id/play/:episodeId
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  startEpisodePlaybackSession(req, res) {
    var libraryItem = req.libraryItem
    if (!libraryItem.media.numTracks) {
      Logger.error(`[LibraryItemController] startPlaybackSession cannot playback ${libraryItem.id}`)
      return res.sendStatus(404)
    }
    var episodeId = req.params.episodeId
    if (!libraryItem.media.episodes.find((ep) => ep.id === episodeId)) {
      Logger.error(`[LibraryItemController] startPlaybackSession episode ${episodeId} not found for item ${libraryItem.id}`)
      return res.sendStatus(404)
    }

    this.playbackSessionManager.startSessionRequest(req, res, episodeId)
  }

  /**
   * PATCH: /api/items/:id/tracks
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
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

  /**
   * POST /api/items/:id/match
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async match(req, res) {
    const libraryItem = req.libraryItem
    const reqBody = req.body || {}

    const options = {}
    const matchOptions = ['provider', 'title', 'author', 'isbn', 'asin']
    for (const key of matchOptions) {
      if (reqBody[key] && typeof reqBody[key] === 'string') {
        options[key] = reqBody[key]
      }
    }
    if (reqBody.overrideCover !== undefined) {
      options.overrideCover = !!reqBody.overrideCover
    }
    if (reqBody.overrideDetails !== undefined) {
      options.overrideDetails = !!reqBody.overrideDetails
    }

    var matchResult = await Scanner.quickMatchLibraryItem(this, libraryItem, options)
    res.json(matchResult)
  }

  /**
   * POST: /api/items/batch/delete
   * Batch delete library items. Will delete from database and file system if hard delete is requested.
   * Optional query params:
   * ?hard=1
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async batchDelete(req, res) {
    if (!req.user.canDelete) {
      Logger.warn(`[LibraryItemController] User "${req.user.username}" attempted to delete without permission`)
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
      Logger.info(`[LibraryItemController] (${hardDelete ? 'Hard' : 'Soft'}) deleting Library Item "${libraryItem.media.metadata.title}" with id "${libraryItem.id}"`)
      const mediaItemIds = []
      const seriesIds = []
      const authorIds = []
      if (libraryItem.isPodcast) {
        mediaItemIds.push(...libraryItem.media.episodes.map((ep) => ep.id))
      } else {
        mediaItemIds.push(libraryItem.media.id)
        if (libraryItem.media.metadata.series?.length) {
          seriesIds.push(...libraryItem.media.metadata.series.map((se) => se.id))
        }
        if (libraryItem.media.metadata.authors?.length) {
          authorIds.push(...libraryItem.media.metadata.authors.map((au) => au.id))
        }
      }
      await this.handleDeleteLibraryItem(libraryItem.id, mediaItemIds)
      if (hardDelete) {
        Logger.info(`[LibraryItemController] Deleting library item from file system at "${libraryItemPath}"`)
        await fs.remove(libraryItemPath).catch((error) => {
          Logger.error(`[LibraryItemController] Failed to delete library item from file system at "${libraryItemPath}"`, error)
        })
      }
      if (seriesIds.length) {
        await this.checkRemoveEmptySeries(seriesIds)
      }
      if (authorIds.length) {
        await this.checkRemoveAuthorsWithNoBooks(authorIds)
      }
    }

    await Database.resetLibraryIssuesFilterData(libraryId)
    res.sendStatus(200)
  }

  /**
   * POST: /api/items/batch/update
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async batchUpdate(req, res) {
    const updatePayloads = req.body
    if (!Array.isArray(updatePayloads) || !updatePayloads.length) {
      Logger.error(`[LibraryItemController] Batch update failed. Invalid payload`)
      return res.sendStatus(400)
    }

    // Ensure that each update payload has a unique library item id
    const libraryItemIds = [...new Set(updatePayloads.map((up) => up?.id).filter((id) => id))]
    if (!libraryItemIds.length || libraryItemIds.length !== updatePayloads.length) {
      Logger.error(`[LibraryItemController] Batch update failed. Each update payload must have a unique library item id`)
      return res.sendStatus(400)
    }

    // Get all library items to update
    const libraryItems = await Database.libraryItemModel.getAllOldLibraryItems({
      id: libraryItemIds
    })
    if (updatePayloads.length !== libraryItems.length) {
      Logger.error(`[LibraryItemController] Batch update failed. Not all library items found`)
      return res.sendStatus(404)
    }

    let itemsUpdated = 0

    const seriesIdsRemoved = []
    const authorIdsRemoved = []

    for (const updatePayload of updatePayloads) {
      const mediaPayload = updatePayload.mediaPayload
      const libraryItem = libraryItems.find((li) => li.id === updatePayload.id)

      await this.createAuthorsAndSeriesForItemUpdate(mediaPayload, libraryItem.libraryId)

      if (libraryItem.isBook) {
        if (Array.isArray(mediaPayload.metadata?.series)) {
          const seriesIdsInUpdate = mediaPayload.metadata.series.map((se) => se.id)
          const seriesRemoved = libraryItem.media.metadata.series.filter((se) => !seriesIdsInUpdate.includes(se.id))
          seriesIdsRemoved.push(...seriesRemoved.map((se) => se.id))
        }
        if (Array.isArray(mediaPayload.metadata?.authors)) {
          const authorIdsInUpdate = mediaPayload.metadata.authors.map((au) => au.id)
          const authorsRemoved = libraryItem.media.metadata.authors.filter((au) => !authorIdsInUpdate.includes(au.id))
          authorIdsRemoved.push(...authorsRemoved.map((au) => au.id))
        }
      }

      if (libraryItem.media.update(mediaPayload)) {
        Logger.debug(`[LibraryItemController] Updated library item media ${libraryItem.media.metadata.title}`)

        await Database.updateLibraryItem(libraryItem)
        SocketAuthority.emitter('item_updated', libraryItem.toJSONExpanded())
        itemsUpdated++
      }
    }

    if (seriesIdsRemoved.length) {
      await this.checkRemoveEmptySeries(seriesIdsRemoved)
    }
    if (authorIdsRemoved.length) {
      await this.checkRemoveAuthorsWithNoBooks(authorIdsRemoved)
    }

    res.json({
      success: true,
      updates: itemsUpdated
    })
  }

  /**
   * POST: /api/items/batch/get
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async batchGet(req, res) {
    const libraryItemIds = req.body.libraryItemIds || []
    if (!libraryItemIds.length) {
      return res.status(403).send('Invalid payload')
    }
    const libraryItems = await Database.libraryItemModel.getAllOldLibraryItems({
      id: libraryItemIds
    })
    res.json({
      libraryItems: libraryItems.map((li) => li.toJSONExpanded())
    })
  }

  /**
   * POST: /api/items/batch/quickmatch
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async batchQuickMatch(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.warn(`Non-admin user "${req.user.username}" other than admin attempted to batch quick match library items`)
      return res.sendStatus(403)
    }

    let itemsUpdated = 0
    let itemsUnmatched = 0

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

    const reqBodyOptions = req.body.options || {}
    const options = {}
    if (reqBodyOptions.provider && typeof reqBodyOptions.provider === 'string') {
      options.provider = reqBodyOptions.provider
    }
    if (reqBodyOptions.overrideCover !== undefined) {
      options.overrideCover = !!reqBodyOptions.overrideCover
    }
    if (reqBodyOptions.overrideDetails !== undefined) {
      options.overrideDetails = !!reqBodyOptions.overrideDetails
    }

    for (const libraryItem of libraryItems) {
      const matchResult = await Scanner.quickMatchLibraryItem(this, libraryItem, options)
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

  /**
   * POST: /api/items/batch/scan
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async batchScan(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.warn(`Non-admin user "${req.user.username}" other than admin attempted to batch scan library items`)
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

  /**
   * POST: /api/items/:id/scan
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async scan(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[LibraryItemController] Non-admin user "${req.user.username}" attempted to scan library item`)
      return res.sendStatus(403)
    }

    if (req.libraryItem.isFile) {
      Logger.error(`[LibraryItemController] Re-scanning file library items not yet supported`)
      return res.sendStatus(500)
    }

    const result = await LibraryItemScanner.scanLibraryItem(req.libraryItem.id)
    await Database.resetLibraryIssuesFilterData(req.libraryItem.libraryId)
    res.json({
      result: Object.keys(ScanResult).find((key) => ScanResult[key] == result)
    })
  }

  /**
   * GET: /api/items/:id/metadata-object
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  getMetadataObject(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[LibraryItemController] Non-admin user "${req.user.username}" attempted to get metadata object`)
      return res.sendStatus(403)
    }

    if (req.libraryItem.isMissing || !req.libraryItem.hasAudioFiles || !req.libraryItem.isBook) {
      Logger.error(`[LibraryItemController] Invalid library item`)
      return res.sendStatus(500)
    }

    res.json(this.audioMetadataManager.getMetadataObjectForApi(req.libraryItem))
  }

  /**
   * POST: /api/items/:id/chapters
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async updateMediaChapters(req, res) {
    if (!req.user.canUpdate) {
      Logger.error(`[LibraryItemController] User "${req.user.username}" attempted to update chapters with invalid permissions`)
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
   * GET: /api/items/:id/ffprobe/:fileid
   * FFProbe JSON result from audio file
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getFFprobeData(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[LibraryItemController] Non-admin user "${req.user.username}" attempted to get ffprobe data`)
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
   * @param {RequestWithUser} req
   * @param {Response} res
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
   * @param {RequestWithUser} req
   * @param {Response} res
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
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async downloadLibraryFile(req, res) {
    const libraryFile = req.libraryFile
    const ua = uaParserJs(req.headers['user-agent'])

    if (!req.user.canDownload) {
      Logger.error(`[LibraryItemController] User "${req.user.username}" without download permission attempted to download file "${libraryFile.metadata.path}"`)
      return res.sendStatus(403)
    }

    Logger.info(`[LibraryItemController] User "${req.user.username}" requested download for item "${req.libraryItem.media.metadata.title}" file at "${libraryFile.metadata.path}"`)

    if (global.XAccel) {
      const encodedURI = encodeUriPath(global.XAccel + libraryFile.metadata.path)
      Logger.debug(`Use X-Accel to serve static file ${encodedURI}`)
      return res.status(204).header({ 'X-Accel-Redirect': encodedURI }).send()
    }

    // Express does not set the correct mimetype for m4b files so use our defined mimetypes if available
    let audioMimeType = getAudioMimeTypeFromExtname(Path.extname(libraryFile.metadata.path))
    if (audioMimeType) {
      // Work-around for Apple devices mishandling Content-Type on mobile browsers:
      // https://github.com/advplyr/audiobookshelf/issues/3310
      // We actually need to check for Webkit on Apple mobile devices because this issue impacts all browsers on iOS/iPadOS/etc, not just Safari.
      const isAppleMobileBrowser = ua.device.vendor === 'Apple' && ua.device.type === 'mobile' && ua.engine.name === 'WebKit'
      if (isAppleMobileBrowser && audioMimeType === AudioMimeType.M4B) {
        audioMimeType = 'audio/m4b'
      }
      res.setHeader('Content-Type', audioMimeType)
    }

    try {
      await new Promise((resolve, reject) => res.download(libraryFile.metadata.path, libraryFile.metadata.filename, (error) => (error ? reject(error) : resolve())))
      Logger.info(`[LibraryItemController] Downloaded file "${libraryFile.metadata.path}"`)
    } catch (error) {
      Logger.error(`[LibraryItemController] Failed to download file "${libraryFile.metadata.path}"`, error)
      LibraryItemController.handleDownloadError(error, res)
    }
  }

  /**
   * GET api/items/:id/ebook/:fileid?
   * fileid is the inode value stored in LibraryFile.ino or EBookFile.ino
   * fileid is only required when reading a supplementary ebook
   * when no fileid is passed in the primary ebook will be returned
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getEBookFile(req, res) {
    let ebookFile = null
    if (req.params.fileid) {
      ebookFile = req.libraryItem.libraryFiles.find((lf) => lf.ino === req.params.fileid)
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

    Logger.info(`[LibraryItemController] User "${req.user.username}" requested download for item "${req.libraryItem.media.metadata.title}" ebook at "${ebookFilePath}"`)

    if (global.XAccel) {
      const encodedURI = encodeUriPath(global.XAccel + ebookFilePath)
      Logger.debug(`Use X-Accel to serve static file ${encodedURI}`)
      return res.status(204).header({ 'X-Accel-Redirect': encodedURI }).send()
    }

    try {
      await new Promise((resolve, reject) => res.sendFile(ebookFilePath, (error) => (error ? reject(error) : resolve())))
      Logger.info(`[LibraryItemController] Downloaded ebook file "${ebookFilePath}"`)
    } catch (error) {
      Logger.error(`[LibraryItemController] Failed to download ebook file "${ebookFilePath}"`, error)
      LibraryItemController.handleDownloadError(error, res)
    }
  }

  /**
   * PATCH api/items/:id/ebook/:fileid/status
   * toggle the status of an ebook file.
   * if an ebook file is the primary ebook, then it will be changed to supplementary
   * if an ebook file is supplementary, then it will be changed to primary
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async updateEbookFileStatus(req, res) {
    const ebookLibraryFile = req.libraryItem.libraryFiles.find((lf) => lf.ino === req.params.fileid)
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

  /**
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   * @param {NextFunction} next
   */
  async middleware(req, res, next) {
    req.libraryItem = await Database.libraryItemModel.getOldById(req.params.id)
    if (!req.libraryItem?.media) return res.sendStatus(404)

    // Check user can access this library item
    if (!req.user.checkCanAccessLibraryItem(req.libraryItem)) {
      return res.sendStatus(403)
    }

    // For library file routes, get the library file
    if (req.params.fileid) {
      req.libraryFile = req.libraryItem.libraryFiles.find((lf) => lf.ino === req.params.fileid)
      if (!req.libraryFile) {
        Logger.error(`[LibraryItemController] Library file "${req.params.fileid}" does not exist for library item`)
        return res.sendStatus(404)
      }
    }

    if (req.path.includes('/play')) {
      // allow POST requests using /play and /play/:episodeId
    } else if (req.method == 'DELETE' && !req.user.canDelete) {
      Logger.warn(`[LibraryItemController] User "${req.user.username}" attempted to delete without permission`)
      return res.sendStatus(403)
    } else if ((req.method == 'PATCH' || req.method == 'POST') && !req.user.canUpdate) {
      Logger.warn(`[LibraryItemController] User "${req.user.username}" attempted to update without permission`)
      return res.sendStatus(403)
    }

    next()
  }
}
module.exports = new LibraryItemController()
