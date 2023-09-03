const Sequelize = require('sequelize')
const fs = require('../libs/fsExtra')
const Path = require('path')
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')

// Utils
const { groupFilesIntoLibraryItemPaths, getLibraryItemFileData, scanFolder, checkFilepathIsAudioFile } = require('../utils/scandir')
const { comparePaths } = require('../utils/index')
const { getIno, filePathToPOSIX } = require('../utils/fileUtils')
const { ScanResult, LogLevel } = require('../utils/constants')
const { findMatchingEpisodesInFeed, getPodcastFeed } = require('../utils/podcastUtils')

const MediaFileScanner = require('./MediaFileScanner')
const BookFinder = require('../finders/BookFinder')
const PodcastFinder = require('../finders/PodcastFinder')
const LibraryItem = require('../objects/LibraryItem')
const LibraryScan = require('./LibraryScan')
const ScanOptions = require('./ScanOptions')

const Author = require('../objects/entities/Author')
const Series = require('../objects/entities/Series')
const Task = require('../objects/Task')

class Scanner {
  constructor(coverManager, taskManager) {
    this.coverManager = coverManager
    this.taskManager = taskManager

    this.cancelLibraryScan = {}
    this.librariesScanning = []

    // Watcher file update scan vars
    this.pendingFileUpdatesToScan = []
    this.scanningFilesChanged = false

    this.bookFinder = new BookFinder()
    this.podcastFinder = new PodcastFinder()
  }

  isLibraryScanning(libraryId) {
    return this.librariesScanning.find(ls => ls.id === libraryId)
  }

  setCancelLibraryScan(libraryId) {
    var libraryScanning = this.librariesScanning.find(ls => ls.id === libraryId)
    if (!libraryScanning) return
    this.cancelLibraryScan[libraryId] = true
  }

  getScanResultDescription(result) {
    switch (result) {
      case ScanResult.ADDED:
        return 'Added to library'
      case ScanResult.NOTHING:
        return 'No updates necessary'
      case ScanResult.REMOVED:
        return 'Removed from library'
      case ScanResult.UPDATED:
        return 'Item was updated'
      case ScanResult.UPTODATE:
        return 'No updates necessary'
      default:
        return ''
    }
  }

  async scanLibraryItemByRequest(libraryItem) {
    const library = await Database.libraryModel.getOldById(libraryItem.libraryId)
    if (!library) {
      Logger.error(`[Scanner] Scan libraryItem by id library not found "${libraryItem.libraryId}"`)
      return ScanResult.NOTHING
    }
    const folder = library.folders.find(f => f.id === libraryItem.folderId)
    if (!folder) {
      Logger.error(`[Scanner] Scan libraryItem by id folder not found "${libraryItem.folderId}" in library "${library.name}"`)
      return ScanResult.NOTHING
    }
    Logger.info(`[Scanner] Scanning Library Item "${libraryItem.media.metadata.title}"`)

    const task = new Task()
    task.setData('scan-item', `Scan ${libraryItem.media.metadata.title}`, '', true, {
      libraryItemId: libraryItem.id,
      libraryId: library.id,
      mediaType: library.mediaType
    })
    this.taskManager.addTask(task)

    const result = await this.scanLibraryItem(library, folder, libraryItem)

    task.setFinished(this.getScanResultDescription(result))
    this.taskManager.taskFinished(task)

    return result
  }

  async scanLibraryItem(library, folder, libraryItem) {
    const libraryMediaType = library.mediaType

    // TODO: Support for single media item
    const libraryItemData = await getLibraryItemFileData(libraryMediaType, folder, libraryItem.path, false)
    if (!libraryItemData) {
      return ScanResult.NOTHING
    }
    let hasUpdated = false

    const checkRes = libraryItem.checkScanData(libraryItemData)
    if (checkRes.updated) hasUpdated = true

    // Sync other files first so that local images are used as cover art
    if (await libraryItem.syncFiles(Database.serverSettings.scannerPreferOpfMetadata, library.settings)) {
      hasUpdated = true
    }

    // Scan all audio files
    if (libraryItem.hasAudioFiles) {
      const libraryAudioFiles = libraryItem.libraryFiles.filter(lf => lf.fileType === 'audio')
      if (await MediaFileScanner.scanMediaFiles(libraryAudioFiles, libraryItem)) {
        hasUpdated = true
      }

      // Extract embedded cover art if cover is not already in directory
      if (libraryItem.media.hasEmbeddedCoverArt && !libraryItem.media.coverPath) {
        const coverPath = await this.coverManager.saveEmbeddedCoverArt(libraryItem)
        if (coverPath) {
          Logger.debug(`[Scanner] Saved embedded cover art "${coverPath}"`)
          hasUpdated = true
        }
      }
    }

    await this.createNewAuthorsAndSeries(libraryItem)

    // Library Item is invalid - (a book has no audio files or ebook files)
    if (!libraryItem.hasMediaEntities && libraryItem.mediaType !== 'podcast') {
      libraryItem.setInvalid()
      hasUpdated = true
    } else if (libraryItem.isInvalid) {
      libraryItem.isInvalid = false
      hasUpdated = true
    }

    if (hasUpdated) {
      await Database.updateLibraryItem(libraryItem)
      SocketAuthority.emitter('item_updated', libraryItem.toJSONExpanded())
      return ScanResult.UPDATED
    }
    return ScanResult.UPTODATE
  }

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
    libraryScan.verbose = false
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

