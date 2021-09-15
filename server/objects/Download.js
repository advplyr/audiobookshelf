const DEFAULT_EXPIRATION = 1000 * 60 * 60 // 60 minutes
const DEFAULT_TIMEOUT = 1000 * 60 * 15 // 15 minutes
class Download {
  constructor(download) {
    this.id = null
    this.audiobookId = null
    this.type = null
    this.options = {}

    this.dirpath = null
    this.fullPath = null
    this.ext = null
    this.filename = null
    this.size = 0

    this.userId = null
    this.socket = null // Socket to notify when complete
    this.isReady = false
    this.isTimedOut = false

    this.startedAt = null
    this.finishedAt = null
    this.expiresAt = null

    this.expirationTimeMs = 0
    this.timeoutTimeMs = 0

    this.timeoutTimer = null
    this.expirationTimer = null

    if (download) {
      this.construct(download)
    }
  }

  get includeMetadata() {
    return !!this.options.includeMetadata
  }

  get includeCover() {
    return !!this.options.includeCover
  }

  get mimeType() {
    if (this.ext === '.mp3' || this.ext === '.m4b' || this.ext === '.m4a') {
      return 'audio/mpeg'
    } else if (this.ext === '.mp4') {
      return 'audio/mp4'
    } else if (this.ext === '.ogg') {
      return 'audio/ogg'
    } else if (this.ext === '.aac' || this.ext === '.m4p') {
      return 'audio/aac'
    }
    return 'audio/mpeg'
  }

  toJSON() {
    return {
      id: this.id,
      audiobookId: this.audiobookId,
      type: this.type,
      options: this.options,
      dirpath: this.dirpath,
      fullPath: this.fullPath,
      ext: this.ext,
      filename: this.filename,
      size: this.size,
      userId: this.userId,
      isReady: this.isReady,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      expirationSeconds: this.expirationSeconds
    }
  }

  construct(download) {
    this.id = download.id
    this.audiobookId = download.audiobookId
    this.type = download.type
    this.options = { ...download.options }

    this.dirpath = download.dirpath
    this.fullPath = download.fullPath
    this.ext = download.ext
    this.filename = download.filename
    this.size = download.size || 0

    this.userId = download.userId
    this.socket = download.socket || null
    this.isReady = !!download.isReady

    this.startedAt = download.startedAt
    this.finishedAt = download.finishedAt || null

    this.expirationTimeMs = download.expirationTimeMs || DEFAULT_EXPIRATION
    this.timeoutTimeMs = download.timeoutTimeMs || DEFAULT_TIMEOUT

    this.expiresAt = download.expiresAt || null
  }

  setData(downloadData) {
    downloadData.startedAt = Date.now()
    downloadData.isProcessing = true
    this.construct(downloadData)
  }

  setComplete(fileSize) {
    this.finishedAt = Date.now()
    this.size = fileSize
    this.isReady = true
    this.expiresAt = this.finishedAt + this.expirationTimeMs
  }

  setExpirationTimer(callback) {
    this.expirationTimer = setTimeout(() => {
      if (callback) {
        callback(this)
      }
    }, this.expirationTimeMs)
  }

  setTimeoutTimer(callback) {
    this.timeoutTimer = setTimeout(() => {
      if (callback) {
        this.isTimedOut = true
        callback(this)
      }
    }, this.timeoutTimeMs)
  }

  clearTimeoutTimer() {
    clearTimeout(this.timeoutTimer)
  }

  clearExpirationTimer() {
    clearTimeout(this.expirationTimer)
  }
}
module.exports = Download