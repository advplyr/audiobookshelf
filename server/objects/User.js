const AudiobookProgress = require('./AudiobookProgress')

class User {
  constructor(user) {
    this.id = null
    this.username = null
    this.pash = null
    this.type = null
    this.stream = null
    this.token = null
    this.isActive = true
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

  audiobooksToJSON() {
    if (!this.audiobooks) return null
    var _map = {}
    for (const key in this.audiobooks) {
      if (this.audiobooks[key]) {
        _map[key] = this.audiobooks[key].toJSON()
      }
    }
    return _map
  }

  toJSON() {
    return {
      id: this.id,
      username: this.username,
      pash: this.pash,
      type: this.type,
      stream: this.stream,
      token: this.token,
      audiobooks: this.audiobooksToJSON(),
      isActive: this.isActive,
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
      audiobooks: this.audiobooksToJSON(),
      isActive: this.isActive,
      createdAt: this.createdAt,
      settings: this.settings
    }
  }

  construct(user) {
    this.id = user.id
    this.username = user.username
    this.pash = user.pash
    this.type = user.type
    this.stream = user.stream || null
    this.token = user.token
    if (user.audiobooks) {
      this.audiobooks = {}
      for (const key in user.audiobooks) {
        if (user.audiobooks[key]) {
          this.audiobooks[key] = new AudiobookProgress(user.audiobooks[key])
        }
      }
    }
    this.isActive = (user.isActive === undefined || user.id === 'root') ? true : !!user.isActive
    this.createdAt = user.createdAt || Date.now()
    this.settings = user.settings || this.getDefaultUserSettings()
  }

  update(payload) {
    var hasUpdates = false
    const keysToCheck = ['pash', 'type', 'username', 'isActive']
    keysToCheck.forEach((key) => {
      if (payload[key] !== undefined) {
        if (key === 'isActive' || payload[key]) { // pash, type, username must evaluate to true (cannot be null or empty)
          if (payload[key] !== this[key]) {
            hasUpdates = true
            this[key] = payload[key]
          }
        }
      }
    })
    return hasUpdates
  }

  updateAudiobookProgressFromStream(stream) {
    if (!this.audiobooks) this.audiobooks = {}
    if (!this.audiobooks[stream.audiobookId]) {
      this.audiobooks[stream.audiobookId] = new AudiobookProgress()
    }
    this.audiobooks[stream.audiobookId].updateFromStream(stream)
  }

  updateAudiobookProgress(audiobookId, updatePayload) {
    if (!this.audiobooks) this.audiobooks = {}
    if (!this.audiobooks[audiobookId]) {
      this.audiobooks[audiobookId] = new AudiobookProgress()
      this.audiobooks[audiobookId].audiobookId = audiobookId
    }
    return this.audiobooks[audiobookId].update(updatePayload)
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