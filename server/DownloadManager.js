const Path = require('path')
const fs = require('fs-extra')

const workerThreads = require('worker_threads')
const Logger = require('./Logger')
const Download = require('./objects/Download')
const { writeConcatFile, writeMetadataFile } = require('./utils/ffmpegHelpers')
const { getFileSize } = require('./utils/fileUtils')

class DownloadManager {
  constructor(db, MetadataPath, emitter) {
    this.db = db
    this.MetadataPath = MetadataPath
    this.emitter = emitter

    this.downloadDirPath = Path.join(this.MetadataPath, 'downloads')

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

  async prepareDownload(client, audiobook, options = {}) {
    var downloadId = (Math.trunc(Math.random() * 1000) + Date.now()).toString(36)
    var dlpath = Path.join(this.downloadDirPath, downloadId)
    Logger.info(`Start Download for ${audiobook.id} - DownloadId: ${downloadId} - ${dlpath}`)

    await fs.ensureDir(dlpath)

    var downloadType = options.type || 'singleAudio'
    delete options.type

    var filepath = null
    var filename = null
    var fileext = null
    var audiobookDirname = Path.basename(audiobook.path)

    if (downloadType === 'singleAudio') {
      var audioFileType = options.audioFileType || '.m4b'
      delete options.audioFileType
      if (audioFileType === 'same') {
        var firstTrack = audiobook.tracks[0]
        audioFileType = firstTrack.ext
      }
      filename = audiobookDirname + audioFileType
      fileext = audioFileType
      filepath = Path.join(dlpath, filename)
    }

    var downloadData = {
      id: downloadId,
      audiobookId: audiobook.id,
      type: downloadType,
      options: options,
      dirpath: dlpath,
      fullPath: filepath,
      filename,
      ext: fileext,
      userId: (client && client.user) ? client.user.id : null,
      socket: (client && client.socket) ? client.socket : null
    }
    var download = new Download()
    download.setData(downloadData)

    if (downloadData.socket) {
      downloadData.socket.emit('download_started', download.toJSON())
    }

    if (download.type === 'singleAudio') {
      this.processSingleAudioDownload(audiobook, download)
    }
  }

  async processSingleAudioDownload(audiobook, download) {

    // If changing audio file type then encoding is needed
    var requiresEncode = audiobook.tracks[0].ext !== download.ext || download.includeCover || download.includeMetadata

    var concatFilePath = Path.join(download.dirpath, 'files.txt')
    await writeConcatFile(audiobook.tracks, concatFilePath)

    const ffmpegInputs = [
      {
        input: concatFilePath,
        options: ['-safe 0', '-f concat']
      }
    ]

    const logLevel = process.env.NODE_ENV === 'production' ? 'error' : 'warning'
    var ffmpegOptions = [`-loglevel ${logLevel}`]

    if (requiresEncode) {
      ffmpegOptions = ffmpegOptions.concat([
        '-map 0:a',
        '-acodec aac',
        '-ac 2',
        '-b:a 64k',
        '-id3v2_version 3'
      ])
    } else {
      ffmpegOptions.push('-c copy')
    }

    if (download.includeMetadata) {
      var metadataFilePath = Path.join(download.dirpath, 'metadata.txt')
      await writeMetadataFile(audiobook, metadataFilePath)

      ffmpegInputs.push({
        input: metadataFilePath
      })

      ffmpegOptions.push('-map_metadata 1')
    }

    if (download.includeCover && audiobook.book.cover) {
      ffmpegInputs.push({
        input: audiobook.book.cover,
        options: ['-f image2pipe']
      })
      ffmpegOptions.push('-vf [2:v]crop=trunc(iw/2)*2:trunc(ih/2)*2')
      ffmpegOptions.push('-map 2:v')
    }

    var workerData = {
      inputs: ffmpegInputs,
      options: ffmpegOptions,
      output: download.fullPath,
    }

    var worker = new workerThreads.Worker('./server/utils/downloadWorker.js', { workerData })
    worker.on('message', (message) => {
      if (message != null && typeof message === 'object') {
        if (message.type === 'RESULT') {
          this.sendResult(download, message)
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

  async downloadExpired(download) {
    Logger.info(`[DownloadManager] Download ${download.id} expired`)

    if (download.socket) {
      download.socket.emit('download_expired', download.toJSON())
    }
    this.removeDownload(download)
  }

  async sendResult(download, result) {
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

    // Remove files.txt if it was used
    // if (download.type === 'singleAudio') {
    //   var concatFilePath = Path.join(download.dirpath, 'files.txt')
    //   try {
    //     await fs.remove(concatFilePath)
    //   } catch (error) {
    //     Logger.error('[DownloadManager] Failed to remove files.txt')
    //   }
    // }

    result.size = await getFileSize(download.fullPath)
    download.setComplete(result)
    if (download.socket) {
      download.socket.emit('download_ready', download.toJSON())
    }
    download.setExpirationTimer(this.downloadExpired.bind(this))

    this.downloads.push(download)
    Logger.info(`[DownloadManager] Download Ready ${download.id}`)
  }

  async removeDownload(download) {
    Logger.info('[DownloadManager] Removing download ' + download.id)

    var pendingDl = this.pendingDownloads.find(d => d.id === download.id)

    if (pendingDl) {
      this.pendingDownloads = this.pendingDownloads.filter(d => d.id !== download.id)
      Logger.warn(`[DownloadManager] Removing download in progress - stopping worker`)
      try {
        pendingDl.worker.postMessage('STOP')
      } catch (error) {
        Logger.error('[DownloadManager] Error posting stop message to worker', error)
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