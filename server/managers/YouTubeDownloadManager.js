const Path = require('path')
const fs = require('../libs/fsExtra')
const YTDlpWrap = require('yt-dlp-wrap').default
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')
const Watcher = require('../Watcher')

const { isValidYouTubeUrl, isPlaylistUrl, sanitizeTitleForFilename } = require('../utils/youtubeUtils')
const { downloadFile } = require('../utils/fileUtils')
const prober = require('../utils/prober')

const TaskManager = require('./TaskManager')
const CoverManager = require('./CoverManager')

const YouTubeDownload = require('../objects/YouTubeDownload')
const LibraryFile = require('../objects/files/LibraryFile')
const AudioFile = require('../objects/files/AudioFile')

class YouTubeDownloadManager {
  constructor() {
    /** @type {YouTubeDownload[]} */
    this.downloadQueue = []
    /** @type {YouTubeDownload} */
    this.currentDownload = null

    this.ytDlp = null
    this.initYtDlp()
  }

  /**
   * Initialize yt-dlp wrapper
   */
  async initYtDlp() {
    try {
      this.ytDlp = new YTDlpWrap()
      Logger.info('[YouTubeDownloadManager] yt-dlp initialized successfully')
    } catch (error) {
      Logger.error('[YouTubeDownloadManager] Failed to initialize yt-dlp:', error)
    }
  }

  /**
   * Get downloads in queue for a library
   * @param {string} libraryId
   * @returns {YouTubeDownload[]}
   */
  getDownloadsInQueue(libraryId = null) {
    if (!libraryId) return this.downloadQueue
    return this.downloadQueue.filter(d => d.libraryId === libraryId)
  }

  /**
   * Clear download queue
   * @param {string} libraryId - Optional library ID to clear only that library's downloads
   */
  clearDownloadQueue(libraryId = null) {
    if (!this.downloadQueue.length) return

    if (!libraryId) {
      Logger.info(`[YouTubeDownloadManager] Clearing all downloads in queue (${this.downloadQueue.length})`)
      this.downloadQueue = []
    } else {
      const itemDownloads = this.getDownloadsInQueue(libraryId)
      Logger.info(`[YouTubeDownloadManager] Clearing downloads in queue for library "${libraryId}" (${itemDownloads.length})`)
      this.downloadQueue = this.downloadQueue.filter(d => d.libraryId !== libraryId)
      SocketAuthority.emitter('youtube_download_queue_cleared', libraryId)
    }
  }

  /**
   * Download from YouTube URL
   * @param {Object} options
   * @param {string} options.url - YouTube URL
   * @param {string} options.libraryId - Library ID
   * @param {string} options.libraryFolderId - Library folder ID
   * @param {string} options.userId - User ID
   * @param {string} options.audioFormat - Audio format (default: mp3)
   * @param {string} options.audioQuality - Audio quality (default: best)
   */
  async downloadFromYouTube(options) {
    const { url, libraryId, libraryFolderId, userId, audioFormat = 'mp3', audioQuality = 'best' } = options

    // Validate URL
    if (!isValidYouTubeUrl(url)) {
      throw new Error('Invalid YouTube URL')
    }

    // Check if it's a playlist
    const isPlaylist = isPlaylistUrl(url)

    if (isPlaylist) {
      // Get playlist info first
      try {
        const playlistInfo = await this.getPlaylistInfo(url)
        Logger.info(`[YouTubeDownloadManager] Playlist detected: ${playlistInfo.title} (${playlistInfo.entries?.length || 0} videos)`)

        // Queue each video in the playlist
        for (const entry of playlistInfo.entries || []) {
          const videoUrl = `https://www.youtube.com/watch?v=${entry.id}`
          const download = new YouTubeDownload()
          download.setData({
            url: videoUrl,
            libraryId,
            libraryFolderId,
            userId,
            audioFormat,
            audioQuality,
            isPlaylist: true,
            playlistId: playlistInfo.id
          })

          await this.startDownload(download)
        }

        return {
          success: true,
          message: `Queued ${playlistInfo.entries?.length || 0} videos from playlist`,
          isPlaylist: true,
          count: playlistInfo.entries?.length || 0
        }
      } catch (error) {
        Logger.error('[YouTubeDownloadManager] Failed to get playlist info:', error)
        throw new Error(`Failed to process playlist: ${error.message}`)
      }
    } else {
      // Single video download
      const download = new YouTubeDownload()
      download.setData({
        url,
        libraryId,
        libraryFolderId,
        userId,
        audioFormat,
        audioQuality
      })

      await this.startDownload(download)

      return {
        success: true,
        message: 'Download started',
        isPlaylist: false,
        downloadId: download.id
      }
    }
  }

