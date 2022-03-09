const Logger = require('../Logger')
const LibraryFile = require('./files/LibraryFile')
const Book = require('./entities/Book')
const Podcast = require('./entities/Podcast')

class LibraryItem {
  constructor(libraryItem = null) {
    this.id = null
    this.ino = null // Inode

    this.libraryId = null
    this.folderId = null

    this.path = null
    this.relPath = null
    this.mtimeMs = null
    this.ctimeMs = null
    this.birthtimeMs = null
    this.addedAt = null
    this.lastUpdate = null
    this.lastScan = null
    this.scanVersion = null

    // Entity was scanned and not found
    this.isMissing = false

    this.entityType = null
    this.entity = null

    this.libraryFiles = []

    if (libraryItem) {
      this.construct(libraryItem)
    }
  }

  construct(libraryItem) {
    this.id = libraryItem.id
    this.ino = libraryItem.ino || null
    this.libraryId = libraryItem.libraryId
    this.folderId = libraryItem.folderId
    this.path = libraryItem.path
    this.relPath = libraryItem.relPath
    this.mtimeMs = libraryItem.mtimeMs || 0
    this.ctimeMs = libraryItem.ctimeMs || 0
    this.birthtimeMs = libraryItem.birthtimeMs || 0
    this.addedAt = libraryItem.addedAt
    this.lastUpdate = libraryItem.lastUpdate || this.addedAt
    this.lastScan = libraryItem.lastScan || null
    this.scanVersion = libraryItem.scanVersion || null

    this.isMissing = !!libraryItem.isMissing

    this.entityType = libraryItem.entityType
    if (this.entityType === 'book') {
      this.entity = new Book(libraryItem.entity)
    } else if (this.entityType === 'podcast') {
      this.entity = new Podcast(libraryItem.entity)
    }

    this.libraryFiles = libraryItem.libraryFiles.map(f => new LibraryFile(f))
  }

  toJSON() {
    return {
      id: this.id,
      ino: this.ino,
      libraryId: this.libraryId,
      folderId: this.folderId,
      path: this.path,
      relPath: this.relPath,
      mtimeMs: this.mtimeMs,
      ctimeMs: this.ctimeMs,
      birthtimeMs: this.birthtimeMs,
      addedAt: this.addedAt,
      lastUpdate: this.lastUpdate,
      lastScan: this.lastScan,
      scanVersion: this.scanVersion,
      isMissing: !!this.isMissing,
      entityType: this.entityType,
      entity: this.entity.toJSON(),
      libraryFiles: this.libraryFiles.map(f => f.toJSON())
    }
  }
}
module.exports = LibraryItem