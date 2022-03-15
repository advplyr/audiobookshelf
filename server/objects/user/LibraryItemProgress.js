const Logger = require('../../Logger')

class LibraryItemProgress {
  constructor(progress) {
    this.id = null // Same as library item id
    this.libararyItemId = null

    this.totalDuration = null // seconds
    this.progress = null // 0 to 1
    this.currentTime = null // seconds
    this.isRead = false

    this.lastUpdate = null
    this.startedAt = null
    this.finishedAt = null

    if (progress) {
      this.construct(progress)
    }
  }

  toJSON() {
    return {
      id: this.id,
      libararyItemId: this.libararyItemId,
      totalDuration: this.totalDuration,
      progress: this.progress,
      currentTime: this.currentTime,
      isRead: this.isRead,
      lastUpdate: this.lastUpdate,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt
    }
  }

  construct(progress) {
    this.id = progress.id
    this.libararyItemId = progress.libararyItemId
    this.totalDuration = progress.totalDuration
    this.progress = progress.progress
    this.currentTime = progress.currentTime
    this.isRead = !!progress.isRead
    this.lastUpdate = progress.lastUpdate
    this.startedAt = progress.startedAt
    this.finishedAt = progress.finishedAt || null
  }

  updateProgressFromStream(stream) {
    this.audiobookId = stream.libraryItemId
    this.totalDuration = stream.totalDuration
    this.progress = stream.clientProgress
    this.currentTime = stream.clientCurrentTime
    this.lastUpdate = Date.now()

    if (!this.startedAt) {
      this.startedAt = Date.now()
    }

    // If has < 10 seconds remaining mark as read
    var timeRemaining = this.totalDuration - this.currentTime
    if (timeRemaining < 10) {
      this.isRead = true
      this.progress = 1
      this.finishedAt = Date.now()
    } else {
      this.isRead = false
      this.finishedAt = null
    }
  }

  update(payload) {
    var hasUpdates = false
    for (const key in payload) {
      if (this[key] !== undefined && payload[key] !== this[key]) {
        if (key === 'isRead') {
          if (!payload[key]) { // Updating to Not Read - Reset progress and current time
            this.finishedAt = null
            this.progress = 0
            this.currentTime = 0
          } else { // Updating to Read
            if (!this.finishedAt) this.finishedAt = Date.now()
            this.progress = 1
          }
        }

        this[key] = payload[key]
        hasUpdates = true
      }
    }
    if (!this.startedAt) {
      this.startedAt = Date.now()
    }
    if (hasUpdates) {
      this.lastUpdate = Date.now()
    }
    return hasUpdates
  }
}
module.exports = LibraryItemProgress