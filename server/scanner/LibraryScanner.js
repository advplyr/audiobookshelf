const sequelize = require('sequelize')
const Path = require('path')
const packageJson = require('../../package.json')
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')
const fs = require('../libs/fsExtra')
const fileUtils = require('../utils/fileUtils')
const scanUtils = require('../utils/scandir')
const { LogLevel } = require('../utils/constants')
const libraryFilters = require('../utils/queries/libraryFilters')
const LibraryItemScanner = require('./LibraryItemScanner')
const ScanOptions = require('./ScanOptions')
const LibraryScan = require('./LibraryScan')
const LibraryItemScanData = require('./LibraryItemScanData')

class LibraryScanner {
  constructor() {
    this.cancelLibraryScan = {}
    this.librariesScanning = []
  }

  /**
   * @param {string} libraryId 
   * @returns {boolean}
   */
  isLibraryScanning(libraryId) {
    return this.librariesScanning.some(ls => ls.id === libraryId)
  }

  /**
   * 
   * @param {import('../objects/Library')} library 
   * @param {*} options 
   */
  async scan(library, options = {}) {
    if (this.isLibraryScanning(library.id)) {
      Logger.error(`[Scanner] Already scanning ${library.id}`)
      return
    }

    if (!library.folders.length) {
      Logger.warn(`[Scanner] Library has no folders to scan "${library.name}"`)
      return
    }

    const scanOptions = new ScanOptions()
    scanOptions.setData(options, Database.serverSettings)

    const libraryScan = new LibraryScan()
    libraryScan.setData(library, scanOptions)
    libraryScan.verbose = true
    this.librariesScanning.push(libraryScan.getScanEmitData)

    SocketAuthority.emitter('scan_start', libraryScan.getScanEmitData)

    Logger.info(`[Scanner] Starting library scan ${libraryScan.id} for ${libraryScan.libraryName}`)

    const canceled = await this.scanLibrary(libraryScan)

    if (canceled) {
      Logger.info(`[Scanner] Library scan canceled for "${libraryScan.libraryName}"`)
      delete this.cancelLibraryScan[libraryScan.libraryId]
    }

    libraryScan.setComplete()

    Logger.info(`[Scanner] Library scan ${libraryScan.id} completed in ${libraryScan.elapsedTimestamp} | ${libraryScan.resultStats}`)
    this.librariesScanning = this.librariesScanning.filter(ls => ls.id !== library.id)

    if (canceled && !libraryScan.totalResults) {
      const emitData = libraryScan.getScanEmitData
      emitData.results = null
      SocketAuthority.emitter('scan_complete', emitData)
      return
    }

    SocketAuthority.emitter('scan_complete', libraryScan.getScanEmitData)

    if (libraryScan.totalResults) {
      libraryScan.saveLog()
    }
  }