  async scanLibrary(libraryScan) {
    let libraryItemDataFound = []

    // Scan each library
    for (let i = 0; i < libraryScan.folders.length; i++) {
      const folder = libraryScan.folders[i]
      const itemDataFoundInFolder = await scanFolder(libraryScan.library, folder)
      libraryScan.addLog(LogLevel.INFO, `${itemDataFoundInFolder.length} item data found in folder "${folder.fullPath}"`)
      libraryItemDataFound = libraryItemDataFound.concat(itemDataFoundInFolder)
    }

    if (this.cancelLibraryScan[libraryScan.libraryId]) return true

    // Remove items with no inode
    libraryItemDataFound = libraryItemDataFound.filter(lid => lid.ino)
    const libraryItemsInLibrary = Database.libraryItems.filter(li => li.libraryId === libraryScan.libraryId)

    const MaxSizePerChunk = 2.5e9
    const itemDataToRescanChunks = []
    const newItemDataToScanChunks = []
    let itemsToUpdate = []
    let itemDataToRescan = []
    let itemDataToRescanSize = 0
    let newItemDataToScan = []
    let newItemDataToScanSize = 0
    const itemsToFindCovers = []

    // Check for existing & removed library items
    for (let i = 0; i < libraryItemsInLibrary.length; i++) {
      const libraryItem = libraryItemsInLibrary[i]
      // Find library item folder with matching inode or matching path
      const dataFound = libraryItemDataFound.find(lid => lid.ino === libraryItem.ino || comparePaths(lid.relPath, libraryItem.relPath))
      if (!dataFound) {
        // Podcast folder can have no episodes and still be valid
        if (libraryScan.libraryMediaType === 'podcast' && await fs.pathExists(libraryItem.path)) {
          Logger.info(`[Scanner] Library item "${libraryItem.media.metadata.title}" folder exists but has no episodes`)
          if (libraryItem.isMissing) {
            libraryScan.resultsUpdated++
            libraryItem.isMissing = false
            libraryItem.setLastScan()
            itemsToUpdate.push(libraryItem)
          }
        } else {
          libraryScan.addLog(LogLevel.WARN, `Library Item "${libraryItem.media.metadata.title}" is missing`)
          Logger.warn(`[Scanner] Library item "${libraryItem.media.metadata.title}" is missing (inode "${libraryItem.ino}")`)
          libraryScan.resultsMissing++
          libraryItem.setMissing()
          itemsToUpdate.push(libraryItem)
        }
      } else {
        const checkRes = libraryItem.checkScanData(dataFound)
        if (checkRes.newLibraryFiles.length || libraryScan.scanOptions.forceRescan) { // Item has new files
          checkRes.libraryItem = libraryItem
          checkRes.scanData = dataFound

          // If this item will go over max size then push current chunk
          if (libraryItem.audioFileTotalSize + itemDataToRescanSize > MaxSizePerChunk && itemDataToRescan.length > 0) {
            itemDataToRescanChunks.push(itemDataToRescan)
            itemDataToRescanSize = 0
            itemDataToRescan = []
          }

          itemDataToRescan.push(checkRes)
          itemDataToRescanSize += libraryItem.audioFileTotalSize
          if (itemDataToRescanSize >= MaxSizePerChunk) {
            itemDataToRescanChunks.push(itemDataToRescan)
            itemDataToRescanSize = 0
            itemDataToRescan = []
          }

        } else if (libraryScan.findCovers && libraryItem.media.shouldSearchForCover) { // Search cover
          libraryScan.resultsUpdated++
          itemsToFindCovers.push(libraryItem)
          itemsToUpdate.push(libraryItem)
        } else if (checkRes.updated) { // Updated but no scan required
          libraryScan.resultsUpdated++
          itemsToUpdate.push(libraryItem)
        }
        libraryItemDataFound = libraryItemDataFound.filter(lid => lid.ino !== dataFound.ino)
      }
    }
    if (itemDataToRescan.length) itemDataToRescanChunks.push(itemDataToRescan)

    // Potential NEW Library Items
    for (let i = 0; i < libraryItemDataFound.length; i++) {
      const dataFound = libraryItemDataFound[i]

      const hasMediaFile = dataFound.libraryFiles.some(lf => lf.isMediaFile)
      if (!hasMediaFile) {
        libraryScan.addLog(LogLevel.WARN, `Item found "${libraryItemDataFound.path}" has no media files`)
      } else {
        // If this item will go over max size then push current chunk
        let mediaFileSize = 0
        dataFound.libraryFiles.filter(lf => lf.fileType === 'audio' || lf.fileType === 'video').forEach(lf => mediaFileSize += lf.metadata.size)
        if (mediaFileSize + newItemDataToScanSize > MaxSizePerChunk && newItemDataToScan.length > 0) {
          newItemDataToScanChunks.push(newItemDataToScan)
          newItemDataToScanSize = 0
          newItemDataToScan = []
        }

        newItemDataToScan.push(dataFound)
        newItemDataToScanSize += mediaFileSize

        if (newItemDataToScanSize >= MaxSizePerChunk) {
          newItemDataToScanChunks.push(newItemDataToScan)
          newItemDataToScanSize = 0
          newItemDataToScan = []
        }
      }
    }
    if (newItemDataToScan.length) newItemDataToScanChunks.push(newItemDataToScan)

    // Library Items not requiring a scan but require a search for cover
    for (let i = 0; i < itemsToFindCovers.length; i++) {
      const libraryItem = itemsToFindCovers[i]
      const updatedCover = await this.searchForCover(libraryItem, libraryScan)
      libraryItem.media.updateLastCoverSearch(updatedCover)
    }

    if (itemsToUpdate.length) {
      await this.updateLibraryItemChunk(itemsToUpdate)
      if (this.cancelLibraryScan[libraryScan.libraryId]) return true
    }

    // Chunking will be removed when legacy single threaded scanner is removed
    for (let i = 0; i < itemDataToRescanChunks.length; i++) {
      await this.rescanLibraryItemDataChunk(itemDataToRescanChunks[i], libraryScan)
      if (this.cancelLibraryScan[libraryScan.libraryId]) return true
    }
    for (let i = 0; i < newItemDataToScanChunks.length; i++) {
      await this.scanNewLibraryItemDataChunk(newItemDataToScanChunks[i], libraryScan)
      if (this.cancelLibraryScan[libraryScan.libraryId]) return true
    }
  }

