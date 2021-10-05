const Folder = require('./Folder')

class Library {
  constructor(library = null) {
    this.id = null
    this.name = null
    this.folders = []

    this.createdAt = null
    this.lastUpdate = null

    if (library) {
      this.construct(library)
    }
  }

  get folderPaths() {
    return this.folders.map(f => f.fullPath)
  }

  construct(library) {
    this.id = library.id
    this.name = library.name
    this.folders = (library.folders || []).map(f => new Folder(f))
    this.createdAt = library.createdAt
    this.lastUpdate = library.lastUpdate
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      folders: (this.folders || []).map(f => f.toJSON()),
      createdAt: this.createdAt,
      lastUpdate: this.lastUpdate
    }
  }

  setData(data) {
    this.id = data.id ? data.id : 'lib' + (Math.trunc(Math.random() * 1000) + Date.now()).toString(36)
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
    this.createdAt = Date.now()
    this.lastUpdate = Date.now()
  }

  update(payload) {
    var hasUpdates = false
    if (payload.name && payload.name !== this.name) {
      this.name = payload.name
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
          var newFolder = new Folder()
          newFolder.setData(folderData)
          this.folders.push(newFolder)
        })
      }

      hasUpdates = newFolders.length || removedFolders.length
    }
    if (hasUpdates) {
      this.lastUpdate = Date.now()
    }
    return hasUpdates
  }

  checkFullPathInLibrary(fullPath) {
    return this.folders.find(folder => fullPath.startsWith(folder.fullPath))
  }
}
module.exports = Library