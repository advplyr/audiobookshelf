
const Path = require('path')
const fs = require('fs-extra')

const workerThreads = require('worker_threads')
const Logger = require('../Logger')
const Download = require('../objects/Download')
const filePerms = require('../utils/filePerms')
const { getId } = require('../utils/index')
const { writeConcatFile, writeMetadataFile } = require('../utils/ffmpegHelpers')
const { getFileSize } = require('../utils/fileUtils')

class AbMergeManager {
  constructor(db, clientEmitter) {
    this.db = db
    this.clientEmitter = clientEmitter

    this.downloadDirPath = Path.join(global.MetadataPath, 'downloads')

    this.pendingDownloads = []
    this.downloads = []
  }

  getDownload(downloadId) {
    return this.downloads.find(d => d.id === downloadId)
  }

  removeDownloadById(downloadId) {
    var download = this.getDownload(downloadId)
    if (download) {
      this.removeDownload(download)
    }
  }

  async removeOrphanDownloads() {
    try {
      var dirs = await fs.readdir(this.downloadDirPath)
      if (!dirs || !dirs.length) return true

      dirs = dirs.filter(d => d.startsWith('abmerge'))

      await Promise.all(dirs.map(async (dirname) => {
        var fullPath = Path.join(this.downloadDirPath, dirname)
        Logger.info(`Removing Orphan Download ${dirname}`)
        return fs.remove(fullPath)
      }))
      return true
    } catch (error) {
      return false
    }
  }

  async startAudiobookMerge(user, libraryItem) {
    var downloadId = getId('abmerge')
    var dlpath = Path.join(this.downloadDirPath, downloadId)
    Logger.info(`Start audiobook merge for ${libraryItem.id} - DownloadId: ${downloadId} - ${dlpath}`)

    var audiobookDirname = Path.basename(libraryItem.path)
    var filename = audiobookDirname + '.m4b'
    var downloadData = {
      id: downloadId,
      libraryItemId: libraryItem.id,
      type: 'abmerge',
      dirpath: dlpath,
      path: Path.join(dlpath, filename),
      filename,
      ext: '.m4b',
      userId: user.id
    }
    var download = new Download()
    download.setData(downloadData)
    download.setTimeoutTimer(this.downloadTimedOut.bind(this))


    try {
      await fs.mkdir(download.dirpath)
    } catch (error) {
      Logger.error(`[AbMergeManager] Failed to make directory ${download.dirpath}`)
      var downloadJson = download.toJSON()
      this.clientEmitter(user.id, 'abmerge_failed', downloadJson)
      return
    }

    this.clientEmitter(user.id, 'abmerge_started', download.toJSON())
    this.runAudiobookMerge(libraryItem, download)
  }