  async updateLibraryItemChunk(itemsToUpdate) {
    await Database.updateBulkLibraryItems(itemsToUpdate)
    SocketAuthority.emitter('items_updated', itemsToUpdate.map(li => li.toJSONExpanded()))
  }

  async rescanLibraryItemDataChunk(itemDataToRescan, libraryScan) {
    var itemsUpdated = await Promise.all(itemDataToRescan.map((lid) => {
      return this.rescanLibraryItem(lid, libraryScan)
    }))

    itemsUpdated = itemsUpdated.filter(li => li) // Filter out nulls

    for (const libraryItem of itemsUpdated) {
      // Temp authors & series are inserted - create them if found
      await this.createNewAuthorsAndSeries(libraryItem)
    }

    if (itemsUpdated.length) {
      libraryScan.resultsUpdated += itemsUpdated.length
      await Database.updateBulkLibraryItems(itemsUpdated)
      SocketAuthority.emitter('items_updated', itemsUpdated.map(li => li.toJSONExpanded()))
    }
  }

  async scanNewLibraryItemDataChunk(newLibraryItemsData, libraryScan) {
    let newLibraryItems = await Promise.all(newLibraryItemsData.map((lid) => {
      return this.scanNewLibraryItem(lid, libraryScan.library, libraryScan)
    }))
    newLibraryItems = newLibraryItems.filter(li => li) // Filter out nulls

    for (const libraryItem of newLibraryItems) {
      // Temp authors & series are inserted - create them if found
      await this.createNewAuthorsAndSeries(libraryItem)
    }

    libraryScan.resultsAdded += newLibraryItems.length
    await Database.createBulkLibraryItems(newLibraryItems)
    SocketAuthority.emitter('items_added', newLibraryItems.map(li => li.toJSONExpanded()))
  }

  async rescanLibraryItem(libraryItemCheckData, libraryScan) {
    const { newLibraryFiles, filesRemoved, existingLibraryFiles, libraryItem, scanData, updated } = libraryItemCheckData
    libraryScan.addLog(LogLevel.DEBUG, `Library "${libraryScan.libraryName}" Re-scanning "${libraryItem.path}"`)
    let hasUpdated = updated

    // Sync other files first to use local images as cover before extracting audio file cover
    if (await libraryItem.syncFiles(libraryScan.preferOpfMetadata, libraryScan.library.settings)) {
      hasUpdated = true
    }

    // forceRescan all existing audio files - will probe and update ID3 tag metadata
    const existingAudioFiles = existingLibraryFiles.filter(lf => lf.fileType === 'audio')
    if (libraryScan.scanOptions.forceRescan && existingAudioFiles.length) {
      if (await MediaFileScanner.scanMediaFiles(existingAudioFiles, libraryItem, libraryScan)) {
        hasUpdated = true
      }
    }
    // Scan new audio files
    const newAudioFiles = newLibraryFiles.filter(lf => lf.fileType === 'audio')
    const removedAudioFiles = filesRemoved.filter(lf => lf.fileType === 'audio')
    if (newAudioFiles.length || removedAudioFiles.length) {
      if (await MediaFileScanner.scanMediaFiles(newAudioFiles, libraryItem, libraryScan)) {
        hasUpdated = true
      }
    }
    // If an audio file has embedded cover art and no cover is set yet, extract & use it
    if (newAudioFiles.length || libraryScan.scanOptions.forceRescan) {
      if (libraryItem.media.hasEmbeddedCoverArt && !libraryItem.media.coverPath) {
        const savedCoverPath = await this.coverManager.saveEmbeddedCoverArt(libraryItem)
        if (savedCoverPath) {
          hasUpdated = true
          libraryScan.addLog(LogLevel.DEBUG, `Saved embedded cover art "${savedCoverPath}"`)
        }
      }
    }

    // Library Item is invalid - (a book has no audio files or ebook files)
    if (!libraryItem.hasMediaEntities && libraryItem.mediaType !== 'podcast') {
      libraryItem.setInvalid()
      hasUpdated = true
    } else if (libraryItem.isInvalid) {
      libraryItem.isInvalid = false
      hasUpdated = true
    }

    // Scan for cover if enabled and has no cover (and author or title has changed OR has been 7 days since last lookup)
    if (libraryScan.findCovers && !libraryItem.media.coverPath && libraryItem.media.shouldSearchForCover) {
      const updatedCover = await this.searchForCover(libraryItem, libraryScan)
      libraryItem.media.updateLastCoverSearch(updatedCover)
      hasUpdated = true
    }

    return hasUpdated ? libraryItem : null
  }

