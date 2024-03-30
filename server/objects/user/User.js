const Logger = require('../../Logger')
const AudioBookmark = require('./AudioBookmark')
const MediaProgress = require('./MediaProgress')

class User {
  constructor(user) {
    this.id = null
    this.oldUserId = null // TODO: Temp for keeping old access tokens
    this.username = null
    this.email = null
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
    this.itemTagsSelected = [] // Empty if ALL item tags accessible

    this.authOpenIDSub = null

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
  get isUser() {
    return this.type === 'user'
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
      update: this.type === 'root' || this.type === 'admin',
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
      oldUserId: this.oldUserId,
      username: this.username,
      email: this.email,
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
      itemTagsSelected: [...this.itemTagsSelected],
      authOpenIDSub: this.authOpenIDSub
    }
  }

  toJSONForBrowser(hideRootToken = false, minimal = false) {
    const json = {
      id: this.id,
      oldUserId: this.oldUserId,
      username: this.username,
      email: this.email,
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
      itemTagsSelected: [...this.itemTagsSelected],
      hasOpenIDLink: !!this.authOpenIDSub
    }
    if (minimal) {
      delete json.mediaProgress
      delete json.bookmarks
    }
    return json
  }

  /**
   * User data for clients
   * @param {[oldPlaybackSession[]]} sessions optional array of open playback sessions
   * @returns {object}
   */
  toJSONForPublic(sessions) {
    const userSession = sessions?.find(s => s.userId === this.id) || null
    const session = userSession?.toJSONForClient() || null
    return {
      id: this.id,
      oldUserId: this.oldUserId,
      username: this.username,
      type: this.type,
      session,
      lastSeen: this.lastSeen,
      createdAt: this.createdAt
    }
  }

  construct(user) {
    this.id = user.id
    this.oldUserId = user.oldUserId
    this.username = user.username
    this.email = user.email || null
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
    // itemTagsAccessible was renamed to itemTagsSelected in version v2.2.20
    if (user.itemTagsAccessible?.length) {
      this.permissions.selectedTagsNotAccessible = false
      user.itemTagsSelected = user.itemTagsAccessible
    }

    this.librariesAccessible = [...(user.librariesAccessible || [])]
    this.itemTagsSelected = [...(user.itemTagsSelected || [])]

    this.authOpenIDSub = user.authOpenIDSub || null
  }

