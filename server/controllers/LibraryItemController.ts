import type { Request, Response, NextFunction } from 'express'
import type User from '../models/User'
import type Book from '../models/Book'
import type Podcast from '../models/Podcast'
import type LibraryItem from '../models/LibraryItem'
import type LibraryFile from '../objects/files/LibraryFile'
import type AudioMetadataManager from '../managers/AudioMetadataManager'
import type CronManager from '../managers/CronManager'
import type PlaybackSessionManager from '../managers/PlaybackSessionManager'
import type PodcastManager from '../managers/PodcastManager'
import type PodcastEpisodeDownload from '../objects/PodcastEpisodeDownload'
import type Feed from '../models/Feed'
import Path from 'path'
import fs from '../libs/fsExtra'
import cron from '../libs/nodeCron'
import uaParserJs from '../libs/uaParser'
import Logger from '../Logger'
import SocketAuthority from '../SocketAuthority'
import Database from '../Database'

import * as zipHelpers from '../utils/zipHelpers'
import { reqSupportsWebp, clampPositiveInt } from '../utils/index'
import { ScanResult, AudioMimeType } from '../utils/constants'
import { getAudioMimeTypeFromExtname, encodeUriPath } from '../utils/fileUtils'
import LibraryItemScanner from '../scanner/LibraryItemScanner'
import AudioFileScanner from '../scanner/AudioFileScanner'
import Scanner from '../scanner/Scanner'

import RssFeedManager from '../managers/RssFeedManager'
import CacheManager from '../managers/CacheManager'
import CoverManager from '../managers/CoverManager'
import ShareManager from '../managers/ShareManager'

type ItemQuery = { include?: string; expanded?: string | number; episode?: string; hard?: string | number; width?: string; height?: string; format?: string; raw?: string; ts?: string }
type ItemRequest<Body = unknown> = Request<Record<string, string>, unknown, Body, ItemQuery> & { user: User }
type ExpandedItem = LibraryItem.LibraryItemExpanded
type RequestWithItem<Body = unknown> = ItemRequest<Body> & { libraryItem: ExpandedItem }
type RequestWithFile = RequestWithItem & { libraryFile: LibraryFile }
type CoverUploadRequest = RequestWithItem<{ url?: string }> & { files?: { cover?: Parameters<typeof CoverManager.uploadCover>[1] } }
type PlayRequest = Parameters<PlaybackSessionManager['startSessionRequest']>[0] & RequestWithItem
type MatchOptions = NonNullable<Parameters<typeof Scanner.quickMatchLibraryItem>[2]>
type ItemIdsBody = { libraryItemIds?: string[]; options?: MatchOptions }
type MediaPayload = {
  metadata?: { authors?: { name?: string }[]; series?: { name: string; sequence?: unknown }[] }
  url?: string
  autoDownloadEpisodes?: boolean
  autoDownloadSchedule?: string
  [key: string]: unknown
}
type CoverMedia = { coverPath: string | null; changed(key: 'coverPath', value: true): unknown; changed(): string[] | false; save(): Promise<unknown> }
type ItemResponse = LibraryItem.ExpandedJSON & {
  userMediaProgress?: ReturnType<User['getOldMediaProgress']>
  rssFeed?: ReturnType<Feed['toOldJSONMinified']> | null
  mediaItemShare?: ReturnType<typeof ShareManager.findByMediaItemId>
  episodeDownloadsQueued?: ReturnType<PodcastEpisodeDownload['toJSONForClient']>[]
  episodesDownloading?: ReturnType<PodcastEpisodeDownload['toJSONForClient']>[]
}
type ItemContext = Parameters<typeof Scanner.quickMatchLibraryItem>[0] & {
  audioMetadataManager: AudioMetadataManager
  cronManager: CronManager
  playbackSessionManager: PlaybackSessionManager
  podcastManager: PodcastManager
  handleDeleteLibraryItem(itemId: string, mediaItemIds: string[], libraryId: string | null): Promise<unknown>
}

/**
 * Enforce per-item access for batch item routes
 *
 */
function ensureUserCanAccessLibraryItemsForBatch(req: ItemRequest, res: Response, libraryItems: LibraryItem[]) {
  for (const libraryItem of libraryItems) {
    if (!req.user.checkCanAccessLibraryItem(libraryItem)) {
      res.sendStatus(403)
      return false
    }
  }
  return true
}

class LibraryItemController {
  constructor() {}