  async scanNewLibraryItem(libraryItemData, library, libraryScan = null) {
    if (libraryScan) libraryScan.addLog(LogLevel.DEBUG, `Scanning new library item "${libraryItemData.path}"`)
    else Logger.debug(`[Scanner] Scanning new item "${libraryItemData.path}"`)

    const preferOpfMetadata = libraryScan ? !!libraryScan.preferOpfMetadata : !!global.ServerSettings.scannerPreferOpfMetadata
    const findCovers = libraryScan ? !!libraryScan.findCovers : !!global.ServerSettings.scannerFindCovers

    const libraryItem = new LibraryItem()
    libraryItem.setData(library.mediaType, libraryItemData)
    libraryItem.setLastScan()

    const mediaFiles = libraryItemData.libraryFiles.filter(lf => lf.fileType === 'audio' || lf.fileType === 'video')
    if (mediaFiles.length) {
      await MediaFileScanner.scanMediaFiles(mediaFiles, libraryItem, libraryScan)
    }

    await libraryItem.syncFiles(preferOpfMetadata, library.settings)

    if (!libraryItem.hasMediaEntities) {
      Logger.warn(`[Scanner] Library item has no media files "${libraryItemData.path}"`)
      return null
    }

    // Extract embedded cover art if cover is not already in directory
    if (libraryItem.media.hasEmbeddedCoverArt && !libraryItem.media.coverPath) {
      const coverPath = await this.coverManager.saveEmbeddedCoverArt(libraryItem)
      if (coverPath) {
        if (libraryScan) libraryScan.addLog(LogLevel.DEBUG, `Saved embedded cover art "${coverPath}"`)
        else Logger.debug(`[Scanner] Saved embedded cover art "${coverPath}"`)
      }
    }

    // Scan for cover if enabled and has no cover
    if (library.isBook) {
      if (libraryItem && findCovers && !libraryItem.media.coverPath && libraryItem.media.shouldSearchForCover) {
        const updatedCover = await this.searchForCover(libraryItem, libraryScan)
        libraryItem.media.updateLastCoverSearch(updatedCover)
      }
    }

    return libraryItem
  }

  // Any series or author object on library item with an id starting with "new"
  //   will create a new author/series OR find a matching author/series
  async createNewAuthorsAndSeries(libraryItem) {
    if (libraryItem.mediaType !== 'book') return

    // Create or match all new authors and series
    if (libraryItem.media.metadata.authors.some(au => au.id.startsWith('new'))) {
      const newAuthors = []
      libraryItem.media.metadata.authors = Promise.all(libraryItem.media.metadata.authors.map(async (tempMinAuthor) => {
        let _author = await Database.authorModel.getOldByNameAndLibrary(tempMinAuthor.name, libraryItem.libraryId)
        if (!_author) _author = newAuthors.find(au => au.libraryId === libraryItem.libraryId && au.checkNameEquals(tempMinAuthor.name)) // Check new unsaved authors
        if (!_author) { // Must create new author
          _author = new Author()
          _author.setData(tempMinAuthor, libraryItem.libraryId)
          newAuthors.push(_author)
          // Update filter data
          Database.addAuthorToFilterData(libraryItem.libraryId, _author.name, _author.id)
        }

        return {
          id: _author.id,
          name: _author.name
        }
      }))
      if (newAuthors.length) {
        await Database.createBulkAuthors(newAuthors)
        SocketAuthority.emitter('authors_added', newAuthors.map(au => au.toJSON()))
      }
    }
    if (libraryItem.media.metadata.series.some(se => se.id.startsWith('new'))) {
      const newSeries = []
      libraryItem.media.metadata.series = await Promise.all(libraryItem.media.metadata.series.map(async (tempMinSeries) => {
        let _series = await Database.seriesModel.getOldByNameAndLibrary(tempMinSeries.name, libraryItem.libraryId)
        if (!_series) {
          // Check new unsaved series
          _series = newSeries.find(se => se.libraryId === libraryItem.libraryId && se.checkNameEquals(tempMinSeries.name))
        }

        if (!_series) { // Must create new series
          _series = new Series()
          _series.setData(tempMinSeries, libraryItem.libraryId)
          newSeries.push(_series)
          // Update filter data
          Database.addSeriesToFilterData(libraryItem.libraryId, _series.name, _series.id)
        }
        return {
          id: _series.id,
          name: _series.name,
          sequence: tempMinSeries.sequence
        }
      }))
      if (newSeries.length) {
        await Database.createBulkSeries(newSeries)
        SocketAuthority.emitter('multiple_series_added', newSeries.map(se => se.toJSON()))
      }
    }
  }

  getFileUpdatesGrouped(fileUpdates) {
    var folderGroups = {}
    fileUpdates.forEach((file) => {
      if (folderGroups[file.folderId]) {
        folderGroups[file.folderId].fileUpdates.push(file)
      } else {
        folderGroups[file.folderId] = {
          libraryId: file.libraryId,
          folderId: file.folderId,
          fileUpdates: [file]
        }
      }
    })
    return folderGroups
  }

  async scanFilesChanged(fileUpdates) {
    if (!fileUpdates?.length) return

    // If already scanning files from watcher then add these updates to queue
    if (this.scanningFilesChanged) {
      this.pendingFileUpdatesToScan.push(fileUpdates)
      Logger.debug(`[Scanner] Already scanning files from watcher - file updates pushed to queue (size ${this.pendingFileUpdatesToScan.length})`)
      return
    }
    this.scanningFilesChanged = true

    // files grouped by folder
    const folderGroups = this.getFileUpdatesGrouped(fileUpdates)

    for (const folderId in folderGroups) {
      const libraryId = folderGroups[folderId].libraryId
      const library = await Database.libraryModel.getOldById(libraryId)
      if (!library) {
        Logger.error(`[Scanner] Library not found in files changed ${libraryId}`)
        continue
      }
      const folder = library.getFolderById(folderId)
      if (!folder) {
        Logger.error(`[Scanner] Folder is not in library in files changed "${folderId}", Library "${library.name}"`)
        continue
      }
      const relFilePaths = folderGroups[folderId].fileUpdates.map(fileUpdate => fileUpdate.relPath)
      const fileUpdateGroup = groupFilesIntoLibraryItemPaths(library.mediaType, relFilePaths, false)

      if (!Object.keys(fileUpdateGroup).length) {
        Logger.info(`[Scanner] No important changes to scan for in folder "${folderId}"`)
        continue
      }
      const folderScanResults = await this.scanFolderUpdates(library, folder, fileUpdateGroup)
      Logger.debug(`[Scanner] Folder scan results`, folderScanResults)

      // If something was updated then reset numIssues filter data for library
      if (Object.values(folderScanResults).some(scanResult => scanResult !== ScanResult.NOTHING && scanResult !== ScanResult.UPTODATE)) {
        await Database.resetLibraryIssuesFilterData(libraryId)
      }
    }

    this.scanningFilesChanged = false

    if (this.pendingFileUpdatesToScan.length) {
      Logger.debug(`[Scanner] File updates finished scanning with more updates in queue (${this.pendingFileUpdatesToScan.length})`)
      this.scanFilesChanged(this.pendingFileUpdatesToScan.shift())
    }
  }