  /**
   * Get playlist info using yt-dlp
   * @param {string} url - Playlist URL
   * @returns {Promise<Object>}
   */
  async getPlaylistInfo(url) {
    try {
      const info = await this.ytDlp.getVideoInfo([url, '--flat-playlist'])
      return info
    } catch (error) {
      Logger.error('[YouTubeDownloadManager] Failed to get playlist info:', error)
      throw error
    }
  }

  /**
   * Start a download
   * @param {YouTubeDownload} youtubeDownload
   */
  async startDownload(youtubeDownload) {
    // Check if already downloading or in queue
    const existingDownload = this.downloadQueue.find(d => d.url === youtubeDownload.url && d.libraryId === youtubeDownload.libraryId)
    if (existingDownload || (this.currentDownload && this.currentDownload.url === youtubeDownload.url)) {
      Logger.warn(`[YouTubeDownloadManager] Video already in queue or downloading: ${youtubeDownload.url}`)
      return
    }

    // If currently downloading, add to queue
    if (this.currentDownload) {
      this.downloadQueue.push(youtubeDownload)
      SocketAuthority.emitter('youtube_download_queued', youtubeDownload.toJSONForClient())
      Logger.info(`[YouTubeDownloadManager] Download queued: ${youtubeDownload.url}`)
      return
    }

    // Start download immediately
    this.currentDownload = youtubeDownload
    SocketAuthority.emitter('youtube_download_started', youtubeDownload.toJSONForClient())

    // Create task
    const taskData = {
      libraryId: youtubeDownload.libraryId,
      libraryFolderId: youtubeDownload.libraryFolderId
    }
    const taskTitleString = {
      text: 'Downloading from YouTube',
      key: 'MessageDownloadingFromYouTube'
    }
    const taskDescriptionString = {
      text: `Downloading from YouTube: ${youtubeDownload.url}`,
      key: 'MessageTaskDownloadingFromYouTubeDescription',
      subs: [youtubeDownload.url]
    }
    const task = TaskManager.createAndAddTask('youtube-download', taskTitleString, taskDescriptionString, false, taskData)

    // Execute download
    let success = false
    try {
      success = await this.executeDownload(youtubeDownload, task)
    } catch (error) {
      Logger.error(`[YouTubeDownloadManager] Download failed:`, error)
      youtubeDownload.setError(error.message)
      success = false
    }

    // Finish task
    task.setFinished(success)
    TaskManager.taskFinished(task)

    // Emit completion event
    if (success) {
      SocketAuthority.emitter('youtube_download_completed', youtubeDownload.toJSONForClient())
    } else {
      SocketAuthority.emitter('youtube_download_failed', youtubeDownload.toJSONForClient())
    }

    // Start next download in queue
    this.currentDownload = null
    if (this.downloadQueue.length) {
      const nextDownload = this.downloadQueue.shift()
      await this.startDownload(nextDownload)
    }
  }

