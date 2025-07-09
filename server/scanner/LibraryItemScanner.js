const Path = require('path')
const { LogLevel, ScanResult } = require('../utils/constants')

const fileUtils = require('../utils/fileUtils')
const scanUtils = require('../utils/scandir')
const libraryFilters = require('../utils/queries/libraryFilters')
const Logger = require('../Logger')
const Database = require('../Database')
const Watcher = require('../Watcher')
const LibraryScan = require('./LibraryScan')
const LibraryItemScanData = require('./LibraryItemScanData')
const BookScanner = require('./BookScanner')
const PodcastScanner = require('./PodcastScanner')
const ScanLogger = require('./ScanLogger')
const LibraryItem = require('../models/LibraryItem')
const LibraryFile = require('../objects/files/LibraryFile')
const SocketAuthority = require('../SocketAuthority')

class LibraryItemScanner {
  constructor() {}

  /**
   * Scan single library item
   *
   * @param {string} libraryItemId
   * @param {{relPath:string, path:string}} [updateLibraryItemDetails] used by watcher when item folder was renamed
   * @returns {number} ScanResult
   */
  async scanLibraryItem(libraryItemId, updateLibraryItemDetails = null) {
    // TODO: Add task manager
    const libraryItem = await Database.libraryItemModel.findByPk(libraryItemId)
    if (!libraryItem) {
      Logger.error(`[LibraryItemScanner] Library item not found "${libraryItemId}"`)
      return ScanResult.NOTHING
    }

    const libraryFolderId = updateLibraryItemDetails?.libraryFolderId || libraryItem.libraryFolderId
    const library = await Database.libraryModel.findByPk(libraryItem.libraryId, {
      include: {
        model: Database.libraryFolderModel,
        where: {
          id: libraryFolderId
        }
      }
    })
    if (!library) {
      Logger.error(`[LibraryItemScanner] Library "${libraryItem.libraryId}" not found for library item "${libraryItem.id}"`)
      return ScanResult.NOTHING
    }

    // Make sure library filter data is set
    //   this is used to check for existing authors & series
    await libraryFilters.getFilterData(library.mediaType, library.id)

    const scanLogger = new ScanLogger()
    scanLogger.verbose = true
    scanLogger.setData('libraryItem', updateLibraryItemDetails?.relPath || libraryItem.relPath)

    const libraryItemPath = updateLibraryItemDetails?.path || fileUtils.filePathToPOSIX(libraryItem.path)
    const folder = library.libraryFolders[0]
    const libraryItemScanData = await this.getLibraryItemScanData(libraryItemPath, library, folder, updateLibraryItemDetails?.isFile || false)

    let libraryItemDataUpdated = await libraryItemScanData.checkLibraryItemData(libraryItem, scanLogger)

    const { libraryItem: expandedLibraryItem, wasUpdated } = await this.rescanLibraryItemMedia(libraryItem, libraryItemScanData, library.settings, scanLogger)
    if (libraryItemDataUpdated || wasUpdated) {
      SocketAuthority.libraryItemEmitter('item_updated', expandedLibraryItem)

      await this.checkAuthorsAndSeriesRemovedFromBooks(library.id, scanLogger)

      return ScanResult.UPDATED
    }

    scanLogger.addLog(LogLevel.DEBUG, `Library item is up-to-date`)
    return ScanResult.UPTODATE
  }

  /**
   * Remove empty authors and series
   * @param {string} libraryId
   * @param {ScanLogger} scanLogger
   * @returns {Promise}
   */
  async checkAuthorsAndSeriesRemovedFromBooks(libraryId, scanLogger) {
    if (scanLogger.authorsRemovedFromBooks.length) {
      await BookScanner.checkAuthorsRemovedFromBooks(libraryId, scanLogger)
    }
    if (scanLogger.seriesRemovedFromBooks.length) {
      await BookScanner.checkSeriesRemovedFromBooks(libraryId, scanLogger)
    }
  }

