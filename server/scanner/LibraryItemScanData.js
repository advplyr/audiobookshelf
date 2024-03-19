const packageJson = require('../../package.json')
const { LogLevel } = require('../utils/constants')
const LibraryItem = require('../models/LibraryItem')
const globals = require('../utils/globals')

class LibraryItemScanData {
  /**
   * @typedef LibraryFileModifiedObject
   * @property {LibraryItem.LibraryFileObject} old
   * @property {LibraryItem.LibraryFileObject} new
   */

  constructor(data) {
    /** @type {string} */
    this.libraryFolderId = data.libraryFolderId
    /** @type {string} */
    this.libraryId = data.libraryId
    /** @type {string} */
    this.mediaType = data.mediaType
    /** @type {string} */
    this.ino = data.ino
    /** @type {number} */
    this.mtimeMs = data.mtimeMs
    /** @type {number} */
    this.ctimeMs = data.ctimeMs
    /** @type {number} */
    this.birthtimeMs = data.birthtimeMs
    /** @type {string} */
    this.path = data.path
    /** @type {string} */
    this.relPath = data.relPath
    /** @type {boolean} */
    this.isFile = data.isFile
    /** @type {import('../utils/scandir').LibraryItemFilenameMetadata} */
    this.mediaMetadata = data.mediaMetadata
    /** @type {import('../objects/files/LibraryFile')[]} */
    this.libraryFiles = data.libraryFiles

    // Set after check
    /** @type {boolean} */
    this.hasChanges
    /** @type {boolean} */
    this.hasPathChange
    /** @type {LibraryItem.LibraryFileObject[]} */
    this.libraryFilesRemoved = []
    /** @type {LibraryItem.LibraryFileObject[]} */
    this.libraryFilesAdded = []
    /** @type {LibraryFileModifiedObject[]} */
    this.libraryFilesModified = []
  }

  /**
   * Used to create a library item
   */
  get libraryItemObject() {
    let size = 0
    this.libraryFiles.forEach((lf) => size += (!isNaN(lf.metadata.size) ? Number(lf.metadata.size) : 0))
    return {
      ino: this.ino,
      path: this.path,
      relPath: this.relPath,
      mediaType: this.mediaType,
      isFile: this.isFile,
      mtime: this.mtimeMs,
      ctime: this.ctimeMs,
      birthtime: this.birthtimeMs,
      lastScan: Date.now(),
      lastScanVersion: packageJson.version,
      libraryFiles: this.libraryFiles,
      libraryId: this.libraryId,
      libraryFolderId: this.libraryFolderId,
      size
    }
  }

  /** @type {boolean} */
  get hasLibraryFileChanges() {
    return this.libraryFilesRemoved.length + this.libraryFilesModified.length + this.libraryFilesAdded.length
  }

  /** @type {boolean} */
  get hasAudioFileChanges() {
    return (this.audioLibraryFilesRemoved.length + this.audioLibraryFilesAdded.length + this.audioLibraryFilesModified.length) > 0
  }

  /** @type {LibraryFileModifiedObject[]} */
  get audioLibraryFilesModified() {
    return this.libraryFilesModified.filter(lf => globals.SupportedAudioTypes.includes(lf.old.metadata.ext?.slice(1).toLowerCase() || ''))
  }

  /** @type {LibraryItem.LibraryFileObject[]} */
  get audioLibraryFilesRemoved() {
    return this.libraryFilesRemoved.filter(lf => globals.SupportedAudioTypes.includes(lf.metadata.ext?.slice(1).toLowerCase() || ''))
  }

  /** @type {LibraryItem.LibraryFileObject[]} */
  get audioLibraryFilesAdded() {
    return this.libraryFilesAdded.filter(lf => globals.SupportedAudioTypes.includes(lf.metadata.ext?.slice(1).toLowerCase() || ''))
  }

  /** @type {LibraryItem.LibraryFileObject[]} */
  get audioLibraryFiles() {
    return this.libraryFiles.filter(lf => globals.SupportedAudioTypes.includes(lf.metadata.ext?.slice(1).toLowerCase() || ''))
  }