  async scanFolderUpdates(library, folder, fileUpdateGroup) {
    Logger.debug(`[Scanner] Scanning file update groups in folder "${folder.id}" of library "${library.name}"`)
    Logger.debug(`[Scanner] scanFolderUpdates fileUpdateGroup`, fileUpdateGroup)

    // First pass - Remove files in parent dirs of items and remap the fileupdate group
    //    Test Case: Moving audio files from library item folder to author folder should trigger a re-scan of the item
    const updateGroup = { ...fileUpdateGroup }
    for (const itemDir in updateGroup) {
      if (itemDir == fileUpdateGroup[itemDir]) continue // Media in root path

      const itemDirNestedFiles = fileUpdateGroup[itemDir].filter(b => b.includes('/'))
      if (!itemDirNestedFiles.length) continue

      const firstNest = itemDirNestedFiles[0].split('/').shift()
      const altDir = `${itemDir}/${firstNest}`

      const fullPath = Path.posix.join(filePathToPOSIX(folder.fullPath), itemDir)
      const childLibraryItem = await Database.libraryItemModel.findOne({
        attributes: ['id', 'path'],
        where: {
          path: {
            [Sequelize.Op.not]: fullPath
          },
          path: {
            [Sequelize.Op.startsWith]: fullPath
          }
        }
      })
      if (!childLibraryItem) {
        continue
      }

      const altFullPath = Path.posix.join(filePathToPOSIX(folder.fullPath), altDir)
      const altChildLibraryItem = await Database.libraryItemModel.findOne({
        attributes: ['id', 'path'],
        where: {
          path: {
            [Sequelize.Op.not]: altFullPath
          },
          path: {
            [Sequelize.Op.startsWith]: altFullPath
          }
        }
      })
      if (altChildLibraryItem) {
        continue
      }

      delete fileUpdateGroup[itemDir]
      fileUpdateGroup[altDir] = itemDirNestedFiles.map((f) => f.split('/').slice(1).join('/'))
      Logger.warn(`[Scanner] Some files were modified in a parent directory of a library item "${childLibraryItem.path}" - ignoring`)
    }

    // Second pass: Check for new/updated/removed items
    const itemGroupingResults = {}
    for (const itemDir in fileUpdateGroup) {
      const fullPath = Path.posix.join(filePathToPOSIX(folder.fullPath), itemDir)
      const dirIno = await getIno(fullPath)

      const itemDirParts = itemDir.split('/').slice(0, -1)
      const potentialChildDirs = []
      for (let i = 0; i < itemDirParts.length; i++) {
        potentialChildDirs.push(Path.posix.join(filePathToPOSIX(folder.fullPath), itemDir.split('/').slice(0, -1 - i).join('/')))
      }

      // Check if book dir group is already an item
      let existingLibraryItem = await Database.libraryItemModel.findOneOld({
        path: potentialChildDirs
      })

      if (!existingLibraryItem) {
        existingLibraryItem = await Database.libraryItemModel.findOneOld({
          ino: dirIno
        })
        if (existingLibraryItem) {
          Logger.debug(`[Scanner] scanFolderUpdates: Library item found by inode value=${dirIno}. "${existingLibraryItem.relPath} => ${itemDir}"`)
          // Update library item paths for scan and all library item paths will get updated in LibraryItem.checkScanData
          existingLibraryItem.path = fullPath
          existingLibraryItem.relPath = itemDir
        }
      }
      if (existingLibraryItem) {
        // Is the item exactly - check if was deleted
        if (existingLibraryItem.path === fullPath) {
          const exists = await fs.pathExists(fullPath)
          if (!exists) {
            Logger.info(`[Scanner] Scanning file update group and library item was deleted "${existingLibraryItem.media.metadata.title}" - marking as missing`)
            existingLibraryItem.setMissing()
            await Database.updateLibraryItem(existingLibraryItem)
            SocketAuthority.emitter('item_updated', existingLibraryItem.toJSONExpanded())

            itemGroupingResults[itemDir] = ScanResult.REMOVED
            continue
          }
        }

        // Scan library item for updates
        Logger.debug(`[Scanner] Folder update for relative path "${itemDir}" is in library item "${existingLibraryItem.media.metadata.title}" - scan for updates`)
        itemGroupingResults[itemDir] = await this.scanLibraryItem(library, folder, existingLibraryItem)
        continue
      } else if (library.settings.audiobooksOnly && !fileUpdateGroup[itemDir].some?.(checkFilepathIsAudioFile)) {
        Logger.debug(`[Scanner] Folder update for relative path "${itemDir}" has no audio files`)
        continue
      }

      // Check if a library item is a subdirectory of this dir
      const childItem = await Database.libraryItemModel.findOne({
        attributes: ['id', 'path'],
        where: {
          path: {
            [Sequelize.Op.startsWith]: fullPath + '/'
          }
        }
      })
      if (childItem) {
        Logger.warn(`[Scanner] Files were modified in a parent directory of a library item "${childItem.path}" - ignoring`)
        itemGroupingResults[itemDir] = ScanResult.NOTHING
        continue
      }

      Logger.debug(`[Scanner] Folder update group must be a new item "${itemDir}" in library "${library.name}"`)
      var isSingleMediaItem = itemDir === fileUpdateGroup[itemDir]
      var newLibraryItem = await this.scanPotentialNewLibraryItem(library, folder, fullPath, isSingleMediaItem)
      if (newLibraryItem) {
        await this.createNewAuthorsAndSeries(newLibraryItem)
        await Database.createLibraryItem(newLibraryItem)
        SocketAuthority.emitter('item_added', newLibraryItem.toJSONExpanded())
      }
      itemGroupingResults[itemDir] = newLibraryItem ? ScanResult.ADDED : ScanResult.NOTHING
    }

    return itemGroupingResults
  }

