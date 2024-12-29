const uuidv4 = require('uuid').v4
const fs = require('../libs/fsExtra')
const Path = require('path')
const Logger = require('../Logger')
const LibraryFile = require('./files/LibraryFile')
const Book = require('./mediaTypes/Book')
const Podcast = require('./mediaTypes/Podcast')
const { areEquivalent, copyValue } = require('../utils/index')
const { filePathToPOSIX, getFileTimestampsWithIno } = require('../utils/fileUtils')

class LibraryItem {
  constructor(libraryItem = null) {
    this.id = null
    this.ino = null // Inode
    this.oldLibraryItemId = null

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

    /** @type {LibraryFile[]} */
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
    this.oldLibraryItemId = libraryItem.oldLibraryItemId
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
    }
    this.media.libraryItemId = this.id

    this.libraryFiles = libraryItem.libraryFiles.map((f) => new LibraryFile(f))

    // Migration for v2.2.23 to set ebook library files as supplementary
    if (this.isBook && this.media.ebookFile) {
      for (const libraryFile of this.libraryFiles) {
        if (libraryFile.isEBookFile && libraryFile.isSupplementary === null) {
          libraryFile.isSupplementary = this.media.ebookFile.ino !== libraryFile.ino
        }
      }
    }
  }

  toJSON() {
    return {
      id: this.id,
      ino: this.ino,
      oldLibraryItemId: this.oldLibraryItemId,
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
      libraryFiles: this.libraryFiles.map((f) => f.toJSON())
    }
  }

  toJSONMinified() {
    return {
      id: this.id,
      ino: this.ino,
      oldLibraryItemId: this.oldLibraryItemId,
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
      oldLibraryItemId: this.oldLibraryItemId,
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
      libraryFiles: this.libraryFiles.map((f) => f.toJSON()),
      size: this.size
    }
  }

  get isPodcast() {
    return this.mediaType === 'podcast'
  }
  get isBook() {
    return this.mediaType === 'book'
  }
  get size() {
    let total = 0
    this.libraryFiles.forEach((lf) => (total += lf.metadata.size))
    return total
  }
  get hasAudioFiles() {
    return this.libraryFiles.some((lf) => lf.fileType === 'audio')
  }
  get hasMediaEntities() {
    return this.media.hasMediaEntities
  }

  // Data comes from scandir library item data
  // TODO: Remove this function. Only used when creating a new podcast now
  setData(libraryMediaType, payload) {
    this.id = uuidv4()
    this.mediaType = libraryMediaType
    if (libraryMediaType === 'podcast') {
      this.media = new Podcast()
    } else {
      Logger.error(`[LibraryItem] setData called with unsupported media type "${libraryMediaType}"`)
      return
    }
    this.media.id = uuidv4()
    this.media.libraryItemId = this.id

    for (const key in payload) {
      if (key === 'libraryFiles') {
        this.libraryFiles = payload.libraryFiles.map((lf) => lf.clone())

        // Set cover image
        const imageFiles = this.libraryFiles.filter((lf) => lf.fileType === 'image')
        const coverMatch = imageFiles.find((iFile) => /\/cover\.[^.\/]*$/.test(iFile.metadata.path))
        if (coverMatch) {
          this.media.coverPath = coverMatch.metadata.path
        } else if (imageFiles.length) {
          this.media.coverPath = imageFiles[0].metadata.path
        }
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
    const json = this.toJSON()
    let hasUpdates = false
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

  getDirectPlayTracklist(episodeId) {
    return this.media.getDirectPlayTracklist(episodeId)
  }

  /**
   * Save metadata.json file
   * TODO: Move to new LibraryItem model
   * @returns {Promise<LibraryFile>} null if not saved
   */
  async saveMetadata() {
    if (this.isSavingMetadata || !global.MetadataPath) return null

    this.isSavingMetadata = true

    let metadataPath = Path.join(global.MetadataPath, 'items', this.id)
    let storeMetadataWithItem = global.ServerSettings.storeMetadataWithItem
    if (storeMetadataWithItem && !this.isFile) {
      metadataPath = this.path
    } else {
      // Make sure metadata book dir exists
      storeMetadataWithItem = false
      await fs.ensureDir(metadataPath)
    }

    const metadataFilePath = Path.join(metadataPath, `metadata.${global.ServerSettings.metadataFileFormat}`)

    return fs
      .writeFile(metadataFilePath, JSON.stringify(this.media.toJSONForMetadataFile(), null, 2))
      .then(async () => {
        // Add metadata.json to libraryFiles array if it is new
        let metadataLibraryFile = this.libraryFiles.find((lf) => lf.metadata.path === filePathToPOSIX(metadataFilePath))
        if (storeMetadataWithItem) {
          if (!metadataLibraryFile) {
            metadataLibraryFile = new LibraryFile()
            await metadataLibraryFile.setDataFromPath(metadataFilePath, `metadata.json`)
            this.libraryFiles.push(metadataLibraryFile)
          } else {
            const fileTimestamps = await getFileTimestampsWithIno(metadataFilePath)
            if (fileTimestamps) {
              metadataLibraryFile.metadata.mtimeMs = fileTimestamps.mtimeMs
              metadataLibraryFile.metadata.ctimeMs = fileTimestamps.ctimeMs
              metadataLibraryFile.metadata.size = fileTimestamps.size
              metadataLibraryFile.ino = fileTimestamps.ino
            }
          }
          const libraryItemDirTimestamps = await getFileTimestampsWithIno(this.path)
          if (libraryItemDirTimestamps) {
            this.mtimeMs = libraryItemDirTimestamps.mtimeMs
            this.ctimeMs = libraryItemDirTimestamps.ctimeMs
          }
        }

        Logger.debug(`[LibraryItem] Success saving abmetadata to "${metadataFilePath}"`)

        return metadataLibraryFile
      })
      .catch((error) => {
        Logger.error(`[LibraryItem] Failed to save json file at "${metadataFilePath}"`, error)
        return null
      })
      .finally(() => {
        this.isSavingMetadata = false
      })
  }

  removeLibraryFile(ino) {
    if (!ino) return false
    const libraryFile = this.libraryFiles.find((lf) => lf.ino === ino)
    if (libraryFile) {
      this.libraryFiles = this.libraryFiles.filter((lf) => lf.ino !== ino)
      this.updatedAt = Date.now()
      return true
    }
    return false
  }

  /**
   * Set the EBookFile from a LibraryFile
   * If null then ebookFile will be removed from the book
   * all ebook library files that are not primary are marked as supplementary
   *
   * @param {LibraryFile} [libraryFile]
   */
  setPrimaryEbook(ebookLibraryFile = null) {
    const ebookLibraryFiles = this.libraryFiles.filter((lf) => lf.isEBookFile)
    for (const libraryFile of ebookLibraryFiles) {
      libraryFile.isSupplementary = ebookLibraryFile?.ino !== libraryFile.ino
    }
    this.media.setEbookFile(ebookLibraryFile)
  }
}
module.exports = LibraryItem
