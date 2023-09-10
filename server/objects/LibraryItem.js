const uuidv4 = require("uuid").v4
const fs = require('../libs/fsExtra')
const Path = require('path')
const { version } = require('../../package.json')
const Logger = require('../Logger')
const abmetadataGenerator = require('../utils/generators/abmetadataGenerator')
const LibraryFile = require('./files/LibraryFile')
const Book = require('./mediaTypes/Book')
const Podcast = require('./mediaTypes/Podcast')
const Video = require('./mediaTypes/Video')
const Music = require('./mediaTypes/Music')
const { areEquivalent, copyValue, cleanStringForSearch } = require('../utils/index')
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
    } else if (this.mediaType === 'video') {
      this.media = new Video(libraryItem.media)
    } else if (this.mediaType === 'music') {
      this.media = new Music(libraryItem.media)
    }
    this.media.libraryItemId = this.id

    this.libraryFiles = libraryItem.libraryFiles.map(f => new LibraryFile(f))

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
      libraryFiles: this.libraryFiles.map(f => f.toJSON())
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
      libraryFiles: this.libraryFiles.map(f => f.toJSON()),
      size: this.size
    }
  }

  get isPodcast() { return this.mediaType === 'podcast' }
  get isBook() { return this.mediaType === 'book' }
  get isMusic() { return this.mediaType === 'music' }
  get size() {
    let total = 0
    this.libraryFiles.forEach((lf) => total += lf.metadata.size)
    return total
  }
  get audioFileTotalSize() {
    let total = 0
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
    this.id = uuidv4()
    this.mediaType = libraryMediaType
    if (libraryMediaType === 'video') {
      this.media = new Video()
    } else if (libraryMediaType === 'podcast') {
      this.media = new Podcast()
    } else if (libraryMediaType === 'book') {
      this.media = new Book()
    } else if (libraryMediaType === 'music') {
      this.media = new Music()
    }
    this.media.id = uuidv4()
    this.media.libraryItemId = this.id

    for (const key in payload) {
      if (key === 'libraryFiles') {
        this.libraryFiles = payload.libraryFiles.map(lf => lf.clone())

        // Set cover image
        const imageFiles = this.libraryFiles.filter(lf => lf.fileType === 'image')
        const coverMatch = imageFiles.find(iFile => /\/cover\.[^.\/]*$/.test(iFile.metadata.path))
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

  setInvalid() {
    this.isInvalid = true
    this.updatedAt = Date.now()
  }

  setLastScan() {
    this.lastScan = Date.now()
    this.updatedAt = Date.now()
    this.scanVersion = version
  }

  // Returns null if file not found, true if file was updated, false if up to date
  //  updates existing LibraryFile, AudioFile, EBookFile's
  checkFileFound(fileFound) {
    let hasUpdated = false

    let existingFile = this.libraryFiles.find(lf => lf.ino === fileFound.ino)
    let mediaFile = null
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

  searchQuery(query) {
    query = cleanStringForSearch(query)
    return this.media.searchQuery(query)
  }

  getDirectPlayTracklist(episodeId) {
    return this.media.getDirectPlayTracklist(episodeId)
  }

  /**
   * Save metadata.json/metadata.abs file
   * @returns {Promise<LibraryFile>} null if not saved
   */
  async saveMetadata() {
    if (this.isSavingMetadata) return null

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

    const metadataFileFormat = global.ServerSettings.metadataFileFormat
    const metadataFilePath = Path.join(metadataPath, `metadata.${metadataFileFormat}`)
    if (metadataFileFormat === 'json') {
      // Remove metadata.abs if it exists
      if (await fs.pathExists(Path.join(metadataPath, `metadata.abs`))) {
        Logger.debug(`[LibraryItem] Removing metadata.abs for item "${this.media.metadata.title}"`)
        await fs.remove(Path.join(metadataPath, `metadata.abs`))
        this.libraryFiles = this.libraryFiles.filter(lf => lf.metadata.path !== filePathToPOSIX(Path.join(metadataPath, `metadata.abs`)))
      }

      return fs.writeFile(metadataFilePath, JSON.stringify(this.media.toJSONForMetadataFile(), null, 2)).then(async () => {
        // Add metadata.json to libraryFiles array if it is new
        let metadataLibraryFile = this.libraryFiles.find(lf => lf.metadata.path === filePathToPOSIX(metadataFilePath))
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
      }).catch((error) => {
        Logger.error(`[LibraryItem] Failed to save json file at "${metadataFilePath}"`, error)
        return null
      }).finally(() => {
        this.isSavingMetadata = false
      })
    } else {
      // Remove metadata.json if it exists
      if (await fs.pathExists(Path.join(metadataPath, `metadata.json`))) {
        Logger.debug(`[LibraryItem] Removing metadata.json for item "${this.media.metadata.title}"`)
        await fs.remove(Path.join(metadataPath, `metadata.json`))
        this.libraryFiles = this.libraryFiles.filter(lf => lf.metadata.path !== filePathToPOSIX(Path.join(metadataPath, `metadata.json`)))
      }

      return abmetadataGenerator.generate(this, metadataFilePath).then(async (success) => {
        if (!success) {
          Logger.error(`[LibraryItem] Failed saving abmetadata to "${metadataFilePath}"`)
          return null
        }
        // Add metadata.abs to libraryFiles array if it is new
        let metadataLibraryFile = this.libraryFiles.find(lf => lf.metadata.path === filePathToPOSIX(metadataFilePath))
        if (storeMetadataWithItem) {
          if (!metadataLibraryFile) {
            metadataLibraryFile = new LibraryFile()
            await metadataLibraryFile.setDataFromPath(metadataFilePath, `metadata.abs`)
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
      }).finally(() => {
        this.isSavingMetadata = false
      })
    }
  }

  removeLibraryFile(ino) {
    if (!ino) return false
    const libraryFile = this.libraryFiles.find(lf => lf.ino === ino)
    if (libraryFile) {
      this.libraryFiles = this.libraryFiles.filter(lf => lf.ino !== ino)
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
    const ebookLibraryFiles = this.libraryFiles.filter(lf => lf.isEBookFile)
    for (const libraryFile of ebookLibraryFiles) {
      libraryFile.isSupplementary = ebookLibraryFile?.ino !== libraryFile.ino
    }
    this.media.setEbookFile(ebookLibraryFile)
  }
}
module.exports = LibraryItem