  /**
   * 
   * @param {import('./LibraryScan')} libraryScan 
   * @returns {boolean} true if scan canceled
   */
  async scanLibrary(libraryScan) {
    // Make sure library filter data is set
    //   this is used to check for existing authors & series
    await libraryFilters.getFilterData(libraryScan.library.mediaType, libraryScan.libraryId)

    /** @type {LibraryItemScanData[]} */
    let libraryItemDataFound = []

    // Scan each library folder
    for (let i = 0; i < libraryScan.folders.length; i++) {
      const folder = libraryScan.folders[i]
      const itemDataFoundInFolder = await this.scanFolder(libraryScan.library, folder)
      libraryScan.addLog(LogLevel.INFO, `${itemDataFoundInFolder.length} item data found in folder "${folder.fullPath}"`)
      libraryItemDataFound = libraryItemDataFound.concat(itemDataFoundInFolder)
    }

    if (this.cancelLibraryScan[libraryScan.libraryId]) return true

    const existingLibraryItems = await Database.libraryItemModel.findAll({
      where: {
        libraryId: libraryScan.libraryId
      }
    })

    if (this.cancelLibraryScan[libraryScan.libraryId]) return true

    const libraryItemIdsMissing = []
    let oldLibraryItemsUpdated = []
    for (const existingLibraryItem of existingLibraryItems) {
      // First try to find matching library item with exact file path
      let libraryItemData = libraryItemDataFound.find(lid => lid.path === existingLibraryItem.path)
      if (!libraryItemData) {
        // Fallback to finding matching library item with matching inode value
        libraryItemData = libraryItemDataFound.find(lid => lid.ino === existingLibraryItem.ino)
        if (libraryItemData) {
          libraryScan.addLog(LogLevel.INFO, `Library item with path "${existingLibraryItem.path}" was not found, but library item inode "${existingLibraryItem.ino}" was found at path "${libraryItemData.path}"`)
        }
      }

      if (!libraryItemData) {
        // Podcast folder can have no episodes and still be valid
        if (libraryScan.libraryMediaType === 'podcast' && await fs.pathExists(existingLibraryItem.path)) {
          libraryScan.addLog(LogLevel.INFO, `Library item "${existingLibraryItem.relPath}" folder exists but has no episodes`)
        } else {
          libraryScan.addLog(LogLevel.WARN, `Library Item "${existingLibraryItem.path}" (inode: ${existingLibraryItem.ino}) is missing`)
          libraryScan.resultsMissing++
          if (!existingLibraryItem.isMissing) {
            libraryItemIdsMissing.push(existingLibraryItem.id)

            // TODO: Temporary while using old model to socket emit
            const oldLibraryItem = await Database.libraryItemModel.getOldById(existingLibraryItem.id)
            oldLibraryItem.isMissing = true
            oldLibraryItem.updatedAt = Date.now()
            oldLibraryItemsUpdated.push(oldLibraryItem)
          }
        }
      } else {
        libraryItemDataFound = libraryItemDataFound.filter(lidf => lidf !== libraryItemData)
        if (await libraryItemData.checkLibraryItemData(existingLibraryItem, libraryScan)) {
          libraryScan.resultsUpdated++
          if (libraryItemData.hasLibraryFileChanges || libraryItemData.hasPathChange) {
            const libraryItem = await LibraryItemScanner.rescanLibraryItem(existingLibraryItem, libraryItemData, libraryScan.library.settings, libraryScan)
            const oldLibraryItem = Database.libraryItemModel.getOldLibraryItem(libraryItem)
            oldLibraryItemsUpdated.push(oldLibraryItem)
          } else {
            // TODO: Temporary while using old model to socket emit
            const oldLibraryItem = await Database.libraryItemModel.getOldById(existingLibraryItem.id)
            oldLibraryItemsUpdated.push(oldLibraryItem)
          }
        }
      }

      // Emit item updates in chunks of 10 to client
      if (oldLibraryItemsUpdated.length === 10) {
        // TODO: Should only emit to clients where library item is accessible
        SocketAuthority.emitter('items_updated', oldLibraryItemsUpdated.map(li => li.toJSONExpanded()))
        oldLibraryItemsUpdated = []
      }

      if (this.cancelLibraryScan[libraryScan.libraryId]) return true
    }
    // Emit item updates to client
    if (oldLibraryItemsUpdated.length) {
      // TODO: Should only emit to clients where library item is accessible
      SocketAuthority.emitter('items_updated', oldLibraryItemsUpdated.map(li => li.toJSONExpanded()))
    }

    // Authors and series that were removed from books should be removed if they are now empty
    await LibraryItemScanner.checkAuthorsAndSeriesRemovedFromBooks(libraryScan.libraryId, libraryScan)

    // Update missing library items
    if (libraryItemIdsMissing.length) {
      libraryScan.addLog(LogLevel.INFO, `Updating ${libraryItemIdsMissing.length} library items missing`)
      await Database.libraryItemModel.update({
        isMissing: true,
        lastScan: Date.now(),
        lastScanVersion: packageJson.version
      }, {
        where: {
          id: libraryItemIdsMissing
        }
      })
    }

    if (this.cancelLibraryScan[libraryScan.libraryId]) return true

    // Add new library items
    if (libraryItemDataFound.length) {
      let newOldLibraryItems = []
      for (const libraryItemData of libraryItemDataFound) {
        const newLibraryItem = await LibraryItemScanner.scanNewLibraryItem(libraryItemData, libraryScan.library.settings, libraryScan)
        if (newLibraryItem) {
          const oldLibraryItem = Database.libraryItemModel.getOldLibraryItem(newLibraryItem)
          newOldLibraryItems.push(oldLibraryItem)

          libraryScan.resultsAdded++
        }

        // Emit new items in chunks of 10 to client
        if (newOldLibraryItems.length === 10) {
          // TODO: Should only emit to clients where library item is accessible
          SocketAuthority.emitter('items_added', newOldLibraryItems.map(li => li.toJSONExpanded()))
          newOldLibraryItems = []
        }

        if (this.cancelLibraryScan[libraryScan.libraryId]) return true
      }
      // Emit new items to client
      if (newOldLibraryItems.length) {
        // TODO: Should only emit to clients where library item is accessible
        SocketAuthority.emitter('items_added', newOldLibraryItems.map(li => li.toJSONExpanded()))
      }
    }
  }

