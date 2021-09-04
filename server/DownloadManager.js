const Path = require('path')
const fs = require('fs-extra')

const workerThreads = require('worker_threads')
const Logger = require('./Logger')
const Download = require('./objects/Download')
const { writeConcatFile } = require('./utils/ffmpegHelpers')
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

  getBestFileType(tracks) {
    if (!tracks || !tracks.length) {
      return null
    }
    var firstTrack = tracks[0]
    return firstTrack.ext.substr(1)
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
      var audioFileType = options.audioFileType || this.getBestFileType(audiobook.tracks)
      delete options.audioFileType
      filename = audiobookDirname + '.' + audioFileType
      fileext = '.' + audioFileType
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
    // var ffmpeg = Ffmpeg()
    var concatFilePath = Path.join(download.dirpath, 'files.txt')
    await writeConcatFile(audiobook.tracks, concatFilePath)

    var workerData = {
      input: concatFilePath,
      inputFormat: 'concat',
      inputOption: '-safe 0',
      options: [
        '-loglevel warning',
        '-map 0:a',
        '-c:a copy'
      ],
      output: download.fullPath
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
    if (download.type === 'singleAudio') {
      var concatFilePath = Path.join(download.dirpath, 'files.txt')
      try {
        await fs.remove(concatFilePath)
      } catch (error) {
        Logger.error('[DownloadManager] Failed to remove files.txt')
      }
    }

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