  /**
   *
   * @param {string} libraryItemPath
   * @param {import('../models/Library')} library
   * @param {import('../models/LibraryFolder')} folder
   * @param {boolean} isSingleMediaItem
   * @returns {Promise<LibraryItemScanData>}
   */
  async getLibraryItemScanData(libraryItemPath, library, folder, isSingleMediaItem) {
    const libraryFolderPath = fileUtils.filePathToPOSIX(folder.path)
    const libraryItemDir = libraryItemPath.replace(libraryFolderPath, '').slice(1)

    let libraryItemData = {}

    let fileItems = []

    if (isSingleMediaItem) {
      // Single media item in root of folder
      fileItems = [
        {
          fullpath: libraryItemPath,
          path: libraryItemDir // actually the relPath (only filename here)
        }
      ]
      libraryItemData = {
        path: libraryItemPath, // full path
        relPath: libraryItemDir, // only filename
        mediaMetadata: {
          title: Path.basename(libraryItemDir, Path.extname(libraryItemDir))
        }
      }
    } else {
      fileItems = await fileUtils.recurseFiles(libraryItemPath)
      libraryItemData = scanUtils.getDataFromMediaDir(library.mediaType, libraryFolderPath, libraryItemDir)
    }

    const libraryFiles = []
    for (let i = 0; i < fileItems.length; i++) {
      const fileItem = fileItems[i]

      if (Watcher.checkShouldIgnoreFilePath(fileItem.fullpath)) {
        // Skip file if it's pending
        Logger.info(`[LibraryItemScanner] Skipping watcher pending file "${fileItem.fullpath}" during scan of library item path "${libraryItemPath}"`)
        continue
      }

      const newLibraryFile = new LibraryFile()
      // fileItem.path is the relative path
      await newLibraryFile.setDataFromPath(fileItem.fullpath, fileItem.path)
      libraryFiles.push(newLibraryFile)
    }

    const libraryItemStats = await fileUtils.getFileTimestampsWithIno(libraryItemData.path)
    return new LibraryItemScanData({
      libraryFolderId: folder.id,
      libraryId: library.id,
      mediaType: library.mediaType,
      ino: libraryItemStats.ino,
      mtimeMs: libraryItemStats.mtimeMs || 0,
      ctimeMs: libraryItemStats.ctimeMs || 0,
      birthtimeMs: libraryItemStats.birthtimeMs || 0,
      path: libraryItemData.path,
      relPath: libraryItemData.relPath,
      isFile: isSingleMediaItem,
      mediaMetadata: libraryItemData.mediaMetadata || null,
      libraryFiles
    })
  }

  /**
   *
   * @param {import('../models/LibraryItem')} existingLibraryItem
   * @param {LibraryItemScanData} libraryItemData
   * @param {import('../models/Library').LibrarySettingsObject} librarySettings
   * @param {LibraryScan} libraryScan
   * @returns {Promise<{libraryItem:LibraryItem, wasUpdated:boolean}>}
   */
  rescanLibraryItemMedia(existingLibraryItem, libraryItemData, librarySettings, libraryScan) {
    if (existingLibraryItem.mediaType === 'book') {
      return BookScanner.rescanExistingBookLibraryItem(existingLibraryItem, libraryItemData, librarySettings, libraryScan)
    } else {
      return PodcastScanner.rescanExistingPodcastLibraryItem(existingLibraryItem, libraryItemData, librarySettings, libraryScan)
    }
  }

  /**
   *
   * @param {LibraryItemScanData} libraryItemData
   * @param {import('../models/Library').LibrarySettingsObject} librarySettings
   * @param {LibraryScan} libraryScan
   * @returns {Promise<LibraryItem>}
   */
  async scanNewLibraryItem(libraryItemData, librarySettings, libraryScan) {
    let newLibraryItem = null
    if (libraryItemData.mediaType === 'book') {
      newLibraryItem = await BookScanner.scanNewBookLibraryItem(libraryItemData, librarySettings, libraryScan)
    } else {
      newLibraryItem = await PodcastScanner.scanNewPodcastLibraryItem(libraryItemData, librarySettings, libraryScan)
    }
    if (newLibraryItem) {
      libraryScan.addLog(LogLevel.INFO, `Created new library item "${newLibraryItem.relPath}" with id "${newLibraryItem.id}"`)
    }
    return newLibraryItem
  }

  /**
   * Scan library item folder coming from Watcher
   * @param {string} libraryItemPath
   * @param {import('../models/Library')} library
   * @param {import('../models/LibraryFolder')} folder
   * @param {boolean} isSingleMediaItem
   * @returns {Promise<LibraryItem>} ScanResult
   */
  async scanPotentialNewLibraryItem(libraryItemPath, library, folder, isSingleMediaItem) {
    const libraryItemScanData = await this.getLibraryItemScanData(libraryItemPath, library, folder, isSingleMediaItem)

    if (!libraryItemScanData.libraryFiles.length) {
      Logger.info(`[LibraryItemScanner] Library item at path "${libraryItemPath}" has no files - ignoring`)
      return null
    }

    const scanLogger = new ScanLogger()
    scanLogger.verbose = true
    scanLogger.setData('libraryItem', libraryItemScanData.relPath)

    return this.scanNewLibraryItem(libraryItemScanData, library.settings, scanLogger)
  }
}
module.exports = new LibraryItemScanner()
