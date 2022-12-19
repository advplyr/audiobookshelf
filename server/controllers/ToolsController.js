const Logger = require('../Logger')

class ToolsController {
  constructor() { }


  // POST: api/tools/item/:id/encode-m4b
  async encodeM4b(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error('[MiscController] encodeM4b: Non-admin user attempting to make m4b', req.user)
      return res.sendStatus(403)
    }

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
    if (!req.user.isAdminOrUp) {
      Logger.error('[MiscController] cancelM4bEncode: Non-admin user attempting to cancel m4b encode', req.user)
      return res.sendStatus(403)
    }

    const workerTask = this.abMergeManager.getPendingTaskByLibraryItemId(req.params.id)
    if (!workerTask) return res.sendStatus(404)

    this.abMergeManager.cancelEncode(workerTask.task)

    res.sendStatus(200)
  }


  // POST: api/tools/item/:id/embed-metadata
  async embedAudioFileMetadata(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[LibraryItemController] Non-root user attempted to update audio metadata`, req.user)
      return res.sendStatus(403)
    }

    if (req.libraryItem.isMissing || !req.libraryItem.hasAudioFiles || !req.libraryItem.isBook) {
      Logger.error(`[LibraryItemController] Invalid library item`)
      return res.sendStatus(500)
    }

    const useTone = req.query.tone === '1'
    const forceEmbedChapters = req.query.forceEmbedChapters === '1'
    this.audioMetadataManager.updateMetadataForItem(req.user, req.libraryItem, useTone, forceEmbedChapters)
    res.sendStatus(200)
  }

  itemMiddleware(req, res, next) {
    var item = this.db.libraryItems.find(li => li.id === req.params.id)
    if (!item || !item.media) return res.sendStatus(404)

    // Check user can access this library item
    if (!req.user.checkCanAccessLibraryItem(item)) {
      return res.sendStatus(403)
    }

    req.libraryItem = item
    next()
  }
}
module.exports = new ToolsController()