const Path = require('path')
const fs = require('../libs/fsExtra')
const archiver = require('../libs/archiver')

const workerThreads = require('worker_threads')
const Logger = require('../Logger')
const Download = require('../objects/Download')
const filePerms = require('../utils/filePerms')
const { getId } = require('../utils/index')
const { writeConcatFile, writeMetadataFile } = require('../utils/ffmpegHelpers')
const { getFileSize } = require('../utils/fileUtils')
const TAG = 'DownloadManager'

class DownloadManager {
  constructor(db) {
    this.db = db

    this.downloadDirPath = Path.join(global.MetadataPath, 'downloads')

    this.pendingDownloads = []
    this.downloads = []
  }

  getDownload(downloadId) {
    return this.downloads.find(d => d.id === downloadId)
  }

  async removeOrphanDownloads() {
    try {
      var dirs = await fs.readdir(this.downloadDirPath)
      if (!dirs || !dirs.length) return true

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

  downloadSocketRequest(socket, payload) {
    var client = socket.sheepClient
    var audiobook = this.db.audiobooks.find(a => a.id === payload.audiobookId)
    var options = {
      ...payload
    }
    delete options.audiobookId
    this.prepareDownload(client, audiobook, options)
  }

  removeSocketRequest(socket, downloadId) {
    var download = this.downloads.find(d => d.id === downloadId)
    if (!download) {
      Logger.error('Remove download request download not found ' + downloadId)
      return
    }
    this.removeDownload(download)
  }

  async prepareDownload(client, audiobook, options = {}) {
    var downloadId = getId('dl')
    var dlpath = Path.join(this.downloadDirPath, downloadId)
    Logger.info(`Start Download for ${audiobook.id} - DownloadId: ${downloadId} - ${dlpath}`)

    await fs.ensureDir(dlpath)

    var downloadType = options.type || 'singleAudio'
    delete options.type


    var fileext = null
    var audiobookDirname = Path.basename(audiobook.path)

    if (downloadType === 'singleAudio') {
      var audioFileType = options.audioFileType || '.m4b'
      delete options.audioFileType
      if (audioFileType === 'same') {
        var firstTrack = audiobook.tracks[0]
        audioFileType = firstTrack.ext
      }
      fileext = audioFileType
    } else if (downloadType === 'zip') {
      fileext = '.zip'
    }
    var filename = audiobookDirname + fileext
    var downloadData = {
      id: downloadId,
      audiobookId: audiobook.id,
      type: downloadType,
      options: options,
      dirpath: dlpath,
      fullPath: Path.join(dlpath, filename),
      filename,
      ext: fileext,
      userId: (client && client.user) ? client.user.id : null,
      socket: (client && client.socket) ? client.socket : null
    }
    var download = new Download()
    download.setData(downloadData)
    download.setTimeoutTimer(this.downloadTimedOut.bind(this))

    if (downloadData.socket) {
      downloadData.socket.emit('download_started', download.toJSON())
    }

    if (download.type === 'singleAudio') {
      this.processSingleAudioDownload(audiobook, download)
    } else if (download.type === 'zip') {
      this.processZipDownload(audiobook, download)
    }
  }

  async processZipDownload(audiobook, download) {
    this.pendingDownloads.push({
      id: download.id,
      download
    })
    Logger.info(`[DownloadManager] Processing Zip download ${download.fullPath}`)
    var success = await this.zipAudiobookDir(audiobook.fullPath, download.fullPath).then(() => {
      return true
    }).catch((error) => {
      Logger.error('[DownloadManager] Process Zip Failed', error)
      return false
    })
    this.sendResult(download, { success })
  }

  zipAudiobookDir(audiobookPath, downloadPath) {
    return new Promise((resolve, reject) => {
      // create a file to stream archive data to
      const output = fs.createWriteStream(downloadPath)
      const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
      })

      // listen for all archive data to be written
      // 'close' event is fired only when a file descriptor is involved
      output.on('close', () => {
        Logger.info(archive.pointer() + ' total bytes')
        Logger.debug('archiver has been finalized and the output file descriptor has closed.')
        resolve()
      })

      // This event is fired when the data source is drained no matter what was the data source.
      // It is not part of this library but rather from the NodeJS Stream API.
      // @see: https://nodejs.org/api/stream.html#stream_event_end
      output.on('end', () => {
        Logger.debug('Data has been drained')
      })

      // good practice to catch warnings (ie stat failures and other non-blocking errors)
      archive.on('warning', function (err) {
        if (err.code === 'ENOENT') {
          // log warning
          Logger.warn(`[DownloadManager] Archiver warning: ${err.message}`)
        } else {
          // throw error
          Logger.error(`[DownloadManager] Archiver error: ${err.message}`)
          // throw err
          reject(err)
        }
      })
      archive.on('error', function (err) {
        Logger.error(`[DownloadManager] Archiver error: ${err.message}`)
        reject(err)
      })

      // pipe archive data to the file
      archive.pipe(output)

      archive.directory(audiobookPath, false)

      archive.finalize()

    })
  }