  async scanPotentialNewLibraryItem(library, folder, fullPath, isSingleMediaItem = false) {
    const libraryItemData = await getLibraryItemFileData(library.mediaType, folder, fullPath, isSingleMediaItem)
    if (!libraryItemData) return null
    return this.scanNewLibraryItem(libraryItemData, library)
  }

  async searchForCover(libraryItem, libraryScan = null) {
    const options = {
      titleDistance: 2,
      authorDistance: 2
    }
    const scannerCoverProvider = Database.serverSettings.scannerCoverProvider
    const results = await this.bookFinder.findCovers(scannerCoverProvider, libraryItem.media.metadata.title, libraryItem.media.metadata.authorName, options)
    if (results.length) {
      if (libraryScan) libraryScan.addLog(LogLevel.DEBUG, `Found best cover for "${libraryItem.media.metadata.title}"`)
      else Logger.debug(`[Scanner] Found best cover for "${libraryItem.media.metadata.title}"`)

      // If the first cover result fails, attempt to download the second
      for (let i = 0; i < results.length && i < 2; i++) {

        // Downloads and updates the book cover
        const result = await this.coverManager.downloadCoverFromUrl(libraryItem, results[i])

        if (result.error) {
          Logger.error(`[Scanner] Failed to download cover from url "${results[i]}" | Attempt ${i + 1}`, result.error)
        } else {
          return true
        }
      }
    }
    return false
  }

  async quickMatchLibraryItem(libraryItem, options = {}) {
    var provider = options.provider || 'google'
    var searchTitle = options.title || libraryItem.media.metadata.title
    var searchAuthor = options.author || libraryItem.media.metadata.authorName
    var overrideDefaults = options.overrideDefaults || false

    // Set to override existing metadata if scannerPreferMatchedMetadata setting is true and 
    // the overrideDefaults option is not set or set to false.
    if ((overrideDefaults == false) && (Database.serverSettings.scannerPreferMatchedMetadata)) {
      options.overrideCover = true
      options.overrideDetails = true
    }

    var updatePayload = {}
    var hasUpdated = false

    if (libraryItem.isBook) {
      var searchISBN = options.isbn || libraryItem.media.metadata.isbn
      var searchASIN = options.asin || libraryItem.media.metadata.asin

      var results = await this.bookFinder.search(provider, searchTitle, searchAuthor, searchISBN, searchASIN)
      if (!results.length) {
        return {
          warning: `No ${provider} match found`
        }
      }
      var matchData = results[0]

      // Update cover if not set OR overrideCover flag
      if (matchData.cover && (!libraryItem.media.coverPath || options.overrideCover)) {
        Logger.debug(`[Scanner] Updating cover "${matchData.cover}"`)
        var coverResult = await this.coverManager.downloadCoverFromUrl(libraryItem, matchData.cover)
        if (!coverResult || coverResult.error || !coverResult.cover) {
          Logger.warn(`[Scanner] Match cover "${matchData.cover}" failed to use: ${coverResult ? coverResult.error : 'Unknown Error'}`)
        } else {
          hasUpdated = true
        }
      }

      updatePayload = await this.quickMatchBookBuildUpdatePayload(libraryItem, matchData, options)
    } else if (libraryItem.isPodcast) { // Podcast quick match
      var results = await this.podcastFinder.search(searchTitle)
      if (!results.length) {
        return {
          warning: `No ${provider} match found`
        }
      }
      var matchData = results[0]

      // Update cover if not set OR overrideCover flag
      if (matchData.cover && (!libraryItem.media.coverPath || options.overrideCover)) {
        Logger.debug(`[Scanner] Updating cover "${matchData.cover}"`)
        var coverResult = await this.coverManager.downloadCoverFromUrl(libraryItem, matchData.cover)
        if (!coverResult || coverResult.error || !coverResult.cover) {
          Logger.warn(`[Scanner] Match cover "${matchData.cover}" failed to use: ${coverResult ? coverResult.error : 'Unknown Error'}`)
        } else {
          hasUpdated = true
        }
      }

      updatePayload = this.quickMatchPodcastBuildUpdatePayload(libraryItem, matchData, options)
    }

    if (Object.keys(updatePayload).length) {
      Logger.debug('[Scanner] Updating details', updatePayload)
      if (libraryItem.media.update(updatePayload)) {
        hasUpdated = true
      }
    }

    if (hasUpdated) {
      if (libraryItem.isPodcast && libraryItem.media.metadata.feedUrl) { // Quick match all unmatched podcast episodes
        await this.quickMatchPodcastEpisodes(libraryItem, options)
      }

      await Database.updateLibraryItem(libraryItem)
      SocketAuthority.emitter('item_updated', libraryItem.toJSONExpanded())
    }

    return {
      updated: hasUpdated,
      libraryItem: libraryItem.toJSONExpanded()
    }
  }

