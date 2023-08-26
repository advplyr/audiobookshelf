const packageJson = require('../../package.json')
const { LogLevel } = require('../utils/constants')
const LibraryItem = require('../models/LibraryItem')

class LibraryItemScanData {
  constructor(data) {
    /** @type {string} */
    this.libraryFolderId = data.libraryFolderId
    /** @type {string} */
    this.libraryId = data.libraryId
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
    /** @type {{title:string, subtitle:string, series:string, sequence:string, publishedYear:string, narrators:string}} */
    this.mediaMetadata = data.mediaMetadata
    /** @type {import('../objects/files/LibraryFile')[]} */
    this.libraryFiles = data.libraryFiles

    // Set after check
    /** @type {boolean} */
    this.hasChanges
    /** @type {boolean} */
    this.hasPathChange
    /** @type {LibraryItem.LibraryFileObject[]} */
    this.libraryFilesRemoved
    /** @type {LibraryItem.LibraryFileObject[]} */
    this.libraryFilesAdded
    /** @type {LibraryItem.LibraryFileObject[]} */
    this.libraryFilesModified
  }

  /**
   * 
   * @param {LibraryItem} existingLibraryItem 
   * @param {import('./LibraryScan')} libraryScan
   */
  async checkLibraryItemData(existingLibraryItem, libraryScan) {
    const keysToCompare = ['libraryFolderId', 'ino', 'mtimeMs', 'ctimeMs', 'birthtimeMs', 'path', 'relPath', 'isFile']
    this.hasChanges = false
    this.hasPathChange = false
    for (const key of keysToCompare) {
      if (existingLibraryItem[key] !== this[key]) {
        libraryScan.addLog(LogLevel.DEBUG, `Library item "${existingLibraryItem.relPath}" key "${key}" changed from "${existingLibraryItem[key]}" to "${this[key]}"`)
        existingLibraryItem[key] = this[key]
        this.hasChanges = true

        if (key === 'relPath') {
          this.hasPathChange = true
        }
      }
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
        libraryScan.addLog(LogLevel.INFO, `Library file "${existingLibraryFile.metadata.path}" was removed from library item "${existingLibraryItem.path}"`)
        this.libraryFilesRemoved.push(existingLibraryFile)
        existingLibraryItem.libraryFiles = existingLibraryItem.libraryFiles.filter(lf => lf !== existingLibraryFile)
        this.hasChanges = true
      } else {
        libraryFilesAdded = libraryFilesAdded.filter(lf => lf !== matchingLibraryFile)
        if (this.compareUpdateLibraryFile(existingLibraryItem.path, existingLibraryFile, matchingLibraryFile, libraryScan)) {
          this.libraryFilesModified.push(existingLibraryFile)
          this.hasChanges = true
        }
      }
    }

    // Log new library files found
    if (libraryFilesAdded.length) {
      this.hasChanges = true
      for (const libraryFile of libraryFilesAdded) {
        libraryScan.addLog(LogLevel.INFO, `New library file found with path "${libraryFile.metadata.path}" for library item "${existingLibraryItem.path}"`)
        existingLibraryItem.libraryFiles.push(libraryFile.toJSON())
      }
    }

    if (this.hasChanges) {
      existingLibraryItem.lastScan = Date.now()
      existingLibraryItem.lastScanVersion = packageJson.version
      await existingLibraryItem.save()
    } else {
      libraryScan.addLog(LogLevel.DEBUG, `Library item "${existingLibraryItem.path}" is up-to-date`)
    }

    this.libraryFilesAdded = libraryFilesAdded
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
          libraryScan.addLog(LogLevel.DEBUG, `Library file "${existingLibraryFile.metadata.path}" for library item "${libraryItemPath}" key "${key}" changed from "${existingLibraryFile.metadata[key]}" to "${scannedLibraryFile.metadata[key]}"`)
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
}
module.exports = LibraryItemScanData