  async processSingleAudioDownload(audiobook, download) {

    // If changing audio file type then encoding is needed
    var audioRequiresEncode = audiobook.tracks[0].ext !== download.ext
    var shouldIncludeCover = download.includeCover && audiobook.book.cover
    var firstTrackIsM4b = audiobook.tracks[0].ext.toLowerCase() === '.m4b'
    var isOneTrack = audiobook.tracks.length === 1

    const ffmpegInputs = []

    if (!isOneTrack) {
      var concatFilePath = Path.join(download.dirpath, 'files.txt')
      await writeConcatFile(audiobook.tracks, concatFilePath)
      ffmpegInputs.push({
        input: concatFilePath,
        options: ['-safe 0', '-f concat']
      })
    } else {
      ffmpegInputs.push({
        input: audiobook.tracks[0].fullPath,
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
        '-id3v2_version 3'
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
      Logger.info('Concat m4b\'s use -f mp4')
      ffmpegOutputOptions.push('-f mp4')
    }

    if (download.includeMetadata) {
      var metadataFilePath = Path.join(download.dirpath, 'metadata.txt')
      await writeMetadataFile(audiobook, metadataFilePath)

      ffmpegInputs.push({
        input: metadataFilePath
      })

      ffmpegOptions.push('-map_metadata 1')
    }

    if (shouldIncludeCover) {
      var _cover = audiobook.book.coverFullPath.replace(/\\/g, '/')

      ffmpegInputs.push({
        input: _cover,
        options: ['-f image2pipe']
      })
      ffmpegOptions.push('-vf [2:v]crop=trunc(iw/2)*2:trunc(ih/2)*2')
      ffmpegOptions.push('-map 2:v')
    }

    var workerData = {
      inputs: ffmpegInputs,
      options: ffmpegOptions,
      outputOptions: ffmpegOutputOptions,
      output: download.fullPath,
    }

    var worker = null
    try {
      var workerPath = Path.join(global.appRoot, 'server/utils/downloadWorker.js')
      worker = new workerThreads.Worker(workerPath, { workerData })
    } catch (error) {
      Logger.error(`[${TAG}] Start worker thread failed`, error)
      if (download.socket) {
        var downloadJson = download.toJSON()
        download.socket.emit('download_failed', downloadJson)
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

  async downloadTimedOut(download) {
    Logger.info(`[DownloadManager] Download ${download.id} timed out (${download.timeoutTimeMs}ms)`)

    if (download.socket) {
      var downloadJson = download.toJSON()
      downloadJson.isTimedOut = true
      download.socket.emit('download_failed', downloadJson)
    }
    this.removeDownload(download)
  }

  async downloadExpired(download) {
    Logger.info(`[DownloadManager] Download ${download.id} expired`)

    if (download.socket) {
      download.socket.emit('download_expired', download.toJSON())
    }
    this.removeDownload(download)
  }

  async sendResult(download, result) {
    download.clearTimeoutTimer()

    // Remove pending download
    this.pendingDownloads = this.pendingDownloads.filter(d => d.id !== download.id)

    if (result.isKilled) {
      if (download.socket) {
        download.socket.emit('download_killed', download.toJSON())
      }
      return
    }

    if (!result.success) {
      if (download.socket) {
        download.socket.emit('download_failed', download.toJSON())
      }
      this.removeDownload(download)
      return
    }

    // Set file permissions and ownership
    await filePerms.setDefault(download.fullPath)

    var filesize = await getFileSize(download.fullPath)
    download.setComplete(filesize)
    if (download.socket) {
      download.socket.emit('download_ready', download.toJSON())
    }
    download.setExpirationTimer(this.downloadExpired.bind(this))

    this.downloads.push(download)
    Logger.info(`[DownloadManager] Download Ready ${download.id}`)
  }

  async removeDownload(download) {
    Logger.info('[DownloadManager] Removing download ' + download.id)

    download.clearTimeoutTimer()
    download.clearExpirationTimer()

    var pendingDl = this.pendingDownloads.find(d => d.id === download.id)

    if (pendingDl) {
      this.pendingDownloads = this.pendingDownloads.filter(d => d.id !== download.id)
      Logger.warn(`[DownloadManager] Removing download in progress - stopping worker`)
      if (pendingDl.worker) {
        try {
          pendingDl.worker.postMessage('STOP')
        } catch (error) {
          Logger.error('[DownloadManager] Error posting stop message to worker', error)
        }
      }
    }

    await fs.remove(download.dirpath).then(() => {
      Logger.info('[DownloadManager] Deleted download', download.dirpath)
    }).catch((err) => {
      Logger.error('[DownloadManager] Failed to delete download', err)
    })
    this.downloads = this.downloads.filter(d => d.id !== download.id)
  }
}
module.exports = DownloadManager