  quickMatchPodcastBuildUpdatePayload(libraryItem, matchData, options) {
    const updatePayload = {}
    updatePayload.metadata = {}

    const matchDataTransformed = {
      title: matchData.title || null,
      author: matchData.artistName || null,
      genres: matchData.genres || [],
      itunesId: matchData.id || null,
      itunesPageUrl: matchData.pageUrl || null,
      itunesArtistId: matchData.artistId || null,
      releaseDate: matchData.releaseDate || null,
      imageUrl: matchData.cover || null,
      feedUrl: matchData.feedUrl || null,
      description: matchData.descriptionPlain || null
    }

    for (const key in matchDataTransformed) {
      if (matchDataTransformed[key]) {
        if (key === 'genres') {
          if ((!libraryItem.media.metadata.genres.length || options.overrideDetails)) {
            var genresArray = []
            if (Array.isArray(matchDataTransformed[key])) genresArray = [...matchDataTransformed[key]]
            else { // Genres should always be passed in as an array but just incase handle a string
              Logger.warn(`[Scanner] quickMatch genres is not an array ${matchDataTransformed[key]}`)
              genresArray = matchDataTransformed[key].split(',').map(v => v.trim()).filter(v => !!v)
            }
            updatePayload.metadata[key] = genresArray
          }
        } else if (libraryItem.media.metadata[key] !== matchDataTransformed[key] && (!libraryItem.media.metadata[key] || options.overrideDetails)) {
          updatePayload.metadata[key] = matchDataTransformed[key]
        }
      }
    }

    if (!Object.keys(updatePayload.metadata).length) {
      delete updatePayload.metadata
    }

    return updatePayload
  }

  async quickMatchBookBuildUpdatePayload(libraryItem, matchData, options) {
    // Update media metadata if not set OR overrideDetails flag
    const detailKeysToUpdate = ['title', 'subtitle', 'description', 'narrator', 'publisher', 'publishedYear', 'genres', 'tags', 'language', 'explicit', 'abridged', 'asin', 'isbn']
    const updatePayload = {}
    updatePayload.metadata = {}

    for (const key in matchData) {
      if (matchData[key] && detailKeysToUpdate.includes(key)) {
        if (key === 'narrator') {
          if ((!libraryItem.media.metadata.narratorName || options.overrideDetails)) {
            updatePayload.metadata.narrators = matchData[key].split(',').map(v => v.trim()).filter(v => !!v)
          }
        } else if (key === 'genres') {
          if ((!libraryItem.media.metadata.genres.length || options.overrideDetails)) {
            var genresArray = []
            if (Array.isArray(matchData[key])) genresArray = [...matchData[key]]
            else { // Genres should always be passed in as an array but just incase handle a string
              Logger.warn(`[Scanner] quickMatch genres is not an array ${matchData[key]}`)
              genresArray = matchData[key].split(',').map(v => v.trim()).filter(v => !!v)
            }
            updatePayload.metadata[key] = genresArray
          }
        } else if (key === 'tags') {
          if ((!libraryItem.media.tags.length || options.overrideDetails)) {
            var tagsArray = []
            if (Array.isArray(matchData[key])) tagsArray = [...matchData[key]]
            else tagsArray = matchData[key].split(',').map(v => v.trim()).filter(v => !!v)
            updatePayload[key] = tagsArray
          }
        } else if ((!libraryItem.media.metadata[key] || options.overrideDetails)) {
          updatePayload.metadata[key] = matchData[key]
        }
      }
    }

    // Add or set author if not set
    if (matchData.author && (!libraryItem.media.metadata.authorName || options.overrideDetails)) {
      if (!Array.isArray(matchData.author)) {
        matchData.author = matchData.author.split(',').map(au => au.trim()).filter(au => !!au)
      }
      const authorPayload = []
      for (const authorName of matchData.author) {
        let author = await Database.authorModel.getOldByNameAndLibrary(authorName, libraryItem.libraryId)
        if (!author) {
          author = new Author()
          author.setData({ name: authorName }, libraryItem.libraryId)
          await Database.createAuthor(author)
          SocketAuthority.emitter('author_added', author.toJSON())
          // Update filter data
          Database.addAuthorToFilterData(libraryItem.libraryId, author.name, author.id)
        }
        authorPayload.push(author.toJSONMinimal())
      }
      updatePayload.metadata.authors = authorPayload
    }

    // Add or set series if not set
    if (matchData.series && (!libraryItem.media.metadata.seriesName || options.overrideDetails)) {
      if (!Array.isArray(matchData.series)) matchData.series = [{ series: matchData.series, sequence: matchData.sequence }]
      const seriesPayload = []
      for (const seriesMatchItem of matchData.series) {
        let seriesItem = await Database.seriesModel.getOldByNameAndLibrary(seriesMatchItem.series, libraryItem.libraryId)
        if (!seriesItem) {
          seriesItem = new Series()
          seriesItem.setData({ name: seriesMatchItem.series }, libraryItem.libraryId)
          await Database.createSeries(seriesItem)
          // Update filter data
          Database.addSeriesToFilterData(libraryItem.libraryId, seriesItem.name, seriesItem.id)
          SocketAuthority.emitter('series_added', seriesItem.toJSON())
        }
        seriesPayload.push(seriesItem.toJSONMinimal(seriesMatchItem.sequence))
      }
      updatePayload.metadata.series = seriesPayload
    }

    if (!Object.keys(updatePayload.metadata).length) {
      delete updatePayload.metadata
    }

    return updatePayload
  }

