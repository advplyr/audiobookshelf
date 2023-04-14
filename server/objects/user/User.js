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
    this.seriesHideFromContinueListening = [] // Series IDs that should not show on home page continue listening
    this.bookmarks = []

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
  get isGuest() {
    return this.type === 'guest'
  }
  get isAdminOrUp() {
    return this.isAdmin || this.isRoot
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
  get canAccessExplicitContent() {
    return !!this.permissions.accessExplicitContent && this.isActive
  }
  get hasPw() {
    return !!this.pash && !!this.pash.length
  }

  getDefaultUserPermissions() {
    return {
      download: true,
      update: true,
      delete: this.type === 'root',
      upload: this.type === 'root' || this.type === 'admin',
      accessAllLibraries: true,
      accessAllTags: true,
      accessExplicitContent: true
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
      seriesHideFromContinueListening: [...this.seriesHideFromContinueListening],
      bookmarks: this.bookmarks ? this.bookmarks.map(b => b.toJSON()) : [],
      isActive: this.isActive,
      isLocked: this.isLocked,
      lastSeen: this.lastSeen,
      createdAt: this.createdAt,
      permissions: this.permissions,
      librariesAccessible: [...this.librariesAccessible],
      itemTagsAccessible: [...this.itemTagsAccessible]
    }
  }

  toJSONForBrowser(hideRootToken = false, minimal = false) {
    const json = {
      id: this.id,
      username: this.username,
      type: this.type,
      token: (this.type === 'root' && hideRootToken) ? '' : this.token,
      mediaProgress: this.mediaProgress ? this.mediaProgress.map(li => li.toJSON()) : [],
      seriesHideFromContinueListening: [...this.seriesHideFromContinueListening],
      bookmarks: this.bookmarks ? this.bookmarks.map(b => b.toJSON()) : [],
      isActive: this.isActive,
      isLocked: this.isLocked,
      lastSeen: this.lastSeen,
      createdAt: this.createdAt,
      permissions: this.permissions,
      librariesAccessible: [...this.librariesAccessible],
      itemTagsAccessible: [...this.itemTagsAccessible]
    }
    if (minimal) {
      delete json.mediaProgress
      delete json.bookmarks
    }
    return json
  }

  // Data broadcasted
  toJSONForPublic(sessions, libraryItems) {
    var userSession = sessions ? sessions.find(s => s.userId === this.id) : null
    var session = null
    if (userSession) {
      var libraryItem = libraryItems.find(li => li.id === userSession.libraryItemId)
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

    this.seriesHideFromContinueListening = []
    if (user.seriesHideFromContinueListening) this.seriesHideFromContinueListening = [...user.seriesHideFromContinueListening]

    this.isActive = (user.isActive === undefined || user.type === 'root') ? true : !!user.isActive
    this.isLocked = user.type === 'root' ? false : !!user.isLocked
    this.lastSeen = user.lastSeen || null
    this.createdAt = user.createdAt || Date.now()
    this.permissions = user.permissions || this.getDefaultUserPermissions()
    // Upload permission added v1.1.13, make sure root user has upload permissions
    if (this.type === 'root' && !this.permissions.upload) this.permissions.upload = true

    // Library restriction permissions added v1.4.14, defaults to all libraries
    if (this.permissions.accessAllLibraries === undefined) this.permissions.accessAllLibraries = true
    // Library restriction permissions added v2.0, defaults to all libraries
    if (this.permissions.accessAllTags === undefined) this.permissions.accessAllTags = true
    // Explicit content restriction permission added v2.0.18
    if (this.permissions.accessExplicitContent === undefined) this.permissions.accessExplicitContent = true

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

    if (payload.seriesHideFromContinueListening && Array.isArray(payload.seriesHideFromContinueListening)) {
      if (this.seriesHideFromContinueListening.join(',') !== payload.seriesHideFromContinueListening.join(',')) {
        hasUpdates = true
        this.seriesHideFromContinueListening = [...payload.seriesHideFromContinueListening]
      }
    }

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

  // Returns most recent media progress w/ `media` object and optionally an `episode` object
  getMostRecentItemProgress(libraryItems) {
    if (!this.mediaProgress.length) return null
    var mediaProgressObjects = this.mediaProgress.map(lip => lip.toJSON())
    mediaProgressObjects.sort((a, b) => b.lastUpdate - a.lastUpdate)

    var libraryItemMedia = null
    var progressEpisode = null
    // Find the most recent progress that still has a libraryItem and episode
    var mostRecentProgress = mediaProgressObjects.find((progress) => {
      const libraryItem = libraryItems.find(li => li.id === progress.libraryItemId)
      if (!libraryItem) {
        Logger.warn('[User] Library item not found for users progress ' + progress.libraryItemId)
        return false
      } else if (progress.episodeId) {
        const episode = libraryItem.mediaType === 'podcast' ? libraryItem.media.getEpisode(progress.episodeId) : null
        if (!episode) {
          Logger.warn(`[User] Episode ${progress.episodeId} not found for user media progress, podcast: ${libraryItem.media.metadata.title}`)
          return false
        } else {
          libraryItemMedia = libraryItem.media.toJSONExpanded()
          progressEpisode = episode.toJSON()
          return true
        }
      } else {
        libraryItemMedia = libraryItem.media.toJSONExpanded()
        return true
      }
    })

    if (!mostRecentProgress) return null

    return {
      ...mostRecentProgress,
      media: libraryItemMedia,
      episode: progressEpisode
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
    const itemProgress = this.mediaProgress.find(li => {
      if (episodeId && li.episodeId !== episodeId) return false
      return li.libraryItemId === libraryItem.id
    })
    if (!itemProgress) {
      const newItemProgress = new MediaProgress()

      newItemProgress.setData(libraryItem.id, updatePayload, episodeId)
      this.mediaProgress.push(newItemProgress)
      return true
    }
    const wasUpdated = itemProgress.update(updatePayload)

    if (updatePayload.lastUpdate) itemProgress.lastUpdate = updatePayload.lastUpdate // For local to keep update times in sync
    return wasUpdated
  }

  removeMediaProgress(id) {
    if (!this.mediaProgress.some(mp => mp.id === id)) return false
    this.mediaProgress = this.mediaProgress.filter(mp => mp.id !== id)
    return true
  }

  removeMediaProgressForLibraryItem(libraryItemId) {
    if (!this.mediaProgress.some(lip => lip.libraryItemId == libraryItemId)) return false
    this.mediaProgress = this.mediaProgress.filter(lip => lip.libraryItemId != libraryItemId)
    return true
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

  checkCanAccessLibraryItem(libraryItem) {
    if (!this.checkCanAccessLibrary(libraryItem.libraryId)) return false

    if (libraryItem.media.metadata.explicit && !this.canAccessExplicitContent) return false
    return this.checkCanAccessLibraryItemWithTags(libraryItem.media.tags)
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

  checkShouldHideSeriesFromContinueListening(seriesId) {
    return this.seriesHideFromContinueListening.includes(seriesId)
  }

  addSeriesToHideFromContinueListening(seriesId) {
    if (this.seriesHideFromContinueListening.includes(seriesId)) return false
    this.seriesHideFromContinueListening.push(seriesId)
    return true
  }

  removeSeriesFromHideFromContinueListening(seriesId) {
    if (!this.seriesHideFromContinueListening.includes(seriesId)) return false
    this.seriesHideFromContinueListening = this.seriesHideFromContinueListening.filter(sid => sid !== seriesId)
    return true
  }

  removeProgressFromContinueListening(progressId) {
    const progress = this.mediaProgress.find(mp => mp.id === progressId)
    if (!progress) return false
    return progress.removeFromContinueListening()
  }
}
module.exports = User