const fs = require('../libs/fsExtra')
const Path = require('path')
const { version } = require('../../package.json')
const Logger = require('../Logger')
const abmetadataGenerator = require('../utils/abmetadataGenerator')
const LibraryFile = require('./files/LibraryFile')
const Book = require('./mediaTypes/Book')
const Podcast = require('./mediaTypes/Podcast')
const Video = require('./mediaTypes/Video')
const { areEquivalent, copyValue, getId, cleanStringForSearch } = require('../utils/index')

class LibraryItem {
  constructor(libraryItem = null) {
    this.id = null
    this.ino = null // Inode

    this.libraryId = null
    this.folderId = null

    this.path = null
    this.relPath = null
    this.isFile = false
    this.mtimeMs = null
    this.ctimeMs = null
    this.birthtimeMs = null
    this.addedAt = null
    this.updatedAt = null
    this.lastScan = null
    this.scanVersion = null

    // Was scanned and no longer exists
    this.isMissing = false
    // Was scanned and no longer has media files
    this.isInvalid = false

    this.mediaType = null
    this.media = null

    this.libraryFiles = []

    if (libraryItem) {
      this.construct(libraryItem)
    }

    // Temporary attributes
    this.isSavingMetadata = false
  }

  construct(libraryItem) {
    this.id = libraryItem.id
    this.ino = libraryItem.ino || null
    this.libraryId = libraryItem.libraryId
    this.folderId = libraryItem.folderId
    this.path = libraryItem.path
    this.relPath = libraryItem.relPath
    this.isFile = !!libraryItem.isFile
    this.mtimeMs = libraryItem.mtimeMs || 0
    this.ctimeMs = libraryItem.ctimeMs || 0
    this.birthtimeMs = libraryItem.birthtimeMs || 0
    this.addedAt = libraryItem.addedAt
    this.updatedAt = libraryItem.updatedAt || this.addedAt
    this.lastScan = libraryItem.lastScan || null
    this.scanVersion = libraryItem.scanVersion || null

    this.isMissing = !!libraryItem.isMissing
    this.isInvalid = !!libraryItem.isInvalid

    this.mediaType = libraryItem.mediaType
    if (this.mediaType === 'book') {
      this.media = new Book(libraryItem.media)
    } else if (this.mediaType === 'podcast') {
      this.media = new Podcast(libraryItem.media)
    } else if (this.mediaType === 'video') {
      this.media = new Video(libraryItem.media)
    }
    this.media.libraryItemId = this.id

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
      isFile: this.isFile,
      mtimeMs: this.mtimeMs,
      ctimeMs: this.ctimeMs,
      birthtimeMs: this.birthtimeMs,
      addedAt: this.addedAt,
      updatedAt: this.updatedAt,
      lastScan: this.lastScan,
      scanVersion: this.scanVersion,
      isMissing: !!this.isMissing,
      isInvalid: !!this.isInvalid,
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
      isFile: this.isFile,
      mtimeMs: this.mtimeMs,
      ctimeMs: this.ctimeMs,
      birthtimeMs: this.birthtimeMs,
      addedAt: this.addedAt,
      updatedAt: this.updatedAt,
      isMissing: !!this.isMissing,
      isInvalid: !!this.isInvalid,
      mediaType: this.mediaType,
      media: this.media.toJSONMinified(),
      numFiles: this.libraryFiles.length,
      size: this.size
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
      isFile: this.isFile,
      mtimeMs: this.mtimeMs,
      ctimeMs: this.ctimeMs,
      birthtimeMs: this.birthtimeMs,
      addedAt: this.addedAt,
      updatedAt: this.updatedAt,
      lastScan: this.lastScan,
      scanVersion: this.scanVersion,
      isMissing: !!this.isMissing,
      isInvalid: !!this.isInvalid,
      mediaType: this.mediaType,
      media: this.media.toJSONExpanded(),
      libraryFiles: this.libraryFiles.map(f => f.toJSON()),
      size: this.size
    }
  }

  get isPodcast() { return this.mediaType === 'podcast' }
  get isBook() { return this.mediaType === 'book' }
  get size() {
    var total = 0
    this.libraryFiles.forEach((lf) => total += lf.metadata.size)
    return total
  }
  get audioFileTotalSize() {
    var total = 0
    this.libraryFiles.filter(lf => lf.fileType == 'audio').forEach((lf) => total += lf.metadata.size)
    return total
  }
  get hasAudioFiles() {
    return this.libraryFiles.some(lf => lf.fileType === 'audio')
  }
  get hasMediaEntities() {
    return this.media.hasMediaEntities
  }
  get hasIssues() {
    if (this.isMissing || this.isInvalid) return true
    return this.media.hasIssues
  }

  // Data comes from scandir library item data
  setData(libraryMediaType, payload) {
    this.id = getId('li')
    this.mediaType = libraryMediaType
    if (libraryMediaType === 'video') {
      this.media = new Video()
    } else if (libraryMediaType === 'podcast') {
      this.media = new Podcast()
    } else {
      this.media = new Book()
    }
    this.media.libraryItemId = this.id

    for (const key in payload) {
      if (key === 'libraryFiles') {
        this.libraryFiles = payload.libraryFiles.map(lf => lf.clone())

        // Use first image library file as cover
        var firstImageFile = this.libraryFiles.find(lf => lf.fileType === 'image')
        if (firstImageFile) this.media.coverPath = firstImageFile.metadata.path
      } else if (this[key] !== undefined && key !== 'media') {
        this[key] = payload[key]
      }
    }

    if (payload.media) {
      this.media.setData(payload.media)
    }

    this.addedAt = Date.now()
    this.updatedAt = Date.now()
  }

  update(payload) {
    var json = this.toJSON()
    var hasUpdates = false
    for (const key in json) {
      if (payload[key] !== undefined) {
        if (key === 'media') {
          if (this.media.update(payload[key])) {
            hasUpdates = true
          }
        } else if (!areEquivalent(payload[key], json[key])) {
          this[key] = copyValue(payload[key])
          hasUpdates = true
        }
      }
    }
    if (hasUpdates) {
      this.updatedAt = Date.now()
    }
    return hasUpdates
  }

  updateMediaCover(coverPath) {
    this.media.updateCover(coverPath)
    this.updatedAt = Date.now()
    return true
  }

  setMissing() {
    this.isMissing = true
    this.updatedAt = Date.now()
  }

  setInvalid() {
    this.isInvalid = true
    this.updatedAt = Date.now()
  }

  setLastScan() {
    this.lastScan = Date.now()
    this.scanVersion = version
  }

  // Returns null if file not found, true if file was updated, false if up to date
  //  updates existing LibraryFile, AudioFile, EBookFile's
  checkFileFound(fileFound) {
    var hasUpdated = false

    var existingFile = this.libraryFiles.find(lf => lf.ino === fileFound.ino)
    var mediaFile = null
    if (!existingFile) {
      existingFile = this.libraryFiles.find(lf => lf.metadata.path === fileFound.metadata.path)
      if (existingFile) {
        // Update media file ino
        mediaFile = this.media.findFileWithInode(existingFile.ino)
        if (mediaFile) {
          mediaFile.ino = fileFound.ino
        }

        // file inode was updated
        existingFile.ino = fileFound.ino
        hasUpdated = true
      } else {
        // file not found
        return null
      }
    } else {
      mediaFile = this.media.findFileWithInode(existingFile.ino)
    }

    if (existingFile.metadata.path !== fileFound.metadata.path) {
      existingFile.metadata.path = fileFound.metadata.path
      existingFile.metadata.relPath = fileFound.metadata.relPath
      if (mediaFile) {
        mediaFile.metadata.path = fileFound.metadata.path
        mediaFile.metadata.relPath = fileFound.metadata.relPath
      }
      hasUpdated = true
    }

    // FileMetadata keys
    ['filename', 'ext', 'mtimeMs', 'ctimeMs', 'birthtimeMs', 'size'].forEach((key) => {
      if (existingFile.metadata[key] !== fileFound.metadata[key]) {
        // Add modified flag on file data object if exists and was changed
        if (key === 'mtimeMs' && existingFile.metadata[key]) {
          fileFound.metadata.wasModified = true
        }

        existingFile.metadata[key] = fileFound.metadata[key]
        if (mediaFile) {
          if (key === 'mtimeMs') mediaFile.metadata.wasModified = true
          mediaFile.metadata[key] = fileFound.metadata[key]
        }
        hasUpdated = true
      }
    })

    return hasUpdated
  }

  // Data pulled from scandir during a scan, check it with current data
  checkScanData(dataFound) {
    var hasUpdated = false

    if (this.isMissing) {
      // Item no longer missing
      this.isMissing = false
      hasUpdated = true
    }

    if (dataFound.isFile !== this.isFile && dataFound.isFile !== undefined) {
      Logger.info(`[LibraryItem] Check scan item isFile toggled from ${this.isFile} => ${dataFound.isFile}`)
      this.isFile = dataFound.isFile
      hasUpdated = true
    }

    if (dataFound.ino !== this.ino) {
      this.ino = dataFound.ino
      hasUpdated = true
    }

    if (dataFound.folderId !== this.folderId) {
      Logger.warn(`[LibraryItem] Check scan item changed folder ${this.folderId} -> ${dataFound.folderId}`)
      this.folderId = dataFound.folderId
      hasUpdated = true
    }

    if (dataFound.path !== this.path) {
      Logger.warn(`[LibraryItem] Check scan item changed path "${this.path}" -> "${dataFound.path}"`)
      this.path = dataFound.path
      this.relPath = dataFound.relPath
      hasUpdated = true
    }

    ['mtimeMs', 'ctimeMs', 'birthtimeMs'].forEach((key) => {
      if (dataFound[key] != this[key]) {
        this[key] = dataFound[key] || 0
        hasUpdated = true
      }
    })

    var newLibraryFiles = []
    var existingLibraryFiles = []

    dataFound.libraryFiles.forEach((lf) => {
      var fileFoundCheck = this.checkFileFound(lf, true)
      if (fileFoundCheck === null) {
        newLibraryFiles.push(lf)
      } else if (fileFoundCheck && lf.metadata.format !== 'abs') { // Ignore abs file updates
        hasUpdated = true
        existingLibraryFiles.push(lf)
      } else {
        existingLibraryFiles.push(lf)
      }
    })

    const filesRemoved = []

    // Remove files not found (inodes will all be up to date at this point)
    this.libraryFiles = this.libraryFiles.filter(lf => {
      if (!dataFound.libraryFiles.find(_lf => _lf.ino === lf.ino)) {
        // Check if removing cover path
        if (lf.metadata.path === this.media.coverPath) {
          Logger.debug(`[LibraryItem] "${this.media.metadata.title}" check scan cover removed`)
          this.media.updateCover('')
        }
        filesRemoved.push(lf.toJSON())
        this.media.removeFileWithInode(lf.ino)
        return false
      }
      return true
    })
    if (filesRemoved.length) {
      if (this.media.mediaType === 'book') {
        this.media.checkUpdateMissingTracks()
      }
      hasUpdated = true
    }

    // Add library files to library item
    if (newLibraryFiles.length) {
      newLibraryFiles.forEach((lf) => this.libraryFiles.push(lf.clone()))
      hasUpdated = true
    }

    // Check if invalid
    this.isInvalid = !this.media.hasMediaEntities

    // If cover path is in item folder, make sure libraryFile exists for it
    if (this.media.coverPath && this.media.coverPath.startsWith(this.path)) {
      var lf = this.libraryFiles.find(lf => lf.metadata.path === this.media.coverPath)
      if (!lf) {
        Logger.warn(`[LibraryItem] Invalid cover path - library file dne "${this.media.coverPath}"`)
        this.media.updateCover('')
        hasUpdated = true
      }
    }

    if (hasUpdated) {
      this.setLastScan()
    }

    return {
      updated: hasUpdated,
      newLibraryFiles,
      filesRemoved,
      existingLibraryFiles // Existing file data may get re-scanned if forceRescan is set
    }
  }

  // Set metadata from files
  async syncFiles(preferOpfMetadata) {
    var hasUpdated = false

    if (this.mediaType === 'book') {
      // Add/update ebook file (ebooks that were removed are removed in checkScanData)
      this.libraryFiles.forEach((lf) => {
        if (lf.fileType === 'ebook') {
          if (!this.media.ebookFile) {
            this.media.setEbookFile(lf)
            hasUpdated = true
          } else if (this.media.ebookFile.ino == lf.ino && this.media.ebookFile.updateFromLibraryFile(lf)) { // Update existing ebookFile
            hasUpdated = true
          }
        }
      })
    }

    // Set cover image if not set
    var imageFiles = this.libraryFiles.filter(lf => lf.fileType === 'image')
    if (imageFiles.length && !this.media.coverPath) {
      this.media.coverPath = imageFiles[0].metadata.path
      Logger.debug('[LibraryItem] Set media cover path', this.media.coverPath)
      hasUpdated = true
    }

    // Parse metadata files
    var textMetadataFiles = this.libraryFiles.filter(lf => lf.fileType === 'metadata' || lf.fileType === 'text')
    if (textMetadataFiles.length) {
      if (await this.media.syncMetadataFiles(textMetadataFiles, preferOpfMetadata)) {
        hasUpdated = true
      }
    }

    if (hasUpdated) {
      this.updatedAt = Date.now()
    }
    return hasUpdated
  }

  searchQuery(query) {
    query = cleanStringForSearch(query)
    return this.media.searchQuery(query)
  }

  getDirectPlayTracklist(episodeId) {
    return this.media.getDirectPlayTracklist(episodeId)
  }

  // Saves metadata.abs file
  async saveMetadata() {
    if (this.mediaType === 'video') return

    if (this.isSavingMetadata) return
    this.isSavingMetadata = true

    var metadataPath = Path.join(global.MetadataPath, 'items', this.id)
    if (global.ServerSettings.storeMetadataWithItem && !this.isFile) {
      metadataPath = this.path
    } else {
      // Make sure metadata book dir exists
      await fs.ensureDir(metadataPath)
    }
    metadataPath = Path.join(metadataPath, 'metadata.abs')

    return abmetadataGenerator.generate(this, metadataPath).then((success) => {
      this.isSavingMetadata = false
      if (!success) Logger.error(`[LibraryItem] Failed saving abmetadata to "${metadataPath}"`)
      else Logger.debug(`[LibraryItem] Success saving abmetadata to "${metadataPath}"`)
      return success
    })
  }

  removeLibraryFile(ino) {
    if (!ino) return false
    var libraryFile = this.libraryFiles.find(lf => lf.ino === ino)
    if (libraryFile) {
      this.libraryFiles = this.libraryFiles.filter(lf => lf.ino !== ino)
      this.updatedAt = Date.now()
      return true
    }
    return false
  }
}
module.exports = LibraryItem