  /** @type {LibraryFileModifiedObject[]} */
  get imageLibraryFilesModified() {
    return this.libraryFilesModified.filter(lf => globals.SupportedImageTypes.includes(lf.old.metadata.ext?.slice(1).toLowerCase() || ''))
  }

  /** @type {LibraryItem.LibraryFileObject[]} */
  get imageLibraryFilesRemoved() {
    return this.libraryFilesRemoved.filter(lf => globals.SupportedImageTypes.includes(lf.metadata.ext?.slice(1).toLowerCase() || ''))
  }

  /** @type {LibraryItem.LibraryFileObject[]} */
  get imageLibraryFilesAdded() {
    return this.libraryFilesAdded.filter(lf => globals.SupportedImageTypes.includes(lf.metadata.ext?.slice(1).toLowerCase() || ''))
  }

  /** @type {LibraryItem.LibraryFileObject[]} */
  get imageLibraryFiles() {
    return this.libraryFiles.filter(lf => globals.SupportedImageTypes.includes(lf.metadata.ext?.slice(1).toLowerCase() || ''))
  }

  /** @type {LibraryFileModifiedObject[]} */
  get ebookLibraryFilesModified() {
    return this.libraryFilesModified.filter(lf => globals.SupportedEbookTypes.includes(lf.old.metadata.ext?.slice(1).toLowerCase() || ''))
  }

  /** @type {LibraryItem.LibraryFileObject[]} */
  get ebookLibraryFilesRemoved() {
    return this.libraryFilesRemoved.filter(lf => globals.SupportedEbookTypes.includes(lf.metadata.ext?.slice(1).toLowerCase() || ''))
  }

  /** @type {LibraryItem.LibraryFileObject[]} */
  get ebookLibraryFilesAdded() {
    return this.libraryFilesAdded.filter(lf => globals.SupportedEbookTypes.includes(lf.metadata.ext?.slice(1).toLowerCase() || ''))
  }

  /** @type {LibraryItem.LibraryFileObject[]} */
  get ebookLibraryFiles() {
    return this.libraryFiles.filter(lf => globals.SupportedEbookTypes.includes(lf.metadata.ext?.slice(1).toLowerCase() || ''))
  }

  /** @type {LibraryItem.LibraryFileObject} */
  get descTxtLibraryFile() {
    return this.libraryFiles.find(lf => lf.metadata.filename === 'desc.txt')
  }

  /** @type {LibraryItem.LibraryFileObject} */
  get readerTxtLibraryFile() {
    return this.libraryFiles.find(lf => lf.metadata.filename === 'reader.txt')
  }

  /** @type {LibraryItem.LibraryFileObject} */
  get metadataAbsLibraryFile() {
    return this.libraryFiles.find(lf => lf.metadata.filename === 'metadata.abs')
  }

  /** @type {LibraryItem.LibraryFileObject} */
  get metadataJsonLibraryFile() {
    return this.libraryFiles.find(lf => lf.metadata.filename === 'metadata.json')
  }

  /** @type {LibraryItem.LibraryFileObject} */
  get metadataOpfLibraryFile() {
    return this.libraryFiles.find(lf => lf.metadata.ext.toLowerCase() === '.opf')
  }

  /** @type {LibraryItem.LibraryFileObject} */
  get metadataNfoLibraryFile() {
    return this.libraryFiles.find(lf => lf.metadata.ext.toLowerCase() === '.nfo')
  }