  /**
   * Get scan data for library folder
   * @param {import('../objects/Library')} library 
   * @param {import('../objects/Folder')} folder 
   * @returns {LibraryItemScanData[]}
   */
  async scanFolder(library, folder) {
    const folderPath = fileUtils.filePathToPOSIX(folder.fullPath)

    const pathExists = await fs.pathExists(folderPath)
    if (!pathExists) {
      Logger.error(`[scandir] Invalid folder path does not exist "${folderPath}"`)
      return []
    }

    const fileItems = await fileUtils.recurseFiles(folderPath)
    const libraryItemGrouping = scanUtils.groupFileItemsIntoLibraryItemDirs(library.mediaType, fileItems, library.settings.audiobooksOnly)

    if (!Object.keys(libraryItemGrouping).length) {
      Logger.error(`Root path has no media folders: ${folderPath}`)
      return []
    }

    const items = []
    for (const libraryItemPath in libraryItemGrouping) {
      let isFile = false // item is not in a folder
      let libraryItemData = null
      let fileObjs = []
      if (libraryItemPath === libraryItemGrouping[libraryItemPath]) {
        // Media file in root only get title
        libraryItemData = {
          mediaMetadata: {
            title: Path.basename(libraryItemPath, Path.extname(libraryItemPath))
          },
          path: Path.posix.join(folderPath, libraryItemPath),
          relPath: libraryItemPath
        }
        fileObjs = await scanUtils.buildLibraryFile(folderPath, [libraryItemPath])
        isFile = true
      } else {
        libraryItemData = scanUtils.getDataFromMediaDir(library.mediaType, folderPath, libraryItemPath)
        fileObjs = await scanUtils.buildLibraryFile(libraryItemData.path, libraryItemGrouping[libraryItemPath])
      }

      const libraryItemFolderStats = await fileUtils.getFileTimestampsWithIno(libraryItemData.path)

      if (!libraryItemFolderStats.ino) {
        Logger.warn(`[LibraryScanner] Library item folder "${libraryItemData.path}" has no inode value`)
        continue
      }

      items.push(new LibraryItemScanData({
        libraryFolderId: folder.id,
        libraryId: folder.libraryId,
        mediaType: library.mediaType,
        ino: libraryItemFolderStats.ino,
        mtimeMs: libraryItemFolderStats.mtimeMs || 0,
        ctimeMs: libraryItemFolderStats.ctimeMs || 0,
        birthtimeMs: libraryItemFolderStats.birthtimeMs || 0,
        path: libraryItemData.path,
        relPath: libraryItemData.relPath,
        isFile,
        mediaMetadata: libraryItemData.mediaMetadata || null,
        libraryFiles: fileObjs
      }))
    }
    return items
  }
}
module.exports = new LibraryScanner()