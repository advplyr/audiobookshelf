const { v4: uuidv4 } = require('uuid')
const Path = require('path')
const { sanitizeFilename, filePathToPOSIX } = require('../utils/fileUtils')

class YouTubeDownload {
  constructor() {
    this.id = null
    this.url = null
    this.libraryId = null
    this.libraryFolderId = null
    this.userId = null

    // Video metadata from yt-dlp
    this.videoId = null
    this.title = null
    this.uploader = null
    this.uploaderUrl = null
    this.description = null
    this.duration = null
    this.thumbnailUrl = null
    this.uploadDate = null

    // Download state
    this.status = 'pending' // pending, downloading, processing, completed, failed
    this.progress = 0 // 0-100
    this.error = null

    // File paths
    this.targetDirectory = null
    this.targetFilename = null
    this.targetPath = null
    this.audioFilePath = null
    this.coverPath = null

    // Timestamps
    this.createdAt = null
    this.startedAt = null
    this.finishedAt = null

    // Options
    this.audioFormat = 'mp3'
    this.audioQuality = 'best'

    // Playlist support
    this.isPlaylist = false
    this.playlistId = null
    this.playlistTitle = null
    this.playlistIndex = null
    this.playlistTotal = null
  }

  toJSONForClient() {
    return {
      id: this.id,
      url: this.url,
      libraryId: this.libraryId,
      libraryFolderId: this.libraryFolderId,
      userId: this.userId,
      videoId: this.videoId,
      title: this.title,
      uploader: this.uploader,
      uploaderUrl: this.uploaderUrl,
      description: this.description,
      duration: this.duration,
      thumbnailUrl: this.thumbnailUrl,
      uploadDate: this.uploadDate,
      status: this.status,
      progress: this.progress,
      error: this.error,
      targetPath: this.targetPath,
      audioFilePath: this.audioFilePath,
      coverPath: this.coverPath,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      audioFormat: this.audioFormat,
      audioQuality: this.audioQuality,
      isPlaylist: this.isPlaylist,
      playlistId: this.playlistId,
      playlistTitle: this.playlistTitle,
      playlistIndex: this.playlistIndex,
      playlistTotal: this.playlistTotal
    }
  }

  /**
   * Set initial download data
   * @param {Object} data
   */
  setData(data) {
    this.id = uuidv4()
    this.url = data.url
    this.libraryId = data.libraryId
    this.libraryFolderId = data.libraryFolderId
    this.userId = data.userId
    this.audioFormat = data.audioFormat || 'mp3'
    this.audioQuality = data.audioQuality || 'best'
    this.isPlaylist = data.isPlaylist || false
    this.playlistId = data.playlistId || null
    this.createdAt = Date.now()
    this.status = 'pending'
  }

  /**
   * Set metadata from yt-dlp info
   * @param {Object} info - yt-dlp video info
   */
  setMetadata(info) {
    this.videoId = info.id || null
    this.title = info.title || 'Unknown'
    this.uploader = info.uploader || info.channel || 'Unknown'
    this.uploaderUrl = info.uploader_url || info.channel_url || null
    this.description = info.description || null
    this.duration = info.duration || null
    this.thumbnailUrl = info.thumbnail || null
    this.uploadDate = info.upload_date || null

    if (info.playlist_title) {
      this.playlistTitle = info.playlist_title
      this.playlistIndex = info.playlist_index || null
      this.playlistTotal = info.playlist_count || null
    }
  }

  /**
   * Set target paths for download
   * @param {string} libraryFolderPath
   */
  setTargetPaths(libraryFolderPath) {
    // Create directory structure: <Library Folder>/<Uploader>/<Video Title>/
    const sanitizedUploader = sanitizeFilename(this.uploader || 'Unknown')
    const sanitizedTitle = sanitizeFilename(this.title || 'Unknown')

    this.targetDirectory = filePathToPOSIX(Path.join(libraryFolderPath, sanitizedUploader, sanitizedTitle))
    this.targetFilename = `${sanitizedTitle}.${this.audioFormat}`
    this.targetPath = filePathToPOSIX(Path.join(this.targetDirectory, this.targetFilename))
    this.audioFilePath = this.targetPath
  }

  /**
   * Update download progress
   * @param {number} progress - 0-100
   */
  setProgress(progress) {
    this.progress = Math.min(100, Math.max(0, progress))
  }

  /**
   * Set download status
   * @param {string} status
   */
  setStatus(status) {
    this.status = status

    if (status === 'downloading' && !this.startedAt) {
      this.startedAt = Date.now()
    }

    if ((status === 'completed' || status === 'failed') && !this.finishedAt) {
      this.finishedAt = Date.now()
    }
  }

  /**
   * Set error message
   * @param {string} error
   */
  setError(error) {
    this.error = error
    this.status = 'failed'
    this.finishedAt = Date.now()
  }

  /**
   * Mark download as completed
   */
  setCompleted() {
    this.status = 'completed'
    this.progress = 100
    this.finishedAt = Date.now()
  }

  get isFinished() {
    return this.status === 'completed' || this.status === 'failed'
  }

  get isPending() {
    return this.status === 'pending'
  }

  get isActive() {
    return this.status === 'downloading' || this.status === 'processing'
  }
}

module.exports = YouTubeDownload
