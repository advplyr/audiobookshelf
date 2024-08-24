const Folder = require('./Folder')
const LibrarySettings = require('./settings/LibrarySettings')
const { filePathToPOSIX } = require('../utils/fileUtils')

class Library {
  constructor(library = null) {
    this.id = null
    this.oldLibraryId = null // TODO: Temp
    this.name = null
    this.folders = []
    this.displayOrder = 1
    this.icon = 'database'
    this.mediaType = 'book' // book, podcast
    this.provider = 'google'

    this.lastScan = 0
    this.lastScanVersion = null
    this.lastScanMetadataPrecedence = null

    this.settings = null

    this.createdAt = null
    this.lastUpdate = null

    if (library) {
      this.construct(library)
    }
  }

  get isPodcast() {
    return this.mediaType === 'podcast'
  }
  get isBook() {
    return this.mediaType === 'book'
  }

  construct(library) {
    this.id = library.id
    this.oldLibraryId = library.oldLibraryId
    this.name = library.name
    this.folders = (library.folders || []).map((f) => new Folder(f))
    this.displayOrder = library.displayOrder || 1
    this.icon = library.icon || 'database'
    this.mediaType = library.mediaType
    this.provider = library.provider || 'google'

    this.settings = new LibrarySettings(library.settings)
    if (library.settings === undefined) {
      // LibrarySettings added in v2, migrate settings
      this.settings.disableWatcher = !!library.disableWatcher
    }

    this.lastScan = library.lastScan
    this.lastScanVersion = library.lastScanVersion
    this.lastScanMetadataPrecedence = library.lastScanMetadataPrecedence

    this.createdAt = library.createdAt
    this.lastUpdate = library.lastUpdate
    this.cleanOldValues() // mediaType changed for v2 and icon change for v2.2.2
  }

  cleanOldValues() {
    const availableIcons = ['database', 'audiobookshelf', 'books-1', 'books-2', 'book-1', 'microphone-1', 'microphone-3', 'radio', 'podcast', 'rss', 'headphones', 'music', 'file-picture', 'rocket', 'power', 'star', 'heart']
    if (!availableIcons.includes(this.icon)) {
      if (this.icon === 'audiobook') this.icon = 'audiobookshelf'
      else if (this.icon === 'book') this.icon = 'books-1'
      else if (this.icon === 'comic') this.icon = 'file-picture'
      else this.icon = 'database'
    }

    const mediaTypes = ['podcast', 'book', 'video', 'music']
    if (!this.mediaType || !mediaTypes.includes(this.mediaType)) {
      this.mediaType = 'book'
    }
  }

  toJSON() {
    return {
      id: this.id,
      oldLibraryId: this.oldLibraryId,
      name: this.name,
      folders: (this.folders || []).map((f) => f.toJSON()),
      displayOrder: this.displayOrder,
      icon: this.icon,
      mediaType: this.mediaType,
      provider: this.provider,
      settings: this.settings.toJSON(),
      lastScan: this.lastScan,
      lastScanVersion: this.lastScanVersion,
      createdAt: this.createdAt,
      lastUpdate: this.lastUpdate
    }
  }
}
module.exports = Library
