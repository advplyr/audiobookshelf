const Logger = require('../Logger')
const UserAudiobookData = require('./UserAudiobookData')

class User {
  constructor(user) {
    this.id = null
    this.username = null
    this.pash = null
    this.type = null
    this.stream = null
    this.token = null
    this.isActive = true
    this.isLocked = false
    this.lastSeen = null
    this.createdAt = null
    this.audiobooks = null

    this.settings = {}
    this.permissions = {}
    this.librariesAccessible = [] // Library IDs (Empty if ALL libraries)

    if (user) {
      this.construct(user)
    }
  }

  get isRoot() {
    return this.type === 'root'
  }
  get canDelete() {
    return !!this.permissions.delete && this.isActive
  }
  get canUpdate() {
    return !!this.permissions.update && this.isActive
  }
  get canDownload() {
    return !!this.permissions.download && this.isActive
  }
  get canUpload() {
    return !!this.permissions.upload && this.isActive
  }
  get canAccessAllLibraries() {
    return !!this.permissions.accessAllLibraries && this.isActive
  }
  get hasPw() {
    return !!this.pash && !!this.pash.length
  }

  getDefaultUserSettings() {
    return {
      mobileOrderBy: 'recent',
      mobileOrderDesc: true,
      mobileFilterBy: 'all',
      orderBy: 'book.title',
      orderDesc: false,
      filterBy: 'all',
      playbackRate: 1,
      bookshelfCoverSize: 120
    }
  }

  getDefaultUserPermissions() {
    return {
      download: true,
      update: true,
      delete: this.type === 'root',
      upload: this.type === 'root' || this.type === 'admin',
      accessAllLibraries: true
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
      isLocked: this.isLocked,
      lastSeen: this.lastSeen,
      createdAt: this.createdAt,
      settings: this.settings,
      permissions: this.permissions,
      librariesAccessible: [...this.librariesAccessible]
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
      isLocked: this.isLocked,
      lastSeen: this.lastSeen,
      createdAt: this.createdAt,
      settings: this.settings,
      permissions: this.permissions,
      librariesAccessible: [...this.librariesAccessible]
    }
  }

  // Data broadcasted
  toJSONForPublic(streams) {
    var stream = this.stream && streams ? streams.find(s => s.id === this.stream) : null
    return {
      id: this.id,
      username: this.username,
      type: this.type,
      stream: stream ? stream.toJSON() : null,
      lastSeen: this.lastSeen,
      createdAt: this.createdAt
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
          this.audiobooks[key] = new UserAudiobookData(user.audiobooks[key])
        }
      }
    }
    this.isActive = (user.isActive === undefined || user.type === 'root') ? true : !!user.isActive
    this.isLocked = user.type === 'root' ? false : !!user.isLocked
    this.lastSeen = user.lastSeen || null
    this.createdAt = user.createdAt || Date.now()
    this.settings = user.settings || this.getDefaultUserSettings()
    this.permissions = user.permissions || this.getDefaultUserPermissions()
    // Upload permission added v1.1.13, make sure root user has upload permissions
    if (this.type === 'root' && !this.permissions.upload) this.permissions.upload = true

    // Library restriction permissions added v1.4.14, defaults to all libraries
    if (this.permissions.accessAllLibraries === undefined) this.permissions.accessAllLibraries = true

    this.librariesAccessible = (user.librariesAccessible || []).map(l => l)
  }

  update(payload) {
    var hasUpdates = false
    // Update the following keys:
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
    // And update permissions
    if (payload.permissions) {
      for (const key in payload.permissions) {
        if (payload.permissions[key] !== this.permissions[key]) {
          hasUpdates = true
          this.permissions[key] = payload.permissions[key]
        }
      }
    }
    // Update accessible libraries
    if (payload.librariesAccessible !== undefined) {
      if (payload.librariesAccessible.length) {
        if (payload.librariesAccessible.join(',') !== this.librariesAccessible.join(',')) {
          hasUpdates = true
          this.librariesAccessible = [...payload.librariesAccessible]
        }
      } else if (this.librariesAccessible.length > 0) {
        hasUpdates = true
        this.librariesAccessible = []
      }
    }
    return hasUpdates
  }

  updateAudiobookProgressFromStream(stream) {
    if (!this.audiobooks) this.audiobooks = {}
    if (!this.audiobooks[stream.audiobookId]) {
      this.audiobooks[stream.audiobookId] = new UserAudiobookData()
    }
    this.audiobooks[stream.audiobookId].updateProgressFromStream(stream)
    return this.audiobooks[stream.audiobookId]
  }

  updateAudiobookData(audiobook, updatePayload) {
    if (!this.audiobooks) this.audiobooks = {}
    if (!this.audiobooks[audiobook.id]) {
      this.audiobooks[audiobook.id] = new UserAudiobookData()
      this.audiobooks[audiobook.id].audiobookId = audiobook.id
    }
    var wasUpdated = this.audiobooks[audiobook.id].update(updatePayload)
    if (wasUpdated) {
      Logger.debug(`[User] UserAudiobookData was updated ${JSON.stringify(this.audiobooks[audiobook.id])}`)
      return this.audiobooks[audiobook.id]
    }
    return false
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

  resetAudiobookProgress(audiobook) {
    if (!this.audiobooks || !this.audiobooks[audiobook.id]) {
      return false
    }
    return this.updateAudiobookData(audiobook, {
      progress: 0,
      currentTime: 0,
      isRead: false,
      lastUpdate: Date.now(),
      startedAt: null,
      finishedAt: null
    })
  }

  deleteAudiobookData(audiobookId) {
    if (!this.audiobooks || !this.audiobooks[audiobookId]) {
      return false
    }
    delete this.audiobooks[audiobookId]
    return true
  }

  checkCanAccessLibrary(libraryId) {
    if (this.permissions.accessAllLibraries) return true
    if (!this.librariesAccessible) return false
    return this.librariesAccessible.includes(libraryId)
  }

  getAudiobookJSON(audiobookId) {
    return this.audiobooks[audiobookId] ? this.audiobooks[audiobookId].toJSON() : null
  }

  createBookmark({ audiobookId, time, title }) {
    if (!this.audiobooks) this.audiobooks = {}
    if (!this.audiobooks[audiobookId]) {
      this.audiobooks[audiobookId] = new UserAudiobookData()
      this.audiobooks[audiobookId].audiobookId = audiobookId
    }
    if (this.audiobooks[audiobookId].checkBookmarkExists(time)) {
      return {
        error: 'Bookmark already exists'
      }
    }

    var success = this.audiobooks[audiobookId].createBookmark(time, title)
    if (success) return this.audiobooks[audiobookId]
    return null
  }

  updateBookmark({ audiobookId, time, title }) {
    if (!this.audiobooks || !this.audiobooks[audiobookId]) {
      return {
        error: 'Invalid Audiobook'
      }
    }
    if (!this.audiobooks[audiobookId].checkBookmarkExists(time)) {
      return {
        error: 'Bookmark does not exist'
      }
    }

    var success = this.audiobooks[audiobookId].updateBookmark(time, title)
    if (success) return this.audiobooks[audiobookId]
    return null
  }

  deleteBookmark({ audiobookId, time }) {
    if (!this.audiobooks || !this.audiobooks[audiobookId]) {
      return {
        error: 'Invalid Audiobook'
      }
    }
    if (!this.audiobooks[audiobookId].checkBookmarkExists(time)) {
      return {
        error: 'Bookmark does not exist'
      }
    }

    this.audiobooks[audiobookId].deleteBookmark(time)
    return this.audiobooks[audiobookId]
  }
}
module.exports = User