  update(payload) {
    var hasUpdates = false
    // Update the following keys:
    const keysToCheck = ['pash', 'type', 'username', 'email', 'isActive']
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
      if (this.itemTagsSelected.length) {
        this.itemTagsSelected = []
        this.permissions.selectedTagsNotAccessible = false
        hasUpdates = true
      }
    } else if (payload.itemTagsSelected !== undefined) {
      if (payload.itemTagsSelected.length) {
        if (payload.itemTagsSelected.join(',') !== this.itemTagsSelected.join(',')) {
          hasUpdates = true
          this.itemTagsSelected = [...payload.itemTagsSelected]
        }
      } else if (this.itemTagsSelected.length > 0) {
        hasUpdates = true
        this.itemTagsSelected = []
        this.permissions.selectedTagsNotAccessible = false
      }
    }
    return hasUpdates
  }

  // List of expected permission properties from the client
  static permissionMapping = {
    canDownload: 'download',
    canUpload: 'upload',
    canDelete: 'delete',
    canUpdate: 'update',
    canAccessExplicitContent: 'accessExplicitContent',
    canAccessAllLibraries: 'accessAllLibraries',
    canAccessAllTags: 'accessAllTags',
    tagsAreDenylist: 'selectedTagsNotAccessible',
    // Direct mapping for array-based permissions
    allowedLibraries: 'librariesAccessible',
    allowedTags: 'itemTagsSelected'
  }

  /**
   * Update user permissions from external JSON
   * 
   * @param {Object} absPermissions JSON containing user permissions
   * @returns {boolean} true if updates were made
   */
  updatePermissionsFromExternalJSON(absPermissions) {
    let hasUpdates = false
    let updatedUserPermissions = {}

    // Initialize all permissions to false first
    Object.keys(User.permissionMapping).forEach(mappingKey => {
      const userPermKey = User.permissionMapping[mappingKey]
      if (typeof this.permissions[userPermKey] === 'boolean') {
        updatedUserPermissions[userPermKey] = false // Default to false for boolean permissions
      }
    })

    // Map the boolean permissions from absPermissions
    Object.keys(absPermissions).forEach(absKey => {
      const userPermKey = User.permissionMapping[absKey]
      if (!userPermKey) {
        throw new Error(`Unexpected permission property: ${absKey}`)
      }

      if (updatedUserPermissions[userPermKey] !== undefined) {
        updatedUserPermissions[userPermKey] = !!absPermissions[absKey]
      }
    })

    // Update user permissions if changes were made
    if (JSON.stringify(this.permissions) !== JSON.stringify(updatedUserPermissions)) {
      this.permissions = updatedUserPermissions
      hasUpdates = true
    }

    // Handle allowedLibraries
    if (this.permissions.accessAllLibraries) {
      if (this.librariesAccessible.length) {
        this.librariesAccessible = []
        hasUpdates = true
      }
    } else if (absPermissions.allowedLibraries?.length && absPermissions.allowedLibraries.join(',') !== this.librariesAccessible.join(',')) {
      if (absPermissions.allowedLibraries.some(lid => typeof lid !== 'string')) {
        throw new Error('Invalid permission property "allowedLibraries", expecting array of strings')
      }
      this.librariesAccessible = absPermissions.allowedLibraries
      hasUpdates = true
    }

    // Handle allowedTags
    if (this.permissions.accessAllTags) {
      if (this.itemTagsSelected.length) {
        this.itemTagsSelected = []
        hasUpdates = true
      }
    } else if (absPermissions.allowedTags?.length && absPermissions.allowedTags.join(',') !== this.itemTagsSelected.join(',')) {
      if (absPermissions.allowedTags.some(tag => typeof tag !== 'string')) {
        throw new Error('Invalid permission property "allowedTags", expecting array of strings')
      }
      this.itemTagsSelected = absPermissions.allowedTags
      hasUpdates = true
    }

    return hasUpdates
  }


  /**
   * Get a sample to show how a JSON for updatePermissionsFromExternalJSON should look like 
   * 
   * @returns {string} JSON string
   */
  static getSampleAbsPermissions() {
    // Start with a template object where all permissions are false for simplicity
    const samplePermissions = Object.keys(User.permissionMapping).reduce((acc, key) => {
      // For array-based permissions, provide a sample array
      if (key === 'allowedLibraries') {
        acc[key] = [`5406ba8a-16e1-451d-96d7-4931b0a0d966`, `918fd848-7c1d-4a02-818a-847435a879ca`]
      } else if (key === 'allowedTags') {
        acc[key] = [`ExampleTag`, `AnotherTag`, `ThirdTag`]
      } else {
        acc[key] = false
      }
      return acc
    }, {})

    return JSON.stringify(samplePermissions, null, 2) // Pretty print the JSON
  }

  /**
   * Get first available library id for user
   * 
   * @param {string[]} libraryIds
   * @returns {string|null}
   */
  getDefaultLibraryId(libraryIds) {
    // Libraries should already be in ascending display order, find first accessible
    return libraryIds.find(lid => this.checkCanAccessLibrary(lid)) || null
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

      newItemProgress.setData(libraryItem, updatePayload, episodeId, this.id)
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

  checkCanAccessLibrary(libraryId) {
    if (this.permissions.accessAllLibraries) return true
    if (!this.librariesAccessible) return false
    return this.librariesAccessible.includes(libraryId)
  }

  checkCanAccessLibraryItemWithTags(tags) {
    if (this.permissions.accessAllTags) return true
    if (this.permissions.selectedTagsNotAccessible) {
      if (!tags?.length) return true
      return tags.every(tag => !this.itemTagsSelected.includes(tag))
    }
    if (!tags?.length) return false
    return this.itemTagsSelected.some(tag => tags.includes(tag))
  }

  checkCanAccessLibraryItem(libraryItem) {
    if (!this.checkCanAccessLibrary(libraryItem.libraryId)) return false

    if (libraryItem.media.metadata.explicit && !this.canAccessExplicitContent) return false
    return this.checkCanAccessLibraryItemWithTags(libraryItem.media.tags)
  }

  /**
   * Checks if a user can access a library item
   * @param {string} libraryId 
   * @param {boolean} explicit 
   * @param {string[]} tags 
   */
  checkCanAccessLibraryItemWithData(libraryId, explicit, tags) {
    if (!this.checkCanAccessLibrary(libraryId)) return false
    if (explicit && !this.canAccessExplicitContent) return false
    return this.checkCanAccessLibraryItemWithTags(tags)
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

  /**
   * Number of podcast episodes not finished for library item
   * Note: libraryItem passed in from libraryHelpers is not a LibraryItem class instance
   * @param {LibraryItem|object} libraryItem 
   * @returns {number}
   */
  getNumEpisodesIncompleteForPodcast(libraryItem) {
    if (!libraryItem?.media.episodes) return 0
    let numEpisodesIncomplete = 0
    for (const episode of libraryItem.media.episodes) {
      const mediaProgress = this.getMediaProgress(libraryItem.id, episode.id)
      if (!mediaProgress?.isFinished) {
        numEpisodesIncomplete++
      }
    }
    return numEpisodesIncomplete
  }
}
module.exports = User