  async runAudiobookMerge(libraryItem, download) {

    // If changing audio file type then encoding is needed
    var audioTracks = libraryItem.media.tracks
    var audioRequiresEncode = audioTracks[0].metadata.ext !== download.ext
    var shouldIncludeCover = libraryItem.media.coverPath
    var firstTrackIsM4b = audioTracks[0].metadata.ext.toLowerCase() === '.m4b'
    var isOneTrack = audioTracks.length === 1

    const ffmpegInputs = []

    if (!isOneTrack) {
      var concatFilePath = Path.join(download.dirpath, 'files.txt')
      console.log('Write files.txt', concatFilePath)
      await writeConcatFile(audioTracks, concatFilePath)
      ffmpegInputs.push({
        input: concatFilePath,
        options: ['-safe 0', '-f concat']
      })
    } else {
      ffmpegInputs.push({
        input: audioTracks[0].metadata.path,
        options: firstTrackIsM4b ? ['-f mp4'] : []
      })
    }

    const logLevel = process.env.NODE_ENV === 'production' ? 'error' : 'warning'
    var ffmpegOptions = [`-loglevel ${logLevel}`]
    var ffmpegOutputOptions = []

    if (audioRequiresEncode) {
      ffmpegOptions = ffmpegOptions.concat([
        '-map 0:a',
        '-acodec aac',
        '-ac 2',
        '-b:a 64k',
        '-movflags use_metadata_tags'
      ])
    } else {
      ffmpegOptions.push('-max_muxing_queue_size 1000')

      if (isOneTrack && firstTrackIsM4b && !shouldIncludeCover) {
        ffmpegOptions.push('-c copy')
      } else {
        ffmpegOptions.push('-c:a copy')
      }
    }
    if (download.ext === '.m4b') {
      ffmpegOutputOptions.push('-f mp4')
    }

    // Create ffmetadata file
    var metadataFilePath = Path.join(download.dirpath, 'metadata.txt')
    await writeMetadataFile(libraryItem, metadataFilePath)
    ffmpegInputs.push({
      input: metadataFilePath
    })
    ffmpegOptions.push('-map_metadata 1')

    // Embed cover art
    if (shouldIncludeCover) {
      var coverPath = libraryItem.media.coverPath.replace(/\\/g, '/')
      ffmpegInputs.push({
        input: coverPath,
        options: ['-f image2pipe']
      })
      ffmpegOptions.push('-vf [2:v]crop=trunc(iw/2)*2:trunc(ih/2)*2')
      ffmpegOptions.push('-map 2:v')
    }

    var workerData = {
      inputs: ffmpegInputs,
      options: ffmpegOptions,
      outputOptions: ffmpegOutputOptions,
      output: download.path,
    }

    var worker = null
    try {
      var workerPath = Path.join(global.appRoot, 'server/utils/downloadWorker.js')
      worker = new workerThreads.Worker(workerPath, { workerData })
    } catch (error) {
      Logger.error(`[AbMergeManager] Start worker thread failed`, error)
      if (download.userId) {
        var downloadJson = download.toJSON()
        this.clientEmitter(download.userId, 'abmerge_failed', downloadJson)
      }
      this.removeDownload(download)
      return
    }

    worker.on('message', (message) => {
      if (message != null && typeof message === 'object') {
        if (message.type === 'RESULT') {
          if (!download.isTimedOut) {
            this.sendResult(download, message)
          }
        } else if (message.type === 'FFMPEG') {
          if (Logger[message.level]) {
            Logger[message.level](message.log)
          }
        }
      } else {
        Logger.error('Invalid worker message', message)
      }
    })
    this.pendingDownloads.push({
      id: download.id,
      download,
      worker
    })
  }

  async sendResult(download, result) {
    download.clearTimeoutTimer()

    // Remove pending download
    this.pendingDownloads = this.pendingDownloads.filter(d => d.id !== download.id)

    if (result.isKilled) {
      if (download.userId) {
        this.clientEmitter(download.userId, 'abmerge_killed', download.toJSON())
      }
      return
    }

    if (!result.success) {
      if (download.userId) {
        this.clientEmitter(download.userId, 'abmerge_failed', download.toJSON())
      }
      this.removeDownload(download)
      return
    }

    // Set file permissions and ownership
    await filePerms.setDefault(download.path)

    var filesize = await getFileSize(download.path)
    download.setComplete(filesize)
    if (download.userId) {
      this.clientEmitter(download.userId, 'abmerge_ready', download.toJSON())
    }
    download.setExpirationTimer(this.downloadExpired.bind(this))

    this.downloads.push(download)
    Logger.info(`[AbMergeManager] Download Ready ${download.id}`)
  }

  async downloadExpired(download) {
    Logger.info(`[AbMergeManager] Download ${download.id} expired`)

    if (download.userId) {
      this.clientEmitter(download.userId, 'abmerge_expired', download.toJSON())
    }
    this.removeDownload(download)
  }

  async downloadTimedOut(download) {
    Logger.info(`[AbMergeManager] Download ${download.id} timed out (${download.timeoutTimeMs}ms)`)

    if (download.userId) {
      var downloadJson = download.toJSON()
      downloadJson.isTimedOut = true
      this.clientEmitter(download.userId, 'abmerge_failed', downloadJson)
    }
    this.removeDownload(download)
  }

  async removeDownload(download) {
    Logger.info('[AbMergeManager] Removing download ' + download.id)

    download.clearTimeoutTimer()
    download.clearExpirationTimer()

    var pendingDl = this.pendingDownloads.find(d => d.id === download.id)

    if (pendingDl) {
      this.pendingDownloads = this.pendingDownloads.filter(d => d.id !== download.id)
      Logger.warn(`[AbMergeManager] Removing download in progress - stopping worker`)
      if (pendingDl.worker) {
        try {
          pendingDl.worker.postMessage('STOP')
        } catch (error) {
          Logger.error('[AbMergeManager] Error posting stop message to worker', error)
        }
      }
    }

    await fs.remove(download.dirpath).then(() => {
      Logger.info('[AbMergeManager] Deleted download', download.dirpath)
    }).catch((err) => {
      Logger.error('[AbMergeManager] Failed to delete download', err)
    })
    this.downloads = this.downloads.filter(d => d.id !== download.id)
  }
}
module.exports = AbMergeManager