  /**
   * 
   * @param {LibraryItem} existingLibraryItem 
   * @param {import('./LibraryScan')} libraryScan
   * @returns {boolean} true if changes found
   */
  async checkLibraryItemData(existingLibraryItem, libraryScan) {
    const keysToCompare = ['libraryFolderId', 'ino', 'path', 'relPath', 'isFile']
    this.hasChanges = false
    this.hasPathChange = false
    for (const key of keysToCompare) {
      if (existingLibraryItem[key] !== this[key]) {
        libraryScan.addLog(LogLevel.DEBUG, `Library item "${existingLibraryItem.relPath}" key "${key}" changed from "${existingLibraryItem[key]}" to "${this[key]}"`)
        existingLibraryItem[key] = this[key]
        this.hasChanges = true

        if (key === 'relPath' || key === 'path') {
          this.hasPathChange = true
        }
      }
    }

    // Check mtime, ctime and birthtime
    if (existingLibraryItem.mtime?.valueOf() !== this.mtimeMs) {
      libraryScan.addLog(LogLevel.DEBUG, `Library item "${existingLibraryItem.relPath}" key "mtime" changed from "${existingLibraryItem.mtime?.valueOf()}" to "${this.mtimeMs}"`)
      existingLibraryItem.mtime = this.mtimeMs
      this.hasChanges = true
    }
    if (existingLibraryItem.birthtime?.valueOf() !== this.birthtimeMs) {
      libraryScan.addLog(LogLevel.DEBUG, `Library item "${existingLibraryItem.relPath}" key "birthtime" changed from "${existingLibraryItem.birthtime?.valueOf()}" to "${this.birthtimeMs}"`)
      existingLibraryItem.birthtime = this.birthtimeMs
      this.hasChanges = true
    }
    if (existingLibraryItem.ctime?.valueOf() !== this.ctimeMs) {
      libraryScan.addLog(LogLevel.DEBUG, `Library item "${existingLibraryItem.relPath}" key "ctime" changed from "${existingLibraryItem.ctime?.valueOf()}" to "${this.ctimeMs}"`)
      existingLibraryItem.ctime = this.ctimeMs
      this.hasChanges = true
    }
    if (existingLibraryItem.isMissing) {
      libraryScan.addLog(LogLevel.DEBUG, `Library item "${existingLibraryItem.relPath}" was missing but now found`)
      existingLibraryItem.isMissing = false
      this.hasChanges = true
    }

    this.libraryFilesRemoved = []
    this.libraryFilesModified = []
    let libraryFilesAdded = this.libraryFiles.map(lf => lf)

    for (const existingLibraryFile of existingLibraryItem.libraryFiles) {
      // Find matching library file using path first and fallback to using inode value
      let matchingLibraryFile = this.libraryFiles.find(lf => lf.metadata.path === existingLibraryFile.metadata.path)
      if (!matchingLibraryFile) {
        matchingLibraryFile = this.libraryFiles.find(lf => lf.ino === existingLibraryFile.ino)
        if (matchingLibraryFile) {
          libraryScan.addLog(LogLevel.INFO, `Library file with path "${existingLibraryFile.metadata.path}" not found, but found file with matching inode value "${existingLibraryFile.ino}" at path "${matchingLibraryFile.metadata.path}"`)
        }
      }

      if (!matchingLibraryFile) { // Library file removed
        libraryScan.addLog(LogLevel.INFO, `Library file "${existingLibraryFile.metadata.path}" was removed from library item "${existingLibraryItem.relPath}"`)
        this.libraryFilesRemoved.push(existingLibraryFile)
        existingLibraryItem.libraryFiles = existingLibraryItem.libraryFiles.filter(lf => lf !== existingLibraryFile)
        this.hasChanges = true
      } else {
        libraryFilesAdded = libraryFilesAdded.filter(lf => lf !== matchingLibraryFile)
        let existingLibraryFileBefore = structuredClone(existingLibraryFile)
        if (this.compareUpdateLibraryFile(existingLibraryItem.path, existingLibraryFile, matchingLibraryFile, libraryScan)) {
          this.libraryFilesModified.push({old: existingLibraryFileBefore, new: existingLibraryFile})
          this.hasChanges = true
        }
      }
    }

    // Log new library files found
    if (libraryFilesAdded.length) {
      this.hasChanges = true
      for (const libraryFile of libraryFilesAdded) {
        libraryScan.addLog(LogLevel.INFO, `New library file found with path "${libraryFile.metadata.path}" for library item "${existingLibraryItem.relPath}"`)
        if (libraryFile.isEBookFile) {
          // Set all new ebook files as supplementary
          libraryFile.isSupplementary = true
        }
        existingLibraryItem.libraryFiles.push(libraryFile.toJSON())
      }
    }

    this.libraryFilesAdded = libraryFilesAdded

    if (this.hasChanges) {
      existingLibraryItem.size = 0
      existingLibraryItem.libraryFiles.forEach((lf) => existingLibraryItem.size += lf.metadata.size)

      existingLibraryItem.lastScan = Date.now()
      existingLibraryItem.lastScanVersion = packageJson.version

      libraryScan.addLog(LogLevel.DEBUG, `Library item "${existingLibraryItem.relPath}" changed: [${existingLibraryItem.changed()?.join(',') || ''}]`)

      if (this.hasLibraryFileChanges) {
        existingLibraryItem.changed('libraryFiles', true)
      }
      await existingLibraryItem.save()
      return true
    }

    return false
  }