  async quickMatchPodcastEpisodes(libraryItem, options = {}) {
    const episodesToQuickMatch = libraryItem.media.episodes.filter(ep => !ep.enclosureUrl) // Only quick match episodes without enclosure
    if (!episodesToQuickMatch.length) return false

    const feed = await getPodcastFeed(libraryItem.media.metadata.feedUrl)
    if (!feed) {
      Logger.error(`[Scanner] quickMatchPodcastEpisodes: Unable to quick match episodes feed not found for "${libraryItem.media.metadata.feedUrl}"`)
      return false
    }

    let numEpisodesUpdated = 0
    for (const episode of episodesToQuickMatch) {
      const episodeMatches = findMatchingEpisodesInFeed(feed, episode.title)
      if (episodeMatches && episodeMatches.length) {
        const wasUpdated = this.updateEpisodeWithMatch(libraryItem, episode, episodeMatches[0].episode, options)
        if (wasUpdated) numEpisodesUpdated++
      }
    }
    return numEpisodesUpdated
  }

  updateEpisodeWithMatch(libraryItem, episode, episodeToMatch, options = {}) {
    Logger.debug(`[Scanner] quickMatchPodcastEpisodes: Found episode match for "${episode.title}" => ${episodeToMatch.title}`)
    const matchDataTransformed = {
      title: episodeToMatch.title || '',
      subtitle: episodeToMatch.subtitle || '',
      description: episodeToMatch.description || '',
      enclosure: episodeToMatch.enclosure || null,
      episode: episodeToMatch.episode || '',
      episodeType: episodeToMatch.episodeType || 'full',
      season: episodeToMatch.season || '',
      pubDate: episodeToMatch.pubDate || '',
      publishedAt: episodeToMatch.publishedAt
    }
    const updatePayload = {}
    for (const key in matchDataTransformed) {
      if (matchDataTransformed[key]) {
        if (key === 'enclosure') {
          if (!episode.enclosure || JSON.stringify(episode.enclosure) !== JSON.stringify(matchDataTransformed.enclosure)) {
            updatePayload[key] = {
              ...matchDataTransformed.enclosure
            }
          }
        } else if (episode[key] !== matchDataTransformed[key] && (!episode[key] || options.overrideDetails)) {
          updatePayload[key] = matchDataTransformed[key]
        }
      }
    }

    if (Object.keys(updatePayload).length) {
      return libraryItem.media.updateEpisode(episode.id, updatePayload)
    }
    return false
  }

  async matchLibraryItems(library) {
    if (library.mediaType === 'podcast') {
      Logger.error(`[Scanner] matchLibraryItems: Match all not supported for podcasts yet`)
      return
    }

    if (this.isLibraryScanning(library.id)) {
      Logger.error(`[Scanner] matchLibraryItems: Already scanning ${library.id}`)
      return
    }

    const itemsInLibrary = Database.libraryItems.filter(li => li.libraryId === library.id)
    if (!itemsInLibrary.length) {
      Logger.error(`[Scanner] matchLibraryItems: Library has no items ${library.id}`)
      return
    }

    const provider = library.provider

    var libraryScan = new LibraryScan()
    libraryScan.setData(library, null, 'match')
    this.librariesScanning.push(libraryScan.getScanEmitData)
    SocketAuthority.emitter('scan_start', libraryScan.getScanEmitData)

    Logger.info(`[Scanner] matchLibraryItems: Starting library match scan ${libraryScan.id} for ${libraryScan.libraryName}`)

    for (let i = 0; i < itemsInLibrary.length; i++) {
      var libraryItem = itemsInLibrary[i]

      if (libraryItem.media.metadata.asin && library.settings.skipMatchingMediaWithAsin) {
        Logger.debug(`[Scanner] matchLibraryItems: Skipping "${libraryItem.media.metadata.title
          }" because it already has an ASIN (${i + 1} of ${itemsInLibrary.length})`)
        continue;
      }

      if (libraryItem.media.metadata.isbn && library.settings.skipMatchingMediaWithIsbn) {
        Logger.debug(`[Scanner] matchLibraryItems: Skipping "${libraryItem.media.metadata.title
          }" because it already has an ISBN (${i + 1} of ${itemsInLibrary.length})`)
        continue;
      }

      Logger.debug(`[Scanner] matchLibraryItems: Quick matching "${libraryItem.media.metadata.title}" (${i + 1} of ${itemsInLibrary.length})`)
      var result = await this.quickMatchLibraryItem(libraryItem, { provider })
      if (result.warning) {
        Logger.warn(`[Scanner] matchLibraryItems: Match warning ${result.warning} for library item "${libraryItem.media.metadata.title}"`)
      } else if (result.updated) {
        libraryScan.resultsUpdated++
      }

      if (this.cancelLibraryScan[libraryScan.libraryId]) {
        Logger.info(`[Scanner] matchLibraryItems: Library match scan canceled for "${libraryScan.libraryName}"`)
        delete this.cancelLibraryScan[libraryScan.libraryId]
        var scanData = libraryScan.getScanEmitData
        scanData.results = null
        SocketAuthority.emitter('scan_complete', scanData)
        this.librariesScanning = this.librariesScanning.filter(ls => ls.id !== library.id)
        return
      }
    }

    this.librariesScanning = this.librariesScanning.filter(ls => ls.id !== library.id)
    SocketAuthority.emitter('scan_complete', libraryScan.getScanEmitData)
  }

  probeAudioFile(audioFile) {
    return MediaFileScanner.probeAudioFile(audioFile)
  }
}
module.exports = Scanner
