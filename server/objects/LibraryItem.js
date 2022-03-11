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
    this.updatedAt = null
    this.lastScan = null
    this.scanVersion = null

    // Entity was scanned and not found
    this.isMissing = false

    this.mediaType = null
    this.media = null

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
    this.updatedAt = libraryItem.updatedAt || this.addedAt
    this.lastScan = libraryItem.lastScan || null
    this.scanVersion = libraryItem.scanVersion || null

    this.isMissing = !!libraryItem.isMissing

    this.mediaType = libraryItem.mediaType
    if (this.mediaType === 'book') {
      this.media = new Book(libraryItem.media)
    } else if (this.mediaType === 'podcast') {
      this.media = new Podcast(libraryItem.media)
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
      updatedAt: this.updatedAt,
      lastScan: this.lastScan,
      scanVersion: this.scanVersion,
      isMissing: !!this.isMissing,
      mediaType: this.mediaType,
      media: this.media.toJSON(),
      libraryFiles: this.libraryFiles.map(f => f.toJSON())
    }
  }

  toJSONMinified() {
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
      updatedAt: this.updatedAt,
      isMissing: !!this.isMissing,
      mediaType: this.mediaType,
      media: this.media.toJSONMinified(),
      numFiles: this.libraryFiles.length
    }
  }

  // Adds additional helpful fields like media duration, tracks, etc.
  toJSONExpanded() {
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
      updatedAt: this.updatedAt,
      lastScan: this.lastScan,
      scanVersion: this.scanVersion,
      isMissing: !!this.isMissing,
      mediaType: this.mediaType,
      media: this.media.toJSONExpanded(),
      libraryFiles: this.libraryFiles.map(f => f.toJSON()),
      size: this.size
    }
  }

  get size() {
    var total = 0
    this.libraryFiles.forEach((lf) => total += lf.metadata.size)
    return total
  }
}
module.exports = LibraryItem