  /**
   * Update existing library file with scanned in library file data
   * @param {string} libraryItemPath
   * @param {LibraryItem.LibraryFileObject} existingLibraryFile 
   * @param {import('../objects/files/LibraryFile')} scannedLibraryFile 
   * @param {import('./LibraryScan')} libraryScan
   * @returns {boolean} false if no changes
   */
  compareUpdateLibraryFile(libraryItemPath, existingLibraryFile, scannedLibraryFile, libraryScan) {
    let hasChanges = false

    if (existingLibraryFile.ino !== scannedLibraryFile.ino) {
      existingLibraryFile.ino = scannedLibraryFile.ino
      hasChanges = true
    }

    for (const key in existingLibraryFile.metadata) {
      if (existingLibraryFile.metadata[key] !== scannedLibraryFile.metadata[key]) {
        if (key !== 'path' && key !== 'relPath') {
          libraryScan.addLog(LogLevel.DEBUG, `Library file "${existingLibraryFile.metadata.relPath}" for library item "${libraryItemPath}" key "${key}" changed from "${existingLibraryFile.metadata[key]}" to "${scannedLibraryFile.metadata[key]}"`)
        } else {
          libraryScan.addLog(LogLevel.DEBUG, `Library file for library item "${libraryItemPath}" key "${key}" changed from "${existingLibraryFile.metadata[key]}" to "${scannedLibraryFile.metadata[key]}"`)
        }
        existingLibraryFile.metadata[key] = scannedLibraryFile.metadata[key]
        hasChanges = true
      }
    }

    if (hasChanges) {
      existingLibraryFile.updatedAt = Date.now()
    }

    return hasChanges
  }

  /**
   * Check if existing audio file on Book was removed
   * @param {import('../models/Book').AudioFileObject} existingAudioFile 
   * @returns {boolean} true if audio file was removed
   */
  checkAudioFileRemoved(existingAudioFile) {
    if (!this.audioLibraryFilesRemoved.length) return false
    // First check exact path
    if (this.audioLibraryFilesRemoved.some(af => af.metadata.path === existingAudioFile.metadata.path)) {
      return true
    }
    // Fallback to check inode value
    return this.audioLibraryFilesRemoved.some(af => af.ino === existingAudioFile.ino)
  }

  /**
   * Check if existing ebook file on Book was removed
   * @param {import('../models/Book').EBookFileObject} ebookFile 
   * @returns {boolean} true if ebook file was removed
   */
  checkEbookFileRemoved(ebookFile) {
    if (!this.ebookLibraryFiles.length) return true

    if (this.ebookLibraryFiles.some(lf => lf.metadata.path === ebookFile.metadata.path)) {
      return false
    }

    return !this.ebookLibraryFiles.some(lf => lf.ino === ebookFile.ino)
  }

  /**
   * Set data parsed from filenames
   * 
   * @param {Object} bookMetadata 
   */
  setBookMetadataFromFilenames(bookMetadata) {
    const keysToMap = ['title', 'subtitle', 'publishedYear', 'asin']
    for (const key in this.mediaMetadata) {
      if (keysToMap.includes(key) && this.mediaMetadata[key]) {
        bookMetadata[key] = this.mediaMetadata[key]
      }
    }

    if (this.mediaMetadata.authors?.length) {
      bookMetadata.authors = this.mediaMetadata.authors
    }
    if (this.mediaMetadata.narrators?.length) {
      bookMetadata.narrators = this.mediaMetadata.narrators
    }
    if (this.mediaMetadata.seriesName) {
      bookMetadata.series = [
        {
          name: this.mediaMetadata.seriesName,
          sequence: this.mediaMetadata.seriesSequence || null
        }
      ]
    }
  }
}
module.exports = LibraryItemScanData