import type { Request, Response, NextFunction } from 'express'
import type User from '../models/User'
import type LibraryItem from '../models/LibraryItem'
import type AbMergeManager from '../managers/AbMergeManager'
import type AudioMetadataManager from '../managers/AudioMetadataManager'
import type { MergeEncodeOptions } from '../types/ffmpegHelpers'
import Logger from '../Logger'
import Database from '../Database'

type RequestWithUser = Request & { user: User }
type RequestWithLibraryItem = RequestWithUser & { libraryItem: LibraryItem.LibraryItemExpanded }
type ToolsContext = { abMergeManager: AbMergeManager; audioMetadataManager: AudioMetadataManager }
type AudioBookItem = Parameters<AudioMetadataManager['updateMetadataForItem']>[1]

class ToolsController {
  constructor() {}

  /**
   * POST: /api/tools/item/:id/encode-m4b
   * Start an audiobook merge to m4b task
   */
  async encodeM4b(this: ToolsContext, req: RequestWithLibraryItem, res: Response) {
    if (req.libraryItem.isMissing || req.libraryItem.isInvalid) {
      Logger.error(`[MiscController] encodeM4b: library item not found or invalid ${req.params.id}`)
      return res.status(404).send('Audiobook not found')
    }

    if (!req.libraryItem.isBook) {
      Logger.error(`[MiscController] encodeM4b: Invalid library item ${req.params.id}: not a book`)
      return res.status(400).send('Invalid library item: not a book')
    }

    if (!req.libraryItem.hasAudioTracks) {
      Logger.error(`[MiscController] encodeM4b: Invalid audiobook ${req.params.id}: no audio tracks`)
      return res.status(400).send('Invalid audiobook: no audio tracks')
    }

    if (this.abMergeManager.getPendingTaskByLibraryItemId(req.libraryItem.id)) {
      Logger.error(`[MiscController] encodeM4b: Audiobook ${req.params.id} is already processing`)
      return res.status(400).send('Audiobook is already processing')
    }

    const options: MergeEncodeOptions = req.query || {}
    Logger.info(`[ToolsController] encodeM4b: Starting audiobook merge for "${req.libraryItem.media.title}" with options: ${JSON.stringify(options)}`)
    void this.abMergeManager.startAudiobookMerge(req.user.id, req.libraryItem as AudioBookItem, options)

    res.sendStatus(200)
    return Promise.resolve()
  }

  /**
   * DELETE: /api/tools/item/:id/encode-m4b
   * Cancel a running m4b merge task
   */
  async cancelM4bEncode(this: ToolsContext, req: RequestWithUser, res: Response) {
    const workerTask = this.abMergeManager.getPendingTaskByLibraryItemId(req.params.id)
    if (!workerTask) return res.sendStatus(404)

    void this.abMergeManager.cancelEncode(workerTask.task)

    res.sendStatus(200)
    return Promise.resolve()
  }

  /**
   * POST: /api/tools/item/:id/embed-metadata
   * Start audiobook embed task
   */
  async embedAudioFileMetadata(this: ToolsContext, req: RequestWithLibraryItem, res: Response) {
    if (req.libraryItem.isMissing || !req.libraryItem.hasAudioTracks || !req.libraryItem.isBook) {
      Logger.error(`[ToolsController] Invalid library item`)
      return res.sendStatus(400)
    }

    if (this.audioMetadataManager.getIsLibraryItemQueuedOrProcessing(req.libraryItem.id)) {
      Logger.error(`[ToolsController] Library item (${req.libraryItem.id}) is already in queue or processing`)
      return res.status(400).send('Library item is already in queue or processing')
    }

    const options = {
      forceEmbedChapters: req.query.forceEmbedChapters === '1',
      backup: req.query.backup === '1'
    }
    void this.audioMetadataManager.updateMetadataForItem(req.user.id, req.libraryItem as AudioBookItem, options)
    res.sendStatus(200)
    return Promise.resolve()
  }

  /**
   * POST: /api/tools/batch/embed-metadata
   * Start batch audiobook embed task
   */
  async batchEmbedMetadata(this: ToolsContext, req: Request<Record<string, string>, unknown, { libraryItemIds?: string[] }> & { user: User }, res: Response) {
    const libraryItemIds = req.body.libraryItemIds || []
    if (!libraryItemIds.length) {
      return res.status(400).send('Invalid request payload')
    }

    const libraryItems: AudioBookItem[] = []
    for (const libraryItemId of libraryItemIds) {
      const libraryItem = await Database.libraryItemModel.getExpandedById(libraryItemId)
      if (!libraryItem) {
        Logger.error(`[ToolsController] Batch embed metadata library item (${libraryItemId}) not found`)
        return res.sendStatus(404)
      }

      // Check user can access this library item
      if (!req.user.checkCanAccessLibraryItem(libraryItem)) {
        Logger.error(`[ToolsController] Batch embed metadata library item (${libraryItemId}) not accessible to user "${req.user.username}"`)
        return res.sendStatus(403)
      }

      if (libraryItem.isMissing || !libraryItem.hasAudioTracks || !libraryItem.isBook) {
        Logger.error(`[ToolsController] Batch embed invalid library item (${libraryItemId})`)
        return res.sendStatus(400)
      }

      if (this.audioMetadataManager.getIsLibraryItemQueuedOrProcessing(libraryItemId)) {
        Logger.error(`[ToolsController] Batch embed library item (${libraryItemId}) is already in queue or processing`)
        return res.status(400).send('Library item is already in queue or processing')
      }

      libraryItems.push(libraryItem as AudioBookItem)
    }

    const options = {
      forceEmbedChapters: req.query.forceEmbedChapters === '1',
      backup: req.query.backup === '1'
    }
    this.audioMetadataManager.handleBatchEmbed(req.user.id, libraryItems, options)
    res.sendStatus(200)
  }

  async middleware(req: RequestWithUser & { libraryItem?: LibraryItem.LibraryItemExpanded }, res: Response, next: NextFunction) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[LibraryItemController] Non-root user "${req.user.username}" attempted to access tools route`)
      return res.sendStatus(403)
    }

    if (req.params.id) {
      const item = await Database.libraryItemModel.getExpandedById(req.params.id)
      if (!item?.media) return res.sendStatus(404)

      // Check user can access this library item
      if (!req.user.checkCanAccessLibraryItem(item)) {
        return res.sendStatus(403)
      }

      req.libraryItem = item
    }

    next()
  }
}
export = new ToolsController()