  /**
   * Execute the actual download
   * @param {YouTubeDownload} download
   * @param {Object} task
   * @returns {Promise<boolean>}
   */
  async executeDownload(download, task) {
    try {
      // Step 1: Get video metadata
      Logger.info(`[YouTubeDownloadManager] Getting metadata for: ${download.url}`)
      download.setStatus('downloading')
      task.setDescription(`Getting video information...`)

      const videoInfo = await this.ytDlp.getVideoInfo(download.url)
      download.setMetadata(videoInfo)

      Logger.info(`[YouTubeDownloadManager] Metadata retrieved: "${download.title}" by ${download.uploader}`)

      // Step 2: Get library folder
      const libraryFolder = await Database.libraryFolderModel.findByPk(download.libraryFolderId)
      if (!libraryFolder) {
        throw new Error('Library folder not found')
      }

      // Step 3: Set target paths
      download.setTargetPaths(libraryFolder.path)
      await fs.ensureDir(download.targetDirectory)

      Logger.info(`[YouTubeDownloadManager] Downloading to: ${download.targetPath}`)
      task.setDescription(`Downloading: ${download.title}`)

      // Step 4: Download audio using yt-dlp
      await this.downloadAudio(download)

      // Step 5: Download thumbnail as cover
      download.setStatus('processing')
      task.setDescription(`Processing: ${download.title}`)

      if (download.thumbnailUrl) {
        try {
          const coverFilename = 'cover.jpg'
          const coverPath = Path.join(download.targetDirectory, coverFilename)
          await downloadFile(download.thumbnailUrl, coverPath)
          download.coverPath = coverPath
          Logger.info(`[YouTubeDownloadManager] Downloaded cover image: ${coverPath}`)
        } catch (error) {
          Logger.warn(`[YouTubeDownloadManager] Failed to download thumbnail:`, error.message)
        }
      }

      // Step 6: Probe audio file
      const probeData = await prober.probe(download.audioFilePath)
      Logger.debug(`[YouTubeDownloadManager] Audio file probed:`, probeData)

      // Step 7: Create library item
      await this.createLibraryItem(download, libraryFolder, probeData)

      // Mark as completed
      download.setCompleted()
      task.setDescription(`Completed: ${download.title}`)

      Logger.info(`[YouTubeDownloadManager] Download completed successfully: ${download.title}`)
      return true
    } catch (error) {
      Logger.error(`[YouTubeDownloadManager] Download failed:`, error)
      download.setError(error.message)

      // Cleanup failed download
      try {
        if (download.targetDirectory && await fs.pathExists(download.targetDirectory)) {
          await fs.remove(download.targetDirectory)
        }
      } catch (cleanupError) {
        Logger.error('[YouTubeDownloadManager] Failed to cleanup:', cleanupError)
      }

      return false
    }
  }

  /**
   * Download audio using yt-dlp
   * @param {YouTubeDownload} download
   */
  async downloadAudio(download) {
    return new Promise((resolve, reject) => {
      const outputTemplate = Path.join(download.targetDirectory, '%(title)s.%(ext)s')

      const ytDlpArgs = [
        download.url,
        '--extract-audio',
        '--audio-format', download.audioFormat,
        '--audio-quality', download.audioQuality === 'best' ? '0' : download.audioQuality,
        '--add-metadata',
        '--embed-thumbnail',
        '--output', outputTemplate,
        '--no-playlist', // Ensure single video download even if URL has playlist param
        '--progress'
      ]

      const ytDlpProcess = this.ytDlp.exec(ytDlpArgs)

      ytDlpProcess.on('progress', (progress) => {
        // Parse progress from yt-dlp output
        if (progress.percent) {
          download.setProgress(parseFloat(progress.percent))
          SocketAuthority.emitter('youtube_download_progress', {
            id: download.id,
            progress: download.progress,
            title: download.title
          })
        }
      })

      ytDlpProcess.on('close', async (code) => {
        if (code === 0) {
          // Download successful, find the downloaded file
          try {
            const files = await fs.readdir(download.targetDirectory)
            const audioFile = files.find(f => f.endsWith(`.${download.audioFormat}`))

            if (audioFile) {
              download.audioFilePath = Path.join(download.targetDirectory, audioFile)

              // Rename file to match target filename if different
              if (audioFile !== download.targetFilename) {
                const newPath = Path.join(download.targetDirectory, download.targetFilename)
                await fs.rename(download.audioFilePath, newPath)
                download.audioFilePath = newPath
              }

              download.setProgress(100)
              Logger.info(`[YouTubeDownloadManager] Audio download completed: ${download.audioFilePath}`)
              resolve()
            } else {
              reject(new Error('Downloaded audio file not found'))
            }
          } catch (error) {
            reject(error)
          }
        } else {
          reject(new Error(`yt-dlp process exited with code ${code}`))
        }
      })

      ytDlpProcess.on('error', (error) => {
        reject(error)
      })
    })
  }

