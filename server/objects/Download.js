const DEFAULT_EXPIRATION = 1000 * 60 * 60 // 60 minutes
const DEFAULT_TIMEOUT = 1000 * 60 * 20 // 20 minutes
class Download {
  constructor(download) {
    this.id = null
    this.libraryItemId = null
    this.type = null

    this.dirpath = null
    this.path = null
    this.ext = null
    this.filename = null
    this.size = 0

    this.userId = null
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
      libraryItemId: this.libraryItemId,
      type: this.type,
      dirpath: this.dirpath,
      path: this.path,
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
    this.libraryItemId = download.libraryItemId
    this.type = download.type

    this.dirpath = download.dirpath
    this.path = download.path
    this.ext = download.ext
    this.filename = download.filename
    this.size = download.size || 0

    this.userId = download.userId
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