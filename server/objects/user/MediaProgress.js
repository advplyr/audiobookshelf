class MediaProgress {
  constructor(progress) {
    this.id = null
    this.libraryItemId = null
    this.episodeId = null // For podcasts

    this.duration = null
    this.progress = null // 0 to 1
    this.currentTime = null // seconds
    this.isFinished = false
    this.hideFromContinueListening = false

    this.ebookLocation = null // cfi tag for epub, page number for pdf
    this.ebookProgress = null // 0 to 1

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
      libraryItemId: this.libraryItemId,
      episodeId: this.episodeId,
      duration: this.duration,
      progress: this.progress,
      currentTime: this.currentTime,
      isFinished: this.isFinished,
      hideFromContinueListening: this.hideFromContinueListening,
      ebookLocation: this.ebookLocation,
      ebookProgress: this.ebookProgress,
      lastUpdate: this.lastUpdate,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt
    }
  }

  construct(progress) {
    this.id = progress.id
    this.libraryItemId = progress.libraryItemId
    this.episodeId = progress.episodeId
    this.duration = progress.duration || 0
    this.progress = progress.progress
    this.currentTime = progress.currentTime || 0
    this.isFinished = !!progress.isFinished
    this.hideFromContinueListening = !!progress.hideFromContinueListening
    this.ebookLocation = progress.ebookLocation || null
    this.ebookProgress = progress.ebookProgress || null
    this.lastUpdate = progress.lastUpdate
    this.startedAt = progress.startedAt
    this.finishedAt = progress.finishedAt || null
  }

  get inProgress() {
    return !this.isFinished && (this.progress > 0 || (this.ebookLocation != null && this.ebookProgress > 0))
  }

  setData(libraryItemId, progress, episodeId = null) {
    this.id = episodeId ? `${libraryItemId}-${episodeId}` : libraryItemId
    this.libraryItemId = libraryItemId
    this.episodeId = episodeId
    this.duration = progress.duration || 0
    this.progress = Math.min(1, (progress.progress || 0))
    this.currentTime = progress.currentTime || 0
    this.isFinished = !!progress.isFinished || this.progress == 1
    this.hideFromContinueListening = !!progress.hideFromContinueListening
    this.ebookLocation = progress.ebookLocation
    this.ebookProgress = Math.min(1, (progress.ebookProgress || 0))
    this.lastUpdate = Date.now()
    this.finishedAt = null
    if (this.isFinished) {
      this.finishedAt = progress.finishedAt || Date.now()
      this.progress = 1
    }
    this.startedAt = progress.startedAt || this.finishedAt || Date.now()
  }

  update(payload) {
    let hasUpdates = false
    for (const key in payload) {
      if (this[key] !== undefined && payload[key] !== this[key]) {
        if (key === 'isFinished') {
          if (!payload[key]) { // Updating to Not Finished - Reset progress and current time
            this.finishedAt = null
            this.progress = 0
            this.currentTime = 0
          } else { // Updating to Finished
            if (!this.finishedAt) this.finishedAt = Date.now()
            this.progress = 1
          }
        }

        this[key] = payload[key]
        hasUpdates = true
      }
    }

    var timeRemaining = this.duration - this.currentTime
    // If time remaining is less than 5 seconds then mark as finished
    if ((this.progress >= 1 || (this.duration && !isNaN(timeRemaining) && timeRemaining < 5))) {
      this.isFinished = true
      this.finishedAt = payload.finishedAt || Date.now()
      this.progress = 1
    } else if (this.progress < 1 && this.isFinished) {
      this.isFinished = false
      this.finishedAt = null
    }

    if (!this.startedAt) {
      this.startedAt = this.finishedAt || Date.now()
    }
    if (hasUpdates) {
      if (payload.hideFromContinueListening === undefined) {
        // Reset this flag when the media progress is updated
        this.hideFromContinueListening = false
      }

      this.lastUpdate = Date.now()
    }
    return hasUpdates
  }

  removeFromContinueListening() {
    if (this.hideFromContinueListening) return false

    this.hideFromContinueListening = true
    return true
  }
}
module.exports = MediaProgress