  /**
   * GET: /api/items/:id
   * Optional query params:
   * ?include=progress,rssfeed,downloads,share
   * ?expanded=1
   *
   */
  async findOne(this: ItemContext, req: RequestWithItem, res: Response) {
    const includeEntities = (req.query.include || '').split(',')
    if (req.query.expanded == 1) {
      const item: ItemResponse = req.libraryItem.toOldJSONExpanded()

      // Include users media progress
      if (includeEntities.includes('progress')) {
        const episodeId = req.query.episode || null
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
    res.json(req.libraryItem.toOldJSON())
  }

  /**
   * DELETE: /api/items/:id
   * Delete library item. Will delete from database and file system if hard delete is requested.
   * Optional query params:
   * ?hard=1
   *
   *
   */
  async delete(this: ItemContext, req: RequestWithItem, res: Response) {
    const hardDelete = req.query.hard == 1 // Delete from file system
    const libraryItemPath = req.libraryItem.path!

    const mediaItemIds: string[] = []
    const authorIds: string[] = []
    const seriesIds: string[] = []
    if (req.libraryItem.isPodcast) {
      mediaItemIds.push(...(req.libraryItem.media as Podcast.PodcastExpanded).podcastEpisodes.map((ep) => ep.id))
    } else {
      mediaItemIds.push(req.libraryItem.media.id)
      if ((req.libraryItem.media as Book.BookExpanded).authors?.length) {
        authorIds.push(...(req.libraryItem.media as Book.BookExpanded).authors.map((au) => au.id))
      }
      if ((req.libraryItem.media as Book.BookExpanded).series?.length) {
        seriesIds.push(...(req.libraryItem.media as Book.BookExpanded).series.map((se) => se.id))
      }
    }

    await this.handleDeleteLibraryItem(req.libraryItem.id, mediaItemIds, req.libraryItem.libraryId)
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

    await Database.resetLibraryIssuesFilterData(req.libraryItem.libraryId!)
    res.sendStatus(200)
  }

  static handleDownloadError(error: unknown, res: Response) {
    if (!res.headersSent) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
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
   */
  async download(req: RequestWithItem, res: Response) {
    if (!req.user.canDownload) {
      Logger.warn(`User "${req.user.username}" attempted to download without permission`)
      return res.sendStatus(403)
    }
    const libraryItemPath = req.libraryItem.path!
    const itemTitle = req.libraryItem.media.title

    Logger.info(`[LibraryItemController] User "${req.user.username}" requested download for item "${itemTitle}" at "${libraryItemPath}"`)

    try {
      // If library item is a single file in root dir then no need to zip
      if (req.libraryItem.isFile) {
        // Express does not set the correct mimetype for m4b files so use our defined mimetypes if available
        const audioMimeType = getAudioMimeTypeFromExtname(Path.extname(libraryItemPath))
        if (audioMimeType) {
          res.setHeader('Content-Type', audioMimeType)
        }
        await new Promise<void>((resolve, reject) => res.download(libraryItemPath, req.libraryItem.relPath!, (error) => (error ? reject(error) : resolve())))
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
   *
   */
  async updateMedia(this: ItemContext, req: RequestWithItem<MediaPayload>, res: Response) {
    const mediaPayload = req.body

    if (mediaPayload.url) {
      await LibraryItemController.prototype.uploadCover.bind(this)(req, res, false)
      if (res.writableEnded || res.headersSent) return
    }

    // Podcast specific
    let isPodcastAutoDownloadUpdated = false
    if (req.libraryItem.isPodcast) {
      if (mediaPayload.autoDownloadEpisodes !== undefined && (req.libraryItem.media as Podcast).autoDownloadEpisodes !== mediaPayload.autoDownloadEpisodes) {
        isPodcastAutoDownloadUpdated = true
      } else if (mediaPayload.autoDownloadSchedule !== undefined && (req.libraryItem.media as Podcast).autoDownloadSchedule !== mediaPayload.autoDownloadSchedule) {
        isPodcastAutoDownloadUpdated = true
      }

      if (mediaPayload.autoDownloadSchedule && !cron.validate(mediaPayload.autoDownloadSchedule)) {
        Logger.error(`[LibraryItemController] Invalid auto download schedule cron expression "${mediaPayload.autoDownloadSchedule}" for library item "${req.libraryItem.media.title}"`)
        return res.status(400).send('Invalid auto download schedule cron expression')
      }
    }

    let hasUpdates = (await req.libraryItem.media.updateFromRequest(mediaPayload)) || mediaPayload.url

    if (req.libraryItem.isBook && Array.isArray(mediaPayload.metadata?.series)) {
      const seriesUpdateData = await (req.libraryItem.media as Book).updateSeriesFromRequest(mediaPayload.metadata.series, req.libraryItem.libraryId!)
      if (seriesUpdateData?.seriesRemoved.length) {
        // Check remove empty series
        Logger.debug(`[LibraryItemController] Series were removed from book. Check if series are now empty.`)
        await this.checkRemoveEmptySeries(seriesUpdateData.seriesRemoved.map((se) => se.id))
      }
      if (seriesUpdateData?.seriesAdded.length) {
        // Add series to filter data
        seriesUpdateData.seriesAdded.forEach((se) => {
          Database.addSeriesToFilterData(req.libraryItem.libraryId!, se.name!, se.id)
        })
      }
      if (seriesUpdateData?.hasUpdates) {
        hasUpdates = true
      }
    }

    if (req.libraryItem.isBook && Array.isArray(mediaPayload.metadata?.authors)) {
      const authorNames = mediaPayload.metadata.authors.map((au) => (typeof au.name === 'string' ? au.name.trim() : null)).filter((au): au is string => Boolean(au))
      const authorUpdateData = await (req.libraryItem.media as Book).updateAuthorsFromRequest(authorNames, req.libraryItem.libraryId!)
      if (authorUpdateData?.authorsRemoved.length) {
        // Check remove empty authors
        Logger.debug(`[LibraryItemController] Authors were removed from book. Check if authors are now empty.`)
        await this.checkRemoveAuthorsWithNoBooks(authorUpdateData.authorsRemoved.map((au) => au.id))
        hasUpdates = true
      }
      if (authorUpdateData?.authorsAdded.length) {
        // Add authors to filter data
        authorUpdateData.authorsAdded.forEach((au) => {
          Database.addAuthorToFilterData(req.libraryItem.libraryId!, au.name, au.id)
        })
        hasUpdates = true
      }
    }

    if (hasUpdates) {
      req.libraryItem.changed('updatedAt', true)
      await req.libraryItem.save()

      await req.libraryItem.saveMetadataFile()

      if (isPodcastAutoDownloadUpdated) {
        this.cronManager.checkUpdatePodcastCron(req.libraryItem)
      }

      Logger.debug(`[LibraryItemController] Updated library item media ${req.libraryItem.media.title}`)
      SocketAuthority.libraryItemEmitter('item_updated', req.libraryItem)
    }
    res.json({
      updated: hasUpdates,
      libraryItem: req.libraryItem.toOldJSON()
    })
  }

  /**
   * POST: /api/items/:id/cover
   *
   */
  async uploadCover(req: CoverUploadRequest, res: Response, updateAndReturnJson = true) {
    const media: CoverMedia = req.libraryItem.media
    if (!req.user.canUpload) {
      Logger.warn(`User "${req.user.username}" attempted to upload a cover without permission`)
      return res.sendStatus(403)
    }

    let result = null
    if (req.body?.url) {
      Logger.debug(`[LibraryItemController] Requesting download cover from url "${req.body.url}"`)
      result = await CoverManager.downloadCoverFromUrlNew(req.body.url, req.libraryItem.id, req.libraryItem.isFile ? null : req.libraryItem.path)
    } else if (req.files?.cover) {
      Logger.debug(`[LibraryItemController] Handling uploaded cover`)
      result = await CoverManager.uploadCover(req.libraryItem as Parameters<typeof CoverManager.uploadCover>[0], req.files.cover)
    } else {
      return res.status(400).send('Invalid request no file or url')
    }

    if (result?.error) {
      return res.status(400).send(result.error)
    } else if (!result?.cover) {
      return res.status(500).send('Unknown error occurred')
    }

    media.coverPath = result.cover
    media.changed('coverPath', true)
    await media.save()

    if (updateAndReturnJson) {
      // client uses updatedAt timestamp in URL to force refresh cover
      req.libraryItem.changed('updatedAt', true)
      await req.libraryItem.save()

      SocketAuthority.libraryItemEmitter('item_updated', req.libraryItem)
      res.json({
        success: true,
        cover: result.cover
      })
    }
  }

  /**
   * PATCH: /api/items/:id/cover
   *
   * This is used when updating the cover to a local image library file for the library item
   * TODO: In the next API this should be using an inode or similar instead of a file path
   *
   */
  async updateCover(req: RequestWithItem<{ cover?: string }>, res: Response) {
    const media: CoverMedia = req.libraryItem.media
    if (!req.body.cover) {
      return res.status(400).send('Invalid request no cover path')
    }

    // Must be a cover file path inside the libraryFiles array
    const validationResult: { error?: string; cover?: string; updated?: boolean } = await CoverManager.validateCoverPath(req.body.cover, req.libraryItem as Parameters<typeof CoverManager.validateCoverPath>[1])
    if (validationResult.error) {
      return res.status(500).send(validationResult.error)
    }
    if (validationResult.updated) {
      media.coverPath = validationResult.cover!
      media.changed('coverPath', true)
      await media.save()

      // client uses updatedAt timestamp in URL to force refresh cover
      req.libraryItem.changed('updatedAt', true)
      await req.libraryItem.save()

      SocketAuthority.libraryItemEmitter('item_updated', req.libraryItem)
    }
    res.json({
      success: true,
      cover: validationResult.cover
    })
  }

  /**
   * DELETE: /api/items/:id/cover
   *
   */
  async removeCover(req: RequestWithItem, res: Response) {
    const media: CoverMedia = req.libraryItem.media
    if (media.coverPath) {
      media.coverPath = null
      media.changed('coverPath', true)
      await media.save()

      // client uses updatedAt timestamp in URL to force refresh cover
      req.libraryItem.changed('updatedAt', true)
      await req.libraryItem.save()

      await CacheManager.purgeCoverCache(req.libraryItem.id)

      SocketAuthority.libraryItemEmitter('item_updated', req.libraryItem)
    }

    res.sendStatus(200)
  }

  /**
   * GET: /api/items/:id/cover
   *
   */
  async getCover(req: ItemRequest, res: Response) {
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
      height: clampPositiveInt(height ? parseInt(height) : null, 4096),
      width: clampPositiveInt(width ? parseInt(width) : null, 4096)
    }
    return CacheManager.handleCoverCache(res, libraryItemId, options)
  }

  /**
   * POST: /api/items/:id/play
   *
   *
   */
  startPlaybackSession(this: ItemContext, req: PlayRequest, res: Response) {
    if (!req.libraryItem.hasAudioTracks) {
      Logger.error(`[LibraryItemController] startPlaybackSession cannot playback ${req.libraryItem.id}`)
      return res.sendStatus(404)
    }

    void this.playbackSessionManager.startSessionRequest(req, res, null)
  }

  /**
   * POST: /api/items/:id/play/:episodeId
   *
   *
   */
  startEpisodePlaybackSession(this: ItemContext, req: PlayRequest, res: Response) {
    if (!req.libraryItem.isPodcast) {
      Logger.error(`[LibraryItemController] startEpisodePlaybackSession invalid media type ${req.libraryItem.id}`)
      return res.sendStatus(400)
    }

    const episodeId = req.params.episodeId
    if (!(req.libraryItem.media as Podcast.PodcastExpanded).podcastEpisodes.some((ep) => ep.id === episodeId)) {
      Logger.error(`[LibraryItemController] startPlaybackSession episode ${episodeId} not found for item ${req.libraryItem.id}`)
      return res.sendStatus(404)
    }

    void this.playbackSessionManager.startSessionRequest(req, res, episodeId)
  }

  /**
   * PATCH: /api/items/:id/tracks
   *
   */
  async updateTracks(req: RequestWithItem<{ orderedFileData?: { ino?: string; exclude?: boolean }[] }>, res: Response) {
    const book = req.libraryItem.media as Book
    const orderedFileData = req.body?.orderedFileData

    if (!req.libraryItem.isBook) {
      Logger.error(`[LibraryItemController] updateTracks invalid media type ${req.libraryItem.id}`)
      return res.sendStatus(400)
    }
    if (!Array.isArray(orderedFileData) || !orderedFileData.length) {
      Logger.error(`[LibraryItemController] updateTracks invalid orderedFileData ${req.libraryItem.id}`)
      return res.sendStatus(400)
    }
    // Ensure that each orderedFileData has a valid ino and is in the book audioFiles
    if (orderedFileData.some((fileData) => !fileData?.ino || !book.audioFiles!.some((af) => af.ino === fileData.ino))) {
      Logger.error(`[LibraryItemController] updateTracks invalid orderedFileData ${req.libraryItem.id}`)
      return res.sendStatus(400)
    }

    let index = 1
    const updatedAudioFiles = orderedFileData.map((fileData) => {
      const audioFile = book.audioFiles!.find((af) => af.ino === fileData.ino)!
      audioFile.manuallyVerified = true
      audioFile.exclude = !!fileData.exclude
      if (audioFile.exclude) {
        audioFile.index = -1
      } else {
        audioFile.index = index++
      }
      return audioFile
    })
    updatedAudioFiles.sort((a, b) => a.index! - b.index!)

    book.audioFiles = updatedAudioFiles
    book.changed('audioFiles', true)
    await book.save()

    SocketAuthority.libraryItemEmitter('item_updated', req.libraryItem)
    res.json(req.libraryItem.toOldJSON())
  }

  /**
   * POST /api/items/:id/match
   *
   */
  async match(this: ItemContext, req: RequestWithItem<MatchOptions>, res: Response) {
    const reqBody = req.body || {}

    const options: MatchOptions = {}
    const matchOptions = ['provider', 'title', 'author', 'isbn', 'asin'] as const
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

    const matchResult = await Scanner.quickMatchLibraryItem(this, req.libraryItem, options)
    res.json(matchResult)
  }

  /**
   * POST: /api/items/batch/delete
   * Batch delete library items. Will delete from database and file system if hard delete is requested.
   * Optional query params:
   * ?hard=1
   *
   *
   */
  async batchDelete(this: ItemContext, req: ItemRequest<ItemIdsBody>, res: Response) {
    if (!req.user.canDelete) {
      Logger.warn(`[LibraryItemController] User "${req.user.username}" attempted to delete without permission`)
      return res.sendStatus(403)
    }
    const hardDelete = req.query.hard == 1 // Delete files from filesystem

    const { libraryItemIds } = req.body
    if (!libraryItemIds?.length || !Array.isArray(libraryItemIds)) {
      return res.status(400).send('Invalid request body')
    }

    const itemsToDelete = await Database.libraryItemModel.findAllExpandedWhere({
      id: libraryItemIds
    })

    if (!itemsToDelete.length) {
      return res.sendStatus(404)
    }

    // Ensure user has permission to delete these library items
    if (!ensureUserCanAccessLibraryItemsForBatch(req, res, itemsToDelete)) {
      return
    }

    const libraryId = itemsToDelete[0].libraryId

    for (const libraryItem of itemsToDelete) {
      const libraryItemPath = libraryItem.path!
      Logger.info(`[LibraryItemController] (${hardDelete ? 'Hard' : 'Soft'}) deleting Library Item "${libraryItem.media.title}" with id "${libraryItem.id}"`)
      const mediaItemIds: string[] = []
      const seriesIds: string[] = []
      const authorIds: string[] = []
      if (libraryItem.isPodcast) {
        mediaItemIds.push(...(libraryItem.media as Podcast.PodcastExpanded).podcastEpisodes.map((ep) => ep.id))
      } else {
        mediaItemIds.push(libraryItem.media.id)
        if ((libraryItem.media as Book.BookExpanded).series?.length) {
          seriesIds.push(...(libraryItem.media as Book.BookExpanded).series.map((se) => se.id))
        }
        if ((libraryItem.media as Book.BookExpanded).authors?.length) {
          authorIds.push(...(libraryItem.media as Book.BookExpanded).authors.map((au) => au.id))
        }
      }
      await this.handleDeleteLibraryItem(libraryItem.id, mediaItemIds, libraryItem.libraryId)
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

    await Database.resetLibraryIssuesFilterData(libraryId!)

    res.sendStatus(200)
  }

  /**
   * POST: /api/items/batch/update
   *
   *
   */
  async batchUpdate(this: ItemContext, req: ItemRequest<{ id?: string; mediaPayload: MediaPayload }[]>, res: Response) {
    if (!req.user.canUpdate) {
      Logger.warn(`[LibraryItemController] User "${req.user.username}" attempted to batch update without permission`)
      return res.sendStatus(403)
    }

    const updatePayloads = req.body
    if (!Array.isArray(updatePayloads) || !updatePayloads.length) {
      Logger.error(`[LibraryItemController] Batch update failed. Invalid payload`)
      return res.sendStatus(400)
    }

    // Ensure that each update payload has a unique library item id
    const libraryItemIds = [...new Set(updatePayloads.map((up) => up?.id).filter((id): id is string => Boolean(id)))]
    if (!libraryItemIds.length || libraryItemIds.length !== updatePayloads.length) {
      Logger.error(`[LibraryItemController] Batch update failed. Each update payload must have a unique library item id`)
      return res.sendStatus(400)
    }

    // Get all library items to update
    const libraryItems = await Database.libraryItemModel.findAllExpandedWhere({
      id: libraryItemIds
    })
    if (updatePayloads.length !== libraryItems.length) {
      Logger.error(`[LibraryItemController] Batch update failed. Not all library items found`)
      return res.sendStatus(404)
    }

    // Ensure user has permission to update these library items
    if (!ensureUserCanAccessLibraryItemsForBatch(req, res, libraryItems)) {
      return
    }

    let itemsUpdated = 0

    const seriesIdsRemoved: string[] = []
    const authorIdsRemoved: string[] = []

    for (const updatePayload of updatePayloads) {
      const mediaPayload = updatePayload.mediaPayload
      const libraryItem = libraryItems.find((li) => li.id === updatePayload.id)!

      if (libraryItem.isPodcast && mediaPayload.autoDownloadSchedule && !cron.validate(mediaPayload.autoDownloadSchedule)) {
        Logger.warn(`[LibraryItemController] Invalid auto download schedule cron expression "${mediaPayload.autoDownloadSchedule}" for library item "${libraryItem.media.title}" - skipping update`)
        continue
      }

      let hasUpdates = await libraryItem.media.updateFromRequest(mediaPayload)

      if (libraryItem.isBook && Array.isArray(mediaPayload.metadata?.series)) {
        const seriesUpdateData = await (libraryItem.media as Book).updateSeriesFromRequest(mediaPayload.metadata.series, libraryItem.libraryId!)
        if (seriesUpdateData?.seriesRemoved.length) {
          seriesIdsRemoved.push(...seriesUpdateData.seriesRemoved.map((se) => se.id))
        }
        if (seriesUpdateData?.seriesAdded.length) {
          seriesUpdateData.seriesAdded.forEach((se) => {
            Database.addSeriesToFilterData(libraryItem.libraryId!, se.name!, se.id)
          })
        }
        if (seriesUpdateData?.hasUpdates) {
          hasUpdates = true
        }
      }

      if (libraryItem.isBook && Array.isArray(mediaPayload.metadata?.authors)) {
        const authorNames = mediaPayload.metadata.authors.map((au) => (typeof au.name === 'string' ? au.name.trim() : null)).filter((au): au is string => Boolean(au))
        const authorUpdateData = await (libraryItem.media as Book).updateAuthorsFromRequest(authorNames, libraryItem.libraryId!)
        if (authorUpdateData?.authorsRemoved.length) {
          authorIdsRemoved.push(...authorUpdateData.authorsRemoved.map((au) => au.id))
          hasUpdates = true
        }
        if (authorUpdateData?.authorsAdded.length) {
          authorUpdateData.authorsAdded.forEach((au) => {
            Database.addAuthorToFilterData(libraryItem.libraryId!, au.name, au.id)
          })
          hasUpdates = true
        }
      }

      if (hasUpdates) {
        libraryItem.changed('updatedAt', true)
        await libraryItem.save()

        await libraryItem.saveMetadataFile()

        Logger.debug(`[LibraryItemController] Updated library item media "${libraryItem.media.title}"`)
        SocketAuthority.libraryItemEmitter('item_updated', libraryItem)
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
   */
  async batchGet(req: ItemRequest<ItemIdsBody>, res: Response) {
    const libraryItemIds = req.body.libraryItemIds || []
    if (!libraryItemIds.length) {
      return res.status(403).send('Invalid payload')
    }
    const libraryItems = await Database.libraryItemModel.findAllExpandedWhere({
      id: libraryItemIds
    })
    // Ensure user has permission to access these library items
    if (!ensureUserCanAccessLibraryItemsForBatch(req, res, libraryItems)) {
      return
    }
    res.json({
      libraryItems: libraryItems.map((li) => li.toOldJSONExpanded())
    })
  }

  /**
   * POST: /api/items/batch/quickmatch
   *
   */
  async batchQuickMatch(this: ItemContext, req: ItemRequest<ItemIdsBody>, res: Response) {
    if (!req.user.isAdminOrUp) {
      Logger.warn(`Non-admin user "${req.user.username}" other than admin attempted to batch quick match library items`)
      return res.sendStatus(403)
    }

    let itemsUpdated = 0
    let itemsUnmatched = 0

    if (!req.body.libraryItemIds?.length) {
      return res.sendStatus(400)
    }

    const libraryItems = await Database.libraryItemModel.findAllExpandedWhere({
      id: req.body.libraryItemIds
    })
    if (!libraryItems?.length) {
      return res.sendStatus(400)
    }

    res.sendStatus(200)

    const reqBodyOptions = req.body.options || {}
    const options: MatchOptions = {}
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
   */
  async batchScan(req: ItemRequest<ItemIdsBody>, res: Response) {
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

    await Database.resetLibraryIssuesFilterData(libraryId!)
  }

  /**
   * POST: /api/items/:id/scan
   *
   */
  async scan(req: RequestWithItem, res: Response) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[LibraryItemController] Non-admin user "${req.user.username}" attempted to scan library item`)
      return res.sendStatus(403)
    }

    if (req.libraryItem.isFile) {
      Logger.error(`[LibraryItemController] Re-scanning file library items not yet supported`)
      return res.sendStatus(500)
    }

    const result = await LibraryItemScanner.scanLibraryItem(req.libraryItem.id)
    await Database.resetLibraryIssuesFilterData(req.libraryItem.libraryId!)
    res.json({
      result: Object.keys(ScanResult).find((key) => ScanResult[key as keyof typeof ScanResult] == result)
    })
  }

  /**
   * GET: /api/items/:id/metadata-object
   *
   */
  getMetadataObject(this: ItemContext, req: RequestWithItem, res: Response) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[LibraryItemController] Non-admin user "${req.user.username}" attempted to get metadata object`)
      return res.sendStatus(403)
    }

    if (req.libraryItem.isMissing || !req.libraryItem.isBook || !(req.libraryItem.media as Book).includedAudioFiles.length) {
      Logger.error(`[LibraryItemController] getMetadataObject: Invalid library item "${req.libraryItem.media.title}"`)
      return res.sendStatus(400)
    }

    res.json(this.audioMetadataManager.getMetadataObjectForApi(req.libraryItem as Parameters<AudioMetadataManager['getMetadataObjectForApi']>[0]))
  }

  /**
   * POST: /api/items/:id/chapters
   *
   */
  async updateMediaChapters(req: RequestWithItem<{ chapters?: Book.ChapterObject[] }>, res: Response) {
    const book = req.libraryItem.media as Book
    if (!req.user.canUpdate) {
      Logger.error(`[LibraryItemController] User "${req.user.username}" attempted to update chapters with invalid permissions`)
      return res.sendStatus(403)
    }

    if (req.libraryItem.isMissing || !req.libraryItem.isBook || !book.hasAudioTracks) {
      Logger.error(`[LibraryItemController] Invalid library item`)
      return res.sendStatus(500)
    }

    if (!Array.isArray(req.body.chapters) || req.body.chapters.some((c) => !c.title || typeof c.title !== 'string' || c.start === undefined || typeof c.start !== 'number' || c.end === undefined || typeof c.end !== 'number')) {
      Logger.error(`[LibraryItemController] Invalid payload`)
      return res.sendStatus(400)
    }

    const chapters = req.body.chapters || []

    let hasUpdates = false
    if (chapters.length !== book.chapters!.length) {
      book.chapters = chapters.map((c, index) => {
        return {
          id: index,
          title: c.title,
          start: c.start,
          end: c.end
        }
      })
      hasUpdates = true
    } else {
      for (const [index, chapter] of chapters.entries()) {
        const currentChapter = book.chapters![index]
        if (currentChapter.title !== chapter.title || currentChapter.start !== chapter.start || currentChapter.end !== chapter.end) {
          currentChapter.title = chapter.title
          currentChapter.start = chapter.start
          currentChapter.end = chapter.end
          hasUpdates = true
        }
      }
    }

    if (hasUpdates) {
      book.changed('chapters', true)
      await book.save()

      await req.libraryItem.saveMetadataFile()

      SocketAuthority.libraryItemEmitter('item_updated', req.libraryItem)
    }

    res.json({
      success: true,
      updated: hasUpdates
    })
  }

  /**
   * GET: /api/items/:id/ffprobe/:fileid
   * FFProbe JSON result from audio file
   *
   */
  async getFFprobeData(req: RequestWithItem, res: Response) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[LibraryItemController] Non-admin user "${req.user.username}" attempted to get ffprobe data`)
      return res.sendStatus(403)
    }

    const audioFile = req.libraryItem.getAudioFileWithIno(req.params.fileid)
    if (!audioFile) {
      Logger.error(`[LibraryItemController] Audio file not found with inode value ${req.params.fileid}`)
      return res.sendStatus(404)
    }

    const ffprobeData = await AudioFileScanner.probeAudioFile(audioFile.metadata.path!)
    res.json(ffprobeData)
  }

  /**
   * GET api/items/:id/file/:fileid
   *
   */
  async getLibraryFile(req: RequestWithFile, res: Response) {
    const libraryFile = req.libraryFile

    if (global.XAccel) {
      const encodedURI = encodeUriPath(global.XAccel + libraryFile.metadata!.path!)
      Logger.debug(`Use X-Accel to serve static file ${encodedURI}`)
      return res.status(204).header({ 'X-Accel-Redirect': encodedURI }).send()
    }

    // Express does not set the correct mimetype for m4b files so use our defined mimetypes if available
    const audioMimeType = getAudioMimeTypeFromExtname(Path.extname(libraryFile.metadata!.path!))
    if (audioMimeType) {
      res.setHeader('Content-Type', audioMimeType)
    }
    res.sendFile(libraryFile.metadata!.path!)
    return Promise.resolve()
  }

  /**
   * DELETE api/items/:id/file/:fileid
   *
   */
  async deleteLibraryFile(req: RequestWithFile, res: Response) {
    const libraryFile = req.libraryFile

    Logger.info(`[LibraryItemController] User "${req.user.username}" requested file delete at "${libraryFile.metadata!.path!}"`)

    await fs.remove(libraryFile.metadata!.path!).catch((error) => {
      Logger.error(`[LibraryItemController] Failed to delete library file at "${libraryFile.metadata!.path!}"`, error)
    })

    req.libraryItem.libraryFiles = req.libraryItem.libraryFiles!.filter((lf) => lf.ino !== req.params.fileid)
    req.libraryItem.changed('libraryFiles', true)

    const media: CoverMedia = req.libraryItem.media
    const podcast = req.libraryItem.media as Podcast.PodcastExpanded
    if (req.libraryItem.isBook) {
      const book = req.libraryItem.media as Book
      if (book.audioFiles!.some((af) => af.ino === req.params.fileid)) {
        book.audioFiles = book.audioFiles!.filter((af) => af.ino !== req.params.fileid)
        book.changed('audioFiles', true)
      } else if (book.ebookFile?.ino === req.params.fileid) {
        book.ebookFile = null
        book.changed('ebookFile', true)
      }
      if (!book.hasMediaFiles) {
        req.libraryItem.isMissing = true
      }
    } else if (podcast.podcastEpisodes.some((ep) => ep.audioFile!.ino === req.params.fileid)) {
      const episodeToRemove = podcast.podcastEpisodes.find((ep) => ep.audioFile!.ino === req.params.fileid)!
      // Remove episode from all playlists
      await Database.playlistModel.removeMediaItemsFromPlaylists([episodeToRemove.id])

      // Remove episode media progress
      const numProgressRemoved = await Database.mediaProgressModel.destroy({
        where: {
          mediaItemId: episodeToRemove.id
        }
      })
      if (numProgressRemoved > 0) {
        Logger.info(`[LibraryItemController] Removed media progress for episode ${episodeToRemove.id}`)
      }

      // Remove episode
      await episodeToRemove.destroy()

      podcast.podcastEpisodes = podcast.podcastEpisodes.filter((ep) => ep.audioFile!.ino !== req.params.fileid)
    }

    if (media.changed()) {
      await media.save()
    }

    await req.libraryItem.save()

    SocketAuthority.libraryItemEmitter('item_updated', req.libraryItem)
    res.sendStatus(200)
  }

  /**
   * GET api/items/:id/file/:fileid/download
   * Same as GET api/items/:id/file/:fileid but allows logging and restricting downloads
   *
   */
  async downloadLibraryFile(req: RequestWithFile, res: Response) {
    const libraryFile = req.libraryFile
    const ua = uaParserJs(req.headers['user-agent'])

    if (!req.user.canDownload) {
      Logger.error(`[LibraryItemController] User "${req.user.username}" without download permission attempted to download file "${libraryFile.metadata!.path!}"`)
      return res.sendStatus(403)
    }

    Logger.info(`[LibraryItemController] User "${req.user.username}" requested download for item "${req.libraryItem.media.title}" file at "${libraryFile.metadata!.path!}"`)

    if (global.XAccel) {
      const encodedURI = encodeUriPath(global.XAccel + libraryFile.metadata!.path!)
      Logger.debug(`Use X-Accel to serve static file ${encodedURI}`)
      return res.status(204).header({ 'X-Accel-Redirect': encodedURI }).send()
    }

    // Express does not set the correct mimetype for m4b files so use our defined mimetypes if available
    let audioMimeType = getAudioMimeTypeFromExtname(Path.extname(libraryFile.metadata!.path!))
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
      await new Promise<void>((resolve, reject) => res.download(libraryFile.metadata!.path!, libraryFile.metadata!.filename!, (error) => (error ? reject(error) : resolve())))
      Logger.info(`[LibraryItemController] Downloaded file "${libraryFile.metadata!.path!}"`)
    } catch (error) {
      Logger.error(`[LibraryItemController] Failed to download file "${libraryFile.metadata!.path!}"`, error)
      LibraryItemController.handleDownloadError(error, res)
    }
  }

  /**
   * GET api/items/:id/ebook/:fileid?
   * fileid is the inode value stored in LibraryFile.ino or EBookFile.ino
   * fileid is only required when reading a supplementary ebook
   * when no fileid is passed in the primary ebook will be returned
   *
   */
  async getEBookFile(req: RequestWithItem, res: Response) {
    let ebookFile: LibraryFile | Book.EBookFileObject | null = null
    if (req.params.fileid) {
      ebookFile = req.libraryItem.getLibraryFileWithIno(req.params.fileid)
      if (!ebookFile?.isEBookFile) {
        Logger.error(`[LibraryItemController] Invalid ebook file id "${req.params.fileid}"`)
        return res.status(400).send('Invalid ebook file id')
      }
    } else {
      ebookFile = (req.libraryItem.media as Book).ebookFile
    }

    if (!ebookFile) {
      Logger.error(`[LibraryItemController] No ebookFile for library item "${req.libraryItem.media.title}"`)
      return res.sendStatus(404)
    }
    const ebookFilePath = ebookFile.metadata!.path!

    Logger.info(`[LibraryItemController] User "${req.user.username}" requested download for item "${req.libraryItem.media.title}" ebook at "${ebookFilePath}"`)

    if (global.XAccel) {
      const encodedURI = encodeUriPath(global.XAccel + ebookFilePath)
      Logger.debug(`Use X-Accel to serve static file ${encodedURI}`)
      return res.status(204).header({ 'X-Accel-Redirect': encodedURI }).send()
    }

    try {
      await new Promise<void>((resolve, reject) => res.sendFile(ebookFilePath, (error) => (error ? reject(error) : resolve())))
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
   */
  async updateEbookFileStatus(req: RequestWithFile, res: Response) {
    const book = req.libraryItem.media as Book
    if (!req.libraryItem.isBook) {
      Logger.error(`[LibraryItemController] Invalid media type for ebook file status update`)
      return res.sendStatus(400)
    }
    if (!req.libraryFile?.isEBookFile) {
      Logger.error(`[LibraryItemController] Invalid ebook file id "${req.params.fileid}"`)
      return res.status(400).send('Invalid ebook file id')
    }

    const ebookLibraryFile = req.libraryFile
    let primaryEbookFile: (Book.EBookFileObject & { isSupplementary?: boolean | null; fileType?: unknown }) | null = null

    const ebookLibraryFileInos = req.libraryItem
      .getLibraryFiles()
      .filter((lf) => lf.isEBookFile)
      .map((lf) => lf.ino)

    if (ebookLibraryFile.isSupplementary) {
      Logger.info(`[LibraryItemController] Updating ebook file "${ebookLibraryFile.metadata!.filename}" to primary`)

      primaryEbookFile = ebookLibraryFile.toJSON()
      delete primaryEbookFile.isSupplementary
      delete primaryEbookFile.fileType
      primaryEbookFile.ebookFormat = ebookLibraryFile.metadata!.format
    } else {
      Logger.info(`[LibraryItemController] Updating ebook file "${ebookLibraryFile.metadata!.filename}" to supplementary`)
    }

    book.ebookFile = primaryEbookFile
    book.changed('ebookFile', true)
    await book.save()

    req.libraryItem.libraryFiles = req.libraryItem.libraryFiles!.map((lf) => {
      if (ebookLibraryFileInos.includes(lf.ino)) {
        lf.isSupplementary = lf.ino !== primaryEbookFile?.ino
      }
      return lf
    })
    req.libraryItem.changed('libraryFiles', true)

    req.libraryItem.isMissing = !book.hasMediaFiles

    await req.libraryItem.save()

    SocketAuthority.libraryItemEmitter('item_updated', req.libraryItem)
    res.sendStatus(200)
  }

  async middleware(req: ItemRequest & { libraryItem?: ExpandedItem | null; libraryFile?: LibraryFile | null }, res: Response, next: NextFunction) {
    req.libraryItem = await Database.libraryItemModel.getExpandedById(req.params.id)
    if (!req.libraryItem?.media) return res.sendStatus(404)

    // Check user can access this library item
    if (!req.user.checkCanAccessLibraryItem(req.libraryItem)) {
      return res.sendStatus(403)
    }

    // For library file routes, get the library file
    if (req.params.fileid) {
      req.libraryFile = req.libraryItem.getLibraryFileWithIno(req.params.fileid)
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
export = new LibraryItemController()