  /**
   * Create library item from download
   * @param {YouTubeDownload} download
   * @param {Object} libraryFolder
   * @param {Object} probeData
   */
  async createLibraryItem(download, libraryFolder, probeData) {
    try {
      // Ignore watcher while creating library item
      if (Watcher) {
        Watcher.addIgnoreDir(download.targetDirectory)
      }

      const library = await Database.libraryModel.findByPk(download.libraryId)
      if (!library) {
        throw new Error('Library not found')
      }

      // Create library item
      const libraryItemData = {
        path: download.targetDirectory,
        relPath: download.targetDirectory.replace(libraryFolder.path, '').slice(1),
        libraryId: download.libraryId,
        folderId: download.libraryFolderId,
        mediaType: library.mediaType || 'book', // Default to book for audiobooks
        media: {
          metadata: {
            title: download.title,
            author: download.uploader,
            description: download.description,
            publishedYear: download.uploadDate ? download.uploadDate.substring(0, 4) : null
          }
        }
      }

      // Add audio file
      const audioFileData = {
        metadata: {
          filename: download.targetFilename,
          ext: `.${download.audioFormat}`,
          path: download.audioFilePath,
          relPath: download.targetFilename,
          size: (await fs.stat(download.audioFilePath)).size,
          mtimeMs: Date.now(),
          ctimeMs: Date.now(),
          birthtimeMs: Date.now()
        },
        ...probeData
      }

      // Create the library item
      const libraryItem = await Database.libraryItemModel.create(libraryItemData)

      Logger.info(`[YouTubeDownloadManager] Library item created: ${libraryItem.id}`)

      // Emit library item added event
      SocketAuthority.emitter('item_added', {
        libraryItemId: libraryItem.id,
        libraryId: download.libraryId
      })

      // Remove from watcher ignore
      if (Watcher) {
        Watcher.removeIgnoreDir(download.targetDirectory)
      }

      return libraryItem
    } catch (error) {
      Logger.error('[YouTubeDownloadManager] Failed to create library item:', error)
      throw error
    }
  }

  /**
   * Cancel a download
   * @param {string} downloadId
   * @returns {boolean}
   */
  cancelDownload(downloadId) {
    // Check if it's the current download
    if (this.currentDownload && this.currentDownload.id === downloadId) {
      Logger.info(`[YouTubeDownloadManager] Canceling current download: ${this.currentDownload.title}`)
      // Note: yt-dlp process cancellation would need additional implementation
      this.currentDownload.setError('Download canceled by user')
      this.currentDownload = null
      return true
    }

    // Check if it's in the queue
    const queueIndex = this.downloadQueue.findIndex(d => d.id === downloadId)
    if (queueIndex >= 0) {
      const download = this.downloadQueue[queueIndex]
      Logger.info(`[YouTubeDownloadManager] Removing from queue: ${download.title}`)
      this.downloadQueue.splice(queueIndex, 1)
      SocketAuthority.emitter('youtube_download_removed', { id: downloadId })
      return true
    }

    return false
  }
}

module.exports = new YouTubeDownloadManager()
