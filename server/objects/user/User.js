const Logger = require('../../Logger')
const AudioBookmark = require('./AudioBookmark')
const LibraryItemProgress = require('./LibraryItemProgress')

class User {
  constructor(user) {
    this.id = null
    this.username = null
    this.pash = null
    this.type = null
    this.token = null
    this.isActive = true
    this.isLocked = false
    this.lastSeen = null
    this.createdAt = null

    this.libraryItemProgress = []
    this.bookmarks = []

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
      bookshelfCoverSize: 120,
      collapseSeries: false
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

  toJSON() {
    return {
      id: this.id,
      username: this.username,
      pash: this.pash,
      type: this.type,
      token: this.token,
      libraryItemProgress: this.libraryItemProgress ? this.libraryItemProgress.map(li => li.toJSON()) : [],
      bookmarks: this.bookmarks ? this.bookmarks.map(b => b.toJSON()) : [],
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
      token: this.token,
      libraryItemProgress: this.libraryItemProgress ? this.libraryItemProgress.map(li => li.toJSON()) : [],
      bookmarks: this.bookmarks ? this.bookmarks.map(b => b.toJSON()) : [],
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
  toJSONForPublic(sessions, libraryItems) {
    var session = sessions ? sessions.find(s => s.userId === this.id) : null
    return {
      id: this.id,
      username: this.username,
      type: this.type,
      session: session ? session.toJSONForClient() : null,
      mostRecent: this.getMostRecentItemProgress(libraryItems),
      lastSeen: this.lastSeen,
      createdAt: this.createdAt
    }
  }

  construct(user) {
    this.id = user.id
    this.username = user.username
    this.pash = user.pash
    this.type = user.type
    this.token = user.token

    this.libraryItemProgress = []
    if (user.libraryItemProgress) {
      this.libraryItemProgress = user.libraryItemProgress.map(li => new LibraryItemProgress(li)).filter(lip => lip.id)
    }

    this.bookmarks = []
    if (user.bookmarks) {
      this.bookmarks = user.bookmarks.filter(bm => typeof bm.libraryItemId == 'string').map(bm => new AudioBookmark(bm))
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

  getMostRecentItemProgress(libraryItems) {
    if (!this.libraryItemProgress.length) return null
    var lip = this.libraryItemProgress.map(lip => lip.toJSON())
    lip.sort((a, b) => b.lastUpdate - a.lastUpdate)
    var mostRecentWithLip = lip.find(li => libraryItems.find(_li => _li.id === li.id))
    if (!mostRecentWithLip) return null
    var libraryItem = libraryItems.find(li => li.id === mostRecentWithLip.id)
    return {
      ...mostRecentWithLip,
      media: libraryItem.media.toJSONExpanded()
    }
  }

  getLibraryItemProgress(libraryItemId) {
    if (!this.libraryItemProgress) return null
    return this.libraryItemProgress.find(lip => lip.id === libraryItemId)
  }

  createUpdateLibraryItemProgress(libraryItemId, updatePayload) {
    var itemProgress = this.libraryItemProgress.find(li => li.id === libraryItemId)
    if (!itemProgress) {
      var newItemProgress = new LibraryItemProgress()
      newItemProgress.setData(libraryItemId, updatePayload)
      this.libraryItemProgress.push(newItemProgress)
      return true
    }
    var wasUpdated = itemProgress.update(updatePayload)
    return wasUpdated
  }

  removeLibraryItemProgress(libraryItemId) {
    if (!this.libraryItemProgress.some(lip => lip.id == libraryItemId)) return false
    this.libraryItemProgress = this.libraryItemProgress.filter(lip => lip != libraryItemId)
    return true
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

  checkCanAccessLibrary(libraryId) {
    if (this.permissions.accessAllLibraries) return true
    if (!this.librariesAccessible) return false
    return this.librariesAccessible.includes(libraryId)
  }

  findBookmark(libraryItemId, time) {
    return this.bookmarks.find(bm => bm.libraryItemId === libraryItemId && bm.time == time)
  }

  createBookmark(libraryItemId, time, title) {
    var existingBookmark = this.findBookmark(libraryItemId, time)
    if (existingBookmark) {
      Logger.warn('[User] Create Bookmark already exists for this time')
      existingBookmark.title = title
      return existingBookmark
    }
    var newBookmark = new AudioBookmark()
    newBookmark.setData(libraryItemId, time, title)
    this.bookmarks.push(newBookmark)
    return newBookmark
  }

  updateBookmark(libraryItemId, time, title) {
    var bookmark = this.findBookmark(libraryItemId, time)
    if (!bookmark) {
      Logger.error(`[User] updateBookmark not found`)
      return null
    }
    bookmark.title = title
    return bookmark
  }

  removeBookmark(libraryItemId, time) {
    this.bookmarks = this.bookmarks.filter(bm => (bm.libraryItemId !== libraryItemId || bm.time !== time))
  }

  syncLocalUserAudiobookData(localUserAudiobookData, audiobook) {
    if (!localUserAudiobookData || !localUserAudiobookData.audiobookId) {
      Logger.error(`[User] Invalid local user audiobook data`, localUserAudiobookData)
      return false
    }
    if (!this.audiobooks) this.audiobooks = {}

    if (!this.audiobooks[localUserAudiobookData.audiobookId]) {
      this.audiobooks[localUserAudiobookData.audiobookId] = new UserAudiobookData(localUserAudiobookData)
      return true
    }

    var userAbD = this.audiobooks[localUserAudiobookData.audiobookId]
    if (userAbD.lastUpdate >= localUserAudiobookData.lastUpdate) {
      // Server audiobook data is more recent
      return false
    }

    // Local Data More recent
    var wasUpdated = this.audiobooks[localUserAudiobookData.audiobookId].update(localUserAudiobookData)
    if (wasUpdated) {
      Logger.debug(`[User] syncLocalUserAudiobookData local data was more recent for "${audiobook.title}"`)
    }
    return wasUpdated
  }
}
module.exports = User