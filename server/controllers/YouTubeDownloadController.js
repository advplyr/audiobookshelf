const { Request, Response } = require('express')
const Logger = require('../Logger')
const Database = require('../Database')

const { isValidYouTubeUrl } = require('../utils/youtubeUtils')
const YouTubeDownloadManager = require('../managers/YouTubeDownloadManager')

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 */

class YouTubeDownloadController {
  /**
   * POST /api/youtube/download
   * Start a YouTube download
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async downloadFromYouTube(req, res) {
    // Admin-only access
    if (!req.user.isAdminOrUp) {
      Logger.error(`[YouTubeDownloadController] Non-admin user "${req.user.username}" attempted to download from YouTube`)
      return res.sendStatus(403)
    }

    const { url, libraryId, folderId, options = {} } = req.body

    // Validate required fields
    if (!url) {
      return res.status(400).send('YouTube URL is required')
    }

    if (!libraryId) {
      return res.status(400).send('Library ID is required')
    }

    if (!folderId) {
      return res.status(400).send('Folder ID is required')
    }

    // Validate YouTube URL
    if (!isValidYouTubeUrl(url)) {
      Logger.error(`[YouTubeDownloadController] Invalid YouTube URL: ${url}`)
      return res.status(400).send('Invalid YouTube URL')
    }

    // Verify library exists
    const library = await Database.libraryModel.findByPk(libraryId)
    if (!library) {
      Logger.error(`[YouTubeDownloadController] Library not found: ${libraryId}`)
      return res.status(404).send('Library not found')
    }

    // Verify folder exists
    const folder = await Database.libraryFolderModel.findByPk(folderId)
    if (!folder) {
      Logger.error(`[YouTubeDownloadController] Folder not found: ${folderId}`)
      return res.status(404).send('Folder not found')
    }

    // Verify folder belongs to library
    if (folder.libraryId !== libraryId) {
      Logger.error(`[YouTubeDownloadController] Folder ${folderId} does not belong to library ${libraryId}`)
      return res.status(400).send('Folder does not belong to the specified library')
    }

    try {
      const downloadOptions = {
        url,
        libraryId,
        libraryFolderId: folderId,
        userId: req.user.id,
        audioFormat: 'mp3', // Fixed to MP3 as per requirements
        audioQuality: options.audioQuality || 'best'
      }

      const result = await YouTubeDownloadManager.downloadFromYouTube(downloadOptions)

      Logger.info(`[YouTubeDownloadController] Download started by ${req.user.username}: ${url}`)

      res.json({
        success: true,
        ...result
      })
    } catch (error) {
      Logger.error(`[YouTubeDownloadController] Download failed:`, error)
      res.status(500).send(error.message || 'Failed to start download')
    }
  }

  /**
   * GET /api/youtube/queue
   * Get current download queue
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getDownloadQueue(req, res) {
    // Admin-only access
    if (!req.user.isAdminOrUp) {
      Logger.error(`[YouTubeDownloadController] Non-admin user "${req.user.username}" attempted to view download queue`)
      return res.sendStatus(403)
    }

    const { libraryId } = req.query

    const queue = YouTubeDownloadManager.getDownloadsInQueue(libraryId)
    const current = YouTubeDownloadManager.currentDownload

    res.json({
      queue: queue.map(d => d.toJSONForClient()),
      current: current ? current.toJSONForClient() : null
    })
  }

  /**
   * DELETE /api/youtube/download/:downloadId
   * Cancel a download
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async cancelDownload(req, res) {
    // Admin-only access
    if (!req.user.isAdminOrUp) {
      Logger.error(`[YouTubeDownloadController] Non-admin user "${req.user.username}" attempted to cancel download`)
      return res.sendStatus(403)
    }

    const { downloadId } = req.params

    if (!downloadId) {
      return res.status(400).send('Download ID is required')
    }

    const canceled = YouTubeDownloadManager.cancelDownload(downloadId)

    if (canceled) {
      Logger.info(`[YouTubeDownloadController] Download canceled by ${req.user.username}: ${downloadId}`)
      res.json({ success: true, message: 'Download canceled' })
    } else {
      res.status(404).send('Download not found')
    }
  }

  /**
   * Middleware to check user permissions
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   * @param {Function} next
   */
  middleware(req, res, next) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[YouTubeDownloadController] Non-admin user "${req.user.username}" attempted to access YouTube download feature`)
      return res.sendStatus(403)
    }
    next()
  }
}

module.exports = new YouTubeDownloadController()
