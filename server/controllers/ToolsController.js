const Logger = require('../Logger')

class ToolsController {
  constructor() { }

  // POST: api/tools/item/:id/encode-m4b
  async encodeM4b(req, res) {
    if (req.libraryItem.isMissing || req.libraryItem.isInvalid) {
      Logger.error(`[MiscController] encodeM4b: library item not found or invalid ${req.params.id}`)
      return res.status(404).send('Audiobook not found')
    }

    if (req.libraryItem.mediaType !== 'book') {
      Logger.error(`[MiscController] encodeM4b: Invalid library item ${req.params.id}: not a book`)
      return res.status(500).send('Invalid library item: not a book')
    }

    if (req.libraryItem.media.tracks.length <= 0) {
      Logger.error(`[MiscController] encodeM4b: Invalid audiobook ${req.params.id}: no audio tracks`)
      return res.status(500).send('Invalid audiobook: no audio tracks')
    }

    const options = req.query || {}
    this.abMergeManager.startAudiobookMerge(req.user, req.libraryItem, options)

    res.sendStatus(200)
  }

  // DELETE: api/tools/item/:id/encode-m4b
  async cancelM4bEncode(req, res) {
    const workerTask = this.abMergeManager.getPendingTaskByLibraryItemId(req.params.id)
    if (!workerTask) return res.sendStatus(404)

    this.abMergeManager.cancelEncode(workerTask.task)

    res.sendStatus(200)
  }

  // POST: api/tools/item/:id/embed-metadata
  async embedAudioFileMetadata(req, res) {
    if (req.libraryItem.isMissing || !req.libraryItem.hasAudioFiles || !req.libraryItem.isBook) {
      Logger.error(`[ToolsController] Invalid library item`)
      return res.sendStatus(500)
    }

    if (this.audioMetadataManager.getIsLibraryItemQueuedOrProcessing(req.libraryItem.id)) {
      Logger.error(`[ToolsController] Library item (${req.libraryItem.id}) is already in queue or processing`)
      return res.status(500).send('Library item is already in queue or processing')
    }

    const options = {
      forceEmbedChapters: req.query.forceEmbedChapters === '1',
      backup: req.query.backup === '1'
    }
    this.audioMetadataManager.updateMetadataForItem(req.user, req.libraryItem, options)
    res.sendStatus(200)
  }

  // POST: api/tools/batch/embed-metadata
  async batchEmbedMetadata(req, res) {
    const libraryItemIds = req.body.libraryItemIds || []
    if (!libraryItemIds.length) {
      return res.status(400).send('Invalid request payload')
    }

    const libraryItems = []
    for (const libraryItemId of libraryItemIds) {
      const libraryItem = this.db.getLibraryItem(libraryItemId)
      if (!libraryItem) {
        Logger.error(`[ToolsController] Batch embed metadata library item (${libraryItemId}) not found`)
        return res.sendStatus(404)
      }

      // Check user can access this library item
      if (!req.user.checkCanAccessLibraryItem(libraryItem)) {
        Logger.error(`[ToolsController] Batch embed metadata library item (${libraryItemId}) not accessible to user`, req.user)
        return res.sendStatus(403)
      }

      if (libraryItem.isMissing || !libraryItem.hasAudioFiles || !libraryItem.isBook) {
        Logger.error(`[ToolsController] Batch embed invalid library item (${libraryItemId})`)
        return res.sendStatus(500)
      }

      if (this.audioMetadataManager.getIsLibraryItemQueuedOrProcessing(libraryItemId)) {
        Logger.error(`[ToolsController] Batch embed library item (${libraryItemId}) is already in queue or processing`)
        return res.status(500).send('Library item is already in queue or processing')
      }

      libraryItems.push(libraryItem)
    }

    const options = {
      forceEmbedChapters: req.query.forceEmbedChapters === '1',
      backup: req.query.backup === '1'
    }
    this.audioMetadataManager.handleBatchEmbed(req.user, libraryItems, options)
    res.sendStatus(200)
  }

  middleware(req, res, next) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[LibraryItemController] Non-root user attempted to access tools route`, req.user)
      return res.sendStatus(403)
    }

    if (req.params.id) {
      const item = this.db.libraryItems.find(li => li.id === req.params.id)
      if (!item || !item.media) return res.sendStatus(404)

      // Check user can access this library item
      if (!req.user.checkCanAccessLibraryItem(item)) {
        return res.sendStatus(403)
      }

      req.libraryItem = item
    }

    next()
  }
  // POST: api/tools/item/:id/renameFolder
  async renameBookFolder(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error('[MiscController] renameBookFolder: Non-admin user attempting to make m4b', req.user)
      return res.sendStatus(403)
    }

    if (req.libraryItem.isMissing || req.libraryItem.isInvalid) {
      Logger.error(`[MiscController] renameBookFolder: library item not found or invalid ${req.params.id}`)
      return res.status(404).send('Audiobook not found')
    }

    if (req.libraryItem.mediaType !== 'book') {
      Logger.error(`[MiscController] renameBookFolder: Invalid library item ${req.params.id}: not a book`)
      return res.status(500).send('Invalid library item: not a book')
    }


    const options = req.query || {}
    var renameStatus = await this.folderRenameManager.startRenameBookFolder(req.libraryItem, req.query.strFormat || "")

    //res.sendStatus(200)
    res.json(renameStatus)
  }
  testRenameBookFolder(req, res) {
    if (req.libraryItem.isMissing || req.libraryItem.isInvalid) {
      Logger.error(`[MiscController] renameBookFolder: library item not found or invalid ${req.params.id}`)
      return res.status(404).send('Audiobook not found')
    }
    if (req.libraryItem.mediaType !== 'book') {
      Logger.error(`[MiscController] renameBookFolder: Invalid library item ${req.params.id}: not a book`)
      return res.status(500).send('Invalid library item: not a book')
    }
    var result = this.folderRenameManager.parseRenameFormat(req.libraryItem, req.query.strFormat || "", req.query.includeSampleTemplate || "")
    res.json(result)
  }
}
module.exports = new ToolsController()