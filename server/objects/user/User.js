const Logger = require('../../Logger')
const AudioBookmark = require('./AudioBookmark')
const MediaProgress = require('./MediaProgress')

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

    this.mediaProgress = []
    this.bookmarks = []

    this.settings = {}
    this.permissions = {}
    this.librariesAccessible = [] // Library IDs (Empty if ALL libraries)
    this.itemTagsAccessible = [] // Empty if ALL item tags accessible

    if (user) {
      this.construct(user)
    }
  }

  get isRoot() {
    return this.type === 'root'
  }
  get isAdmin() {
    return this.type === 'admin'
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
  get canAccessAllTags() {
    return !!this.permissions.accessAllTags && this.isActive
  }
  get hasPw() {
    return !!this.pash && !!this.pash.length
  }

  getDefaultUserSettings() {
    return {
      mobileOrderBy: 'recent',
      mobileOrderDesc: true,
      mobileFilterBy: 'all',
      orderBy: 'media.metadata.title',
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
      accessAllLibraries: true,
      accessAllTags: true
    }
  }

  toJSON() {
    return {
      id: this.id,
      username: this.username,
      pash: this.pash,
      type: this.type,
      token: this.token,
      mediaProgress: this.mediaProgress ? this.mediaProgress.map(li => li.toJSON()) : [],
      bookmarks: this.bookmarks ? this.bookmarks.map(b => b.toJSON()) : [],
      isActive: this.isActive,
      isLocked: this.isLocked,
      lastSeen: this.lastSeen,
      createdAt: this.createdAt,
      settings: this.settings,
      permissions: this.permissions,
      librariesAccessible: [...this.librariesAccessible],
      itemTagsAccessible: [...this.itemTagsAccessible]
    }
  }

  toJSONForBrowser() {
    return {
      id: this.id,
      username: this.username,
      type: this.type,
      token: this.token,
      mediaProgress: this.mediaProgress ? this.mediaProgress.map(li => li.toJSON()) : [],
      bookmarks: this.bookmarks ? this.bookmarks.map(b => b.toJSON()) : [],
      isActive: this.isActive,
      isLocked: this.isLocked,
      lastSeen: this.lastSeen,
      createdAt: this.createdAt,
      settings: this.settings,
      permissions: this.permissions,
      librariesAccessible: [...this.librariesAccessible],
      itemTagsAccessible: [...this.itemTagsAccessible]
    }
  }

  // Data broadcasted
  toJSONForPublic(sessions, libraryItems) {
    var userSession = sessions ? sessions.find(s => s.userId === this.id) : null
    var session = null
    if (session) {
      var libraryItem = libraryItems.find(li => li.id === session.libraryItemId)
      if (libraryItem) {
        session = userSession.toJSONForClient(libraryItem)
      }
    }
    return {
      id: this.id,
      username: this.username,
      type: this.type,
      session,
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

    this.mediaProgress = []
    if (user.mediaProgress) {
      this.mediaProgress = user.mediaProgress.map(li => new MediaProgress(li)).filter(lip => lip.id)
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
    // Library restriction permissions added v2.0, defaults to all libraries
    if (this.permissions.accessAllTags === undefined) this.permissions.accessAllTags = true

    this.librariesAccessible = [...(user.librariesAccessible || [])]
    this.itemTagsAccessible = [...(user.itemTagsAccessible || [])]
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
    if (this.permissions.accessAllLibraries) {
      // Access all libraries
      if (this.librariesAccessible.length) {
        this.librariesAccessible = []
        hasUpdates = true
      }
    } else if (payload.librariesAccessible !== undefined) {
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

    // Update accessible tags
    if (this.permissions.accessAllTags) {
      // Access all tags
      if (this.itemTagsAccessible.length) {
        this.itemTagsAccessible = []
        hasUpdates = true
      }
    } else if (payload.itemTagsAccessible !== undefined) {
      if (payload.itemTagsAccessible.length) {
        if (payload.itemTagsAccessible.join(',') !== this.itemTagsAccessible.join(',')) {
          hasUpdates = true
          this.itemTagsAccessible = [...payload.itemTagsAccessible]
        }
      } else if (this.itemTagsAccessible.length > 0) {
        hasUpdates = true
        this.itemTagsAccessible = []
      }
    }
    return hasUpdates
  }

  getDefaultLibraryId(libraries) {
    // Libraries should already be in ascending display order, find first accessible
    var firstAccessibleLibrary = libraries.find(lib => this.checkCanAccessLibrary(lib.id))
    if (!firstAccessibleLibrary) return null
    return firstAccessibleLibrary.id
  }

  getMostRecentItemProgress(libraryItems) {
    if (!this.mediaProgress.length) return null
    var lip = this.mediaProgress.map(lip => lip.toJSON())
    lip.sort((a, b) => b.lastUpdate - a.lastUpdate)
    var mostRecentWithLip = lip.find(li => libraryItems.find(_li => _li.id === li.id))
    if (!mostRecentWithLip) return null
    var libraryItem = libraryItems.find(li => li.id === mostRecentWithLip.id)
    return {
      ...mostRecentWithLip,
      media: libraryItem.media.toJSONExpanded()
    }
  }

  getMediaProgress(libraryItemId, episodeId = null) {
    if (!this.mediaProgress) return null
    return this.mediaProgress.find(lip => {
      if (episodeId && lip.episodeId !== episodeId) return false
      return lip.libraryItemId === libraryItemId
    })
  }

  getAllMediaProgressForLibraryItem(libraryItemId) {
    if (!this.mediaProgress) return []
    return this.mediaProgress.filter(li => li.libraryItemId === libraryItemId)
  }

  createUpdateMediaProgress(libraryItem, updatePayload, episodeId = null) {
    var itemProgress = this.mediaProgress.find(li => {
      if (episodeId && li.episodeId !== episodeId) return false
      return li.libraryItemId === libraryItem.id
    })
    if (!itemProgress) {
      var newItemProgress = new MediaProgress()

      newItemProgress.setData(libraryItem.id, updatePayload, episodeId)
      this.mediaProgress.push(newItemProgress)
      return true
    }
    var wasUpdated = itemProgress.update(updatePayload)

    if (updatePayload.lastUpdate) itemProgress.lastUpdate = updatePayload.lastUpdate // For local to keep update times in sync
    return wasUpdated
  }

  removeMediaProgress(libraryItemId) {
    if (!this.mediaProgress.some(lip => lip.libraryItemId == libraryItemId)) return false
    this.mediaProgress = this.mediaProgress.filter(lip => lip.libraryItemId != libraryItemId)
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

  checkCanAccessLibraryItemWithTags(tags) {
    if (this.permissions.accessAllTags) return true
    if (!tags || !tags.length) return false
    return this.itemTagsAccessible.some(tag => tags.includes(tag))
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
}
module.exports = User