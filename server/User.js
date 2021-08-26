class User {
  constructor(user) {
    this.id = null
    this.username = null
    this.pash = null
    this.type = null
    this.stream = null
    this.token = null
    this.createdAt = null
    this.audiobooks = null
    this.settings = {}

    if (user) {
      this.construct(user)
    }
  }

  getDefaultUserSettings() {
    return {
      orderBy: 'book.title',
      orderDesc: false,
      filterBy: 'all',
      playbackRate: 1,
      bookshelfCoverSize: 120
    }
  }

  toJSON() {
    return {
      id: this.id,
      username: this.username,
      pash: this.pash,
      type: this.type,
      stream: this.stream,
      token: this.token,
      audiobooks: this.audiobooks,
      createdAt: this.createdAt,
      settings: this.settings
    }
  }

  toJSONForBrowser() {
    return {
      id: this.id,
      username: this.username,
      type: this.type,
      stream: this.stream,
      token: this.token,
      audiobooks: this.audiobooks,
      createdAt: this.createdAt,
      settings: this.settings
    }
  }

  construct(user) {
    this.id = user.id
    this.username = user.username
    this.pash = user.pash
    this.type = user.type
    this.stream = user.stream
    this.token = user.token
    this.audiobooks = user.audiobooks || null
    this.createdAt = user.createdAt
    this.settings = user.settings || this.getDefaultUserSettings()
  }

  updateAudiobookProgress(stream) {
    if (!this.audiobooks) this.audiobooks = {}
    if (!this.audiobooks[stream.audiobookId]) {
      this.audiobooks[stream.audiobookId] = {
        audiobookId: stream.audiobookId,
        totalDuration: stream.totalDuration,
        startedAt: Date.now()
      }
    }
    this.audiobooks[stream.audiobookId].lastUpdate = Date.now()
    this.audiobooks[stream.audiobookId].progress = stream.clientProgress
    this.audiobooks[stream.audiobookId].currentTime = stream.clientCurrentTime
  }

  // Returns Boolean If update was made
  updateSettings(settings) {
    if (!this.settings) {
      this.settings = { ...settings }
      return true
    }
    var madeUpdates = false

    for (const key in this.settings) {
      if (settings[key] !== undefined && this.settings[key] !== settings[key]) {
        this.settings[key] = settings[key]
        madeUpdates = true
      }
    }

    // Check if new settings update has keys not currently in user settings
    for (const key in settings) {
      if (settings[key] !== undefined && this.settings[key] === undefined) {
        this.settings[key] = settings[key]
        madeUpdates = true
      }
    }

    return madeUpdates
  }

  resetAudiobookProgress(audiobookId) {
    if (!this.audiobooks || !this.audiobooks[audiobookId]) {
      return false
    }
    delete this.audiobooks[audiobookId]
    return true
  }
}
module.exports = User