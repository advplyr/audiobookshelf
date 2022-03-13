const Folder = require('./Folder')
const { getId } = require('../utils/index')

class Library {
  constructor(library = null) {
    this.id = null
    this.name = null
    this.folders = []
    this.displayOrder = 1
    this.icon = 'database'
    this.mediaType = 'default'
    this.provider = 'google'
    this.disableWatcher = false

    this.lastScan = 0

    this.createdAt = null
    this.lastUpdate = null

    if (library) {
      this.construct(library)
    }
  }

  get folderPaths() {
    return this.folders.map(f => f.fullPath)
  }
  get itemMediaType() {
    return this.mediaType === 'podcast' ? 'podcast' : 'book'
  }

  construct(library) {
    this.id = library.id
    this.name = library.name
    this.folders = (library.folders || []).map(f => new Folder(f))
    this.displayOrder = library.displayOrder || 1
    this.icon = library.icon || 'database'
    this.mediaType = library.mediaType || 'default'
    this.provider = library.provider || 'google'
    this.disableWatcher = !!library.disableWatcher

    this.createdAt = library.createdAt
    this.lastUpdate = library.lastUpdate
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      folders: (this.folders || []).map(f => f.toJSON()),
      displayOrder: this.displayOrder,
      icon: this.icon,
      mediaType: this.mediaType,
      provider: this.provider,
      disableWatcher: this.disableWatcher,
      createdAt: this.createdAt,
      lastUpdate: this.lastUpdate
    }
  }

  setData(data) {
    this.id = data.id ? data.id : getId('lib')
    this.name = data.name
    if (data.folder) {
      this.folders = [
        new Folder(data.folder)
      ]
    } else if (data.folders) {
      this.folders = data.folders.map(folder => {
        var newFolder = new Folder()
        newFolder.setData({
          fullPath: folder.fullPath,
          libraryId: this.id
        })
        return newFolder
      })
    }
    this.displayOrder = data.displayOrder || 1
    this.icon = data.icon || 'database'
    this.mediaType = data.mediaType || 'default'
    this.disableWatcher = !!data.disableWatcher
    this.createdAt = Date.now()
    this.lastUpdate = Date.now()
  }

  update(payload) {
    var hasUpdates = false
    if (payload.name && payload.name !== this.name) {
      this.name = payload.name
      hasUpdates = true
    }
    if (payload.provider && payload.provider !== this.provider) {
      this.provider = payload.provider
      hasUpdates = true
    }
    if (payload.mediaType && payload.mediaType !== this.mediaType) {
      this.mediaType = payload.mediaType
      hasUpdates = true
    }
    if (payload.icon && payload.icon !== this.icon) {
      this.icon = payload.icon
      hasUpdates = true
    }

    if (payload.disableWatcher !== this.disableWatcher) {
      this.disableWatcher = !!payload.disableWatcher
      hasUpdates = true
    }
    if (!isNaN(payload.displayOrder) && payload.displayOrder !== this.displayOrder) {
      this.displayOrder = Number(payload.displayOrder)
      hasUpdates = true
    }
    if (payload.folders) {
      var newFolders = payload.folders.filter(f => !f.id)
      var removedFolders = this.folders.filter(f => !payload.folders.find(_f => _f.id === f.id))

      if (removedFolders.length) {
        var removedFolderIds = removedFolders.map(f => f.id)
        this.folders = this.folders.filter(f => !removedFolderIds.includes(f.id))
      }

      if (newFolders.length) {
        newFolders.forEach((folderData) => {
          folderData.libraryId = this.id
          var newFolder = new Folder()
          newFolder.setData(folderData)
          this.folders.push(newFolder)
        })
      }

      if (newFolders.length || removedFolders.length) {
        hasUpdates = true
      }
    }
    if (hasUpdates) {
      this.lastUpdate = Date.now()
    }
    return hasUpdates
  }

  checkFullPathInLibrary(fullPath) {
    fullPath = fullPath.replace(/\\/g, '/')
    return this.folders.find(folder => fullPath.startsWith(folder.fullPath.replace(/\\/g, '/')))
  }

  getFolderById(id) {
    return this.folders.find(folder => folder.id === id)
  }
}
module.exports = Library