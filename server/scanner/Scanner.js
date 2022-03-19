const fs = require('fs-extra')
const Path = require('path')

// Utils
const Logger = require('../Logger')
const { groupFilesIntoLibraryItemPaths, getLibraryItemFileData, scanFolder } = require('../utils/scandir')
const { comparePaths } = require('../utils/index')
const { ScanResult, LogLevel } = require('../utils/constants')

const AudioFileScanner = require('./AudioFileScanner')
const BookFinder = require('../finders/BookFinder')
const LibraryItem = require('../objects/LibraryItem')
const LibraryScan = require('./LibraryScan')
const ScanOptions = require('./ScanOptions')

const Author = require('../objects/entities/Author')
const Series = require('../objects/entities/Series')

class Scanner {
  constructor(db, coverController, emitter) {
    this.ScanLogPath = Path.posix.join(global.MetadataPath, 'logs', 'scans')

    this.db = db
    this.coverController = coverController
    this.emitter = emitter

    this.cancelLibraryScan = {}
    this.librariesScanning = []

    this.bookFinder = new BookFinder()
  }

  isLibraryScanning(libraryId) {
    return this.librariesScanning.find(ls => ls.id === libraryId)
  }

  setCancelLibraryScan(libraryId) {
    var libraryScanning = this.librariesScanning.find(ls => ls.id === libraryId)
    if (!libraryScanning) return
    this.cancelLibraryScan[libraryId] = true
  }

  async scanLibraryItemById(libraryItemId) {
    var libraryItem = this.db.libraryItems.find(li => li.id === libraryItemId)
    if (!libraryItem) {
      Logger.error(`[Scanner] Scan libraryItem by id not found ${libraryItemId}`)
      return ScanResult.NOTHING
    }
    const library = this.db.libraries.find(lib => lib.id === libraryItem.libraryId)
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
    return this.scanLibraryItem(library.mediaType, folder, libraryItem)
  }

  async scanLibraryItem(libraryMediaType, folder, libraryItem) {
    var libraryItemData = await getLibraryItemFileData(libraryMediaType, folder, libraryItem.path, this.db.serverSettings)
    if (!libraryItemData) {
      return ScanResult.NOTHING
    }
    var hasUpdated = false

    var checkRes = libraryItem.checkScanData(libraryItemData)
    if (checkRes.updated) hasUpdated = true

    // Sync other files first so that local images are used as cover art
    if (await libraryItem.syncFiles(this.db.serverSettings.scannerPreferOpfMetadata)) {
      hasUpdated = true
    }

    // Scan all audio files
    if (libraryItem.hasAudioFiles) {
      var libraryAudioFiles = libraryItem.libraryFiles.filter(lf => lf.fileType === 'audio')
      if (await AudioFileScanner.scanAudioFiles(libraryAudioFiles, libraryItemData, libraryItem, this.db.serverSettings.scannerPreferAudioMetadata)) {
        hasUpdated = true
      }

      // Extract embedded cover art if cover is not already in directory
      if (libraryItem.media.hasEmbeddedCoverArt && !libraryItem.media.coverPath) {
        var coverPath = await this.coverController.saveEmbeddedCoverArt(libraryItem)
        if (coverPath) {
          Logger.debug(`[Scanner] Saved embedded cover art "${coverPath}"`)
          hasUpdated = true
        }
      }
    }

    await this.createNewAuthorsAndSeries(libraryItem)

    if (!libraryItem.hasMediaEntities) { // Library Item is invalid
      libraryItem.setInvalid()
      hasUpdated = true
    } else if (libraryItem.isInvalid) {
      libraryItem.isInvalid = false
      hasUpdated = true
    }

    if (hasUpdated) {
      this.emitter('item_updated', libraryItem.toJSONExpanded())
      await this.db.updateLibraryItem(libraryItem)
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

    var scanOptions = new ScanOptions()
    scanOptions.setData(options, this.db.serverSettings)

    var libraryScan = new LibraryScan()
    libraryScan.setData(library, scanOptions)
    libraryScan.verbose = false
    this.librariesScanning.push(libraryScan.getScanEmitData)

    this.emitter('scan_start', libraryScan.getScanEmitData)

    Logger.info(`[Scanner] Starting library scan ${libraryScan.id} for ${libraryScan.libraryName}`)

    var canceled = await this.scanLibrary(libraryScan)

    if (canceled) {
      Logger.info(`[Scanner] Library scan canceled for "${libraryScan.libraryName}"`)
      delete this.cancelLibraryScan[libraryScan.libraryId]
    }

    libraryScan.setComplete()

    Logger.info(`[Scanner] Library scan ${libraryScan.id} completed in ${libraryScan.elapsedTimestamp} | ${libraryScan.resultStats}`)
    this.librariesScanning = this.librariesScanning.filter(ls => ls.id !== library.id)

    if (canceled && !libraryScan.totalResults) {
      var emitData = libraryScan.getScanEmitData
      emitData.results = null
      this.emitter('scan_complete', emitData)
      return
    }

    this.emitter('scan_complete', libraryScan.getScanEmitData)

    if (libraryScan.totalResults) {
      libraryScan.saveLog(this.ScanLogPath)
    }
  }

  async scanLibrary(libraryScan) {
    var libraryItemDataFound = []

    // Scan each library
    for (let i = 0; i < libraryScan.folders.length; i++) {
      var folder = libraryScan.folders[i]
      var itemDataFoundInFolder = await scanFolder(libraryScan.libraryMediaType, folder, this.db.serverSettings)
      libraryScan.addLog(LogLevel.INFO, `${itemDataFoundInFolder.length} item data found in folder "${folder.fullPath}"`)
      libraryItemDataFound = libraryItemDataFound.concat(itemDataFoundInFolder)
    }

    if (this.cancelLibraryScan[libraryScan.libraryId]) return true

    // Remove audiobooks with no inode
    libraryItemDataFound = libraryItemDataFound.filter(lid => lid.ino)
    var libraryItemsInLibrary = this.db.libraryItems.filter(li => li.libraryId === libraryScan.libraryId)

    const MaxSizePerChunk = 2.5e9
    const itemDataToRescanChunks = []
    const newItemDataToScanChunks = []
    var itemsToUpdate = []
    var itemDataToRescan = []
    var itemDataToRescanSize = 0
    var newItemDataToScan = []
    var newItemDataToScanSize = 0
    var itemsToFindCovers = []

    // Check for existing & removed library items
    for (let i = 0; i < libraryItemsInLibrary.length; i++) {
      var libraryItem = libraryItemsInLibrary[i]
      // Find library item folder with matching inode or matching path
      var dataFound = libraryItemDataFound.find(lid => lid.ino === libraryItem.ino || comparePaths(lid.relPath, libraryItem.relPath))
      if (!dataFound) {
        libraryScan.addLog(LogLevel.WARN, `Library Item "${libraryItem.media.metadata.title}" is missing`)
        libraryScan.resultsMissing++
        libraryItem.setMissing()
        itemsToUpdate.push(libraryItem)
      } else {
        var checkRes = libraryItem.checkScanData(dataFound)
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
      var dataFound = libraryItemDataFound[i]

      var hasMediaFile = dataFound.libraryFiles.some(lf => lf.isMediaFile)
      if (!hasMediaFile) {
        libraryScan.addLog(LogLevel.WARN, `Directory found "${libraryItemDataFound.path}" has no media files`)
      } else {
        var audioFileSize = 0
        dataFound.libraryFiles.filter(lf => lf.fileType == 'audio').forEach(lf => audioFileSize += lf.metadata.size)

        // If this item will go over max size then push current chunk
        if (audioFileSize + newItemDataToScanSize > MaxSizePerChunk && newItemDataToScan.length > 0) {
          newItemDataToScanChunks.push(newItemDataToScan)
          newItemDataToScanSize = 0
          newItemDataToScan = []
        }

        newItemDataToScan.push(dataFound)
        newItemDataToScanSize += audioFileSize
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
      var libraryItem = itemsToFindCovers[i]
      var updatedCover = await this.searchForCover(libraryItem, libraryScan)
      libraryItem.media.updateLastCoverSearch(updatedCover)
    }

    if (itemsToUpdate.length) {
      await this.updateLibraryItemChunk(itemsToUpdate)
      if (this.cancelLibraryScan[libraryScan.libraryId]) return true
    }
    for (let i = 0; i < itemDataToRescanChunks.length; i++) {
      await this.rescanLibraryItemDataChunk(itemDataToRescanChunks[i], libraryScan)
      if (this.cancelLibraryScan[libraryScan.libraryId]) return true
      // console.log('Rescan chunk done', i, 'of', itemDataToRescanChunks.length)
    }
    for (let i = 0; i < newItemDataToScanChunks.length; i++) {
      await this.scanNewLibraryItemDataChunk(newItemDataToScanChunks[i], libraryScan)
      // console.log('New scan chunk done', i, 'of', newItemDataToScanChunks.length)
      if (this.cancelLibraryScan[libraryScan.libraryId]) return true
    }
  }

  async updateLibraryItemChunk(itemsToUpdate) {
    await this.db.updateLibraryItems(itemsToUpdate)
    this.emitter('items_updated', itemsToUpdate.map(li => li.toJSONExpanded()))
  }

  async rescanLibraryItemDataChunk(itemDataToRescan, libraryScan) {
    var itemsUpdated = await Promise.all(itemDataToRescan.map((lid) => {
      return this.rescanLibraryItem(lid, libraryScan)
    }))

    for (const libraryItem of itemsUpdated) {
      // Temp authors & series are inserted - create them if found
      await this.createNewAuthorsAndSeries(libraryItem)
    }

    itemsUpdated = itemsUpdated.filter(li => li) // Filter out nulls
    if (itemsUpdated.length) {
      libraryScan.resultsUpdated += itemsUpdated.length
      await this.db.updateLibraryItems(itemsUpdated)
      this.emitter('items_updated', itemsUpdated.map(li => li.toJSONExpanded()))
    }
  }

  async scanNewLibraryItemDataChunk(newLibraryItemsData, libraryScan) {
    var newLibraryItems = await Promise.all(newLibraryItemsData.map((lid) => {
      return this.scanNewLibraryItem(lid, libraryScan.libraryMediaType, libraryScan.preferAudioMetadata, libraryScan.preferOpfMetadata, libraryScan.findCovers, libraryScan)
    }))
    newLibraryItems = newLibraryItems.filter(li => li) // Filter out nulls

    for (const libraryItem of newLibraryItems) {
      // Temp authors & series are inserted - create them if found
      await this.createNewAuthorsAndSeries(libraryItem)
    }

    libraryScan.resultsAdded += newLibraryItems.length
    await this.db.insertLibraryItems(newLibraryItems)
    this.emitter('items_added', newLibraryItems.map(li => li.toJSONExpanded()))
  }

  async rescanLibraryItem(libraryItemCheckData, libraryScan) {
    const { newLibraryFiles, filesRemoved, existingLibraryFiles, libraryItem, scanData, updated } = libraryItemCheckData
    libraryScan.addLog(LogLevel.DEBUG, `Library "${libraryScan.libraryName}" Re-scanning "${libraryItem.path}"`)
    var hasUpdated = updated

    // Sync other files first to use local images as cover before extracting audio file cover
    if (await libraryItem.syncFiles(libraryScan.preferOpfMetadata)) {
      hasUpdated = true
    }

    // forceRescan all existing audio files - will probe and update ID3 tag metadata
    var existingAudioFiles = existingLibraryFiles.filter(lf => lf.fileType === 'audio')
    if (libraryScan.scanOptions.forceRescan && existingAudioFiles.length) {
      if (await AudioFileScanner.scanAudioFiles(existingAudioFiles, scanData, libraryItem, libraryScan.preferAudioMetadata, libraryScan)) {
        hasUpdated = true
      }
    }
    // Scan new audio files
    var newAudioFiles = newLibraryFiles.filter(lf => lf.fileType === 'audio')
    var removedAudioFiles = filesRemoved.filter(lf => lf.fileType === 'audio')
    if (newAudioFiles.length || removedAudioFiles.length) {
      if (await AudioFileScanner.scanAudioFiles(newAudioFiles, scanData, libraryItem, libraryScan.preferAudioMetadata, libraryScan)) {
        hasUpdated = true
      }
    }
    // If an audio file has embedded cover art and no cover is set yet, extract & use it
    if (newAudioFiles.length || libraryScan.scanOptions.forceRescan) {
      if (libraryItem.media.hasEmbeddedCoverArt && !libraryItem.media.coverPath) {
        var savedCoverPath = await this.coverController.saveEmbeddedCoverArt(libraryItem)
        if (savedCoverPath) {
          hasUpdated = true
          libraryScan.addLog(LogLevel.DEBUG, `Saved embedded cover art "${savedCoverPath}"`)
        }
      }
    }

    if (!libraryItem.hasMediaEntities) { // Library item is invalid
      libraryItem.setInvalid()
      hasUpdated = true
    } else if (libraryItem.isInvalid) {
      libraryItem.isInvalid = false
      hasUpdated = true
    }

    // Scan for cover if enabled and has no cover (and author or title has changed OR has been 7 days since last lookup)
    if (libraryScan.findCovers && !libraryItem.media.coverPath && libraryItem.media.shouldSearchForCover) {
      var updatedCover = await this.searchForCover(libraryItem, libraryScan)
      libraryItem.media.updateLastCoverSearch(updatedCover)
      hasUpdated = true
    }

    return hasUpdated ? libraryItem : null
  }

  async scanNewLibraryItem(libraryItemData, libraryMediaType, preferAudioMetadata, preferOpfMetadata, findCovers, libraryScan = null) {
    if (libraryScan) libraryScan.addLog(LogLevel.DEBUG, `Scanning new library item "${libraryItemData.path}"`)
    else Logger.debug(`[Scanner] Scanning new item "${libraryItemData.path}"`)

    var libraryItem = new LibraryItem()
    libraryItem.setData(libraryMediaType, libraryItemData)

    var audioFiles = libraryItemData.libraryFiles.filter(lf => lf.fileType === 'audio')
    if (audioFiles.length) {
      await AudioFileScanner.scanAudioFiles(audioFiles, libraryItemData, libraryItem, preferAudioMetadata, libraryScan)
    }

    if (!libraryItem.hasMediaEntities) {
      Logger.warn(`[Scanner] Library item has no media files "${libraryItemData.path}"`)
      return null
    }

    await libraryItem.syncFiles(preferOpfMetadata)

    // Extract embedded cover art if cover is not already in directory
    if (libraryItem.media.hasEmbeddedCoverArt && !libraryItem.media.coverPath) {
      var coverPath = await this.coverController.saveEmbeddedCoverArt(libraryItem)
      if (coverPath) {
        if (libraryScan) libraryScan.addLog(LogLevel.DEBUG, `Saved embedded cover art "${coverPath}"`)
        else Logger.debug(`[Scanner] Saved embedded cover art "${coverPath}"`)
      }
    }

    // Scan for cover if enabled and has no cover
    if (libraryMediaType !== 'podcast') {
      if (libraryItem && findCovers && !libraryItem.media.coverPath && libraryItem.media.shouldSearchForCover) {
        var updatedCover = await this.searchForCover(libraryItem, libraryScan)
        libraryItem.media.updateLastCoverSearch(updatedCover)
      }
    }

    return libraryItem
  }

  async createNewAuthorsAndSeries(libraryItem) {
    if (libraryItem.mediaType !== 'book') return

    // Create or match all new authors and series
    if (libraryItem.media.metadata.authors.some(au => au.id.startsWith('new'))) {
      var newAuthors = []
      libraryItem.media.metadata.authors = libraryItem.media.metadata.authors.map((tempMinAuthor) => {
        var _author = this.db.authors.find(au => au.checkNameEquals(tempMinAuthor.name))
        if (!_author) _author = newAuthors.find(au => au.checkNameEquals(tempMinAuthor.name)) // Check new unsaved authors
        if (!_author) {
          _author = new Author()
          _author.setData(tempMinAuthor)
          newAuthors.push(_author)
        }
        return {
          id: _author.id,
          name: _author.name
        }
      })
      if (newAuthors.length) {
        await this.db.insertEntities('author', newAuthors)
        this.emitter('authors_added', newAuthors.map(au => au.toJSON()))
      }
    }
    if (libraryItem.media.metadata.series.some(se => se.id.startsWith('new'))) {
      var newSeries = []
      libraryItem.media.metadata.series = libraryItem.media.metadata.series.map((tempMinSeries) => {
        var _series = this.db.series.find(se => se.checkNameEquals(tempMinSeries.name))
        if (!_series) _series = newSeries.find(se => se.checkNameEquals(tempMinSeries.name)) // Check new unsaved series
        if (!_series) {
          _series = new Series()
          _series.setData(tempMinSeries)
          newSeries.push(_series)
        }
        return {
          id: _series.id,
          name: _series.name,
          sequence: tempMinSeries.sequence
        }
      })
      if (newSeries.length) {
        await this.db.insertEntities('series', newSeries)
        this.emitter('series_added', newSeries.map(se => se.toJSON()))
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
    if (!fileUpdates.length) return
    // files grouped by folder
    var folderGroups = this.getFileUpdatesGrouped(fileUpdates)

    for (const folderId in folderGroups) {
      var libraryId = folderGroups[folderId].libraryId
      var library = this.db.libraries.find(lib => lib.id === libraryId)
      if (!library) {
        Logger.error(`[Scanner] Library not found in files changed ${libraryId}`)
        continue;
      }
      var folder = library.getFolderById(folderId)
      if (!folder) {
        Logger.error(`[Scanner] Folder is not in library in files changed "${folderId}", Library "${library.name}"`)
        continue;
      }
      var relFilePaths = folderGroups[folderId].fileUpdates.map(fileUpdate => fileUpdate.relPath)
      var fileUpdateGroup = groupFilesIntoLibraryItemPaths(relFilePaths, true)
      var folderScanResults = await this.scanFolderUpdates(library, folder, fileUpdateGroup)
      Logger.debug(`[Scanner] Folder scan results`, folderScanResults)
    }
  }

  async scanFolderUpdates(library, folder, fileUpdateGroup) {
    Logger.debug(`[Scanner] Scanning file update groups in folder "${folder.id}" of library "${library.name}"`)

    // First pass - Remove files in parent dirs of items and remap the fileupdate group
    //    Test Case: Moving audio files from library item folder to author folder should trigger a re-scan of the item
    var updateGroup = { ...fileUpdateGroup }
    for (const itemDir in updateGroup) {
      var itemDirNestedFiles = fileUpdateGroup[itemDir].filter(b => b.includes('/'))
      if (!itemDirNestedFiles.length) continue;

      var firstNest = itemDirNestedFiles[0].split('/').shift()
      var altDir = `${itemDir}/${firstNest}`

      var fullPath = Path.posix.join(folder.fullPath.replace(/\\/g, '/'), itemDir)
      var childLibraryItem = this.db.libraryItems.find(li => li.path !== fullPath && li.fullPath.startsWith(fullPath))
      if (!childLibraryItem) {
        continue;
      }
      var altFullPath = Path.posix.join(folder.fullPath.replace(/\\/g, '/'), altDir)
      var altChildLibraryItem = this.db.libraryItems.find(li => li.path !== altFullPath && li.path.startsWith(altFullPath))
      if (altChildLibraryItem) {
        continue;
      }

      delete fileUpdateGroup[itemDir]
      fileUpdateGroup[altDir] = itemDirNestedFiles.map((f) => f.split('/').slice(1).join('/'))
      Logger.warn(`[Scanner] Some files were modified in a parent directory of a library item "${childLibraryItem.title}" - ignoring`)
    }

    // Second pass: Check for new/updated/removed items
    var itemGroupingResults = {}
    for (const itemDir in fileUpdateGroup) {
      var fullPath = Path.posix.join(folder.fullPath.replace(/\\/g, '/'), itemDir)

      // Check if book dir group is already an item
      var existingLibraryItem = this.db.libraryItems.find(li => fullPath.startsWith(li.path))
      if (existingLibraryItem) {
        // Is the item exactly - check if was deleted
        if (existingLibraryItem.path === fullPath) {
          var exists = await fs.pathExists(fullPath)
          if (!exists) {
            Logger.info(`[Scanner] Scanning file update group and library item was deleted "${existingLibraryItem.media.metadata.title}" - marking as missing`)
            existingLibraryItem.setMissing()
            await this.db.updateLibraryItem(existingLibraryItem)
            this.emitter('item_updated', existingLibraryItem.toJSONExpanded())

            itemGroupingResults[itemDir] = ScanResult.REMOVED
            continue;
          }
        }

        // Scan library item for updates
        Logger.debug(`[Scanner] Folder update for relative path "${itemDir}" is in library item "${existingLibraryItem.media.metadata.title}" - scan for updates`)
        itemGroupingResults[itemDir] = await this.scanLibraryItem(library.mediaType, folder, existingLibraryItem)
        continue;
      }

      // Check if a library item is a subdirectory of this dir
      var childItem = this.db.libraryItems.find(li => li.path.startsWith(fullPath))
      if (childItem) {
        Logger.warn(`[Scanner] Files were modified in a parent directory of a library item "${childItem.media.metadata.title}" - ignoring`)
        itemGroupingResults[itemDir] = ScanResult.NOTHING
        continue;
      }

      Logger.debug(`[Scanner] Folder update group must be a new item "${itemDir}" in library "${library.name}"`)
      var newLibraryItem = await this.scanPotentialNewLibraryItem(library.mediaType, folder, fullPath)
      if (newLibraryItem) {
        await this.createNewAuthorsAndSeries(newLibraryItem)
        await this.db.insertLibraryItem(newLibraryItem)
        this.emitter('item_added', newLibraryItem.toJSONExpanded())
      }
      itemGroupingResults[itemDir] = newLibraryItem ? ScanResult.ADDED : ScanResult.NOTHING
    }

    return itemGroupingResults
  }

  async scanPotentialNewLibraryItem(libraryMediaType, folder, fullPath) {
    var libraryItemData = await getLibraryItemFileData(libraryMediaType, folder, fullPath, this.db.serverSettings)
    if (!libraryItemData) return null
    var serverSettings = this.db.serverSettings
    return this.scanNewLibraryItem(libraryItemData, libraryMediaType, serverSettings.scannerPreferAudioMetadata, serverSettings.scannerPreferOpfMetadata, serverSettings.scannerFindCovers)
  }

  async searchForCover(libraryItem, libraryScan = null) {
    var options = {
      titleDistance: 2,
      authorDistance: 2
    }
    var scannerCoverProvider = this.db.serverSettings.scannerCoverProvider
    var results = await this.bookFinder.findCovers(scannerCoverProvider, libraryItem.media.metadata.title, libraryItem.media.metadata.authorName, options)
    if (results.length) {
      if (libraryScan) libraryScan.addLog(LogLevel.DEBUG, `Found best cover for "${libraryItem.media.metadata.title}"`)
      else Logger.debug(`[Scanner] Found best cover for "${libraryItem.media.metadata.title}"`)

      // If the first cover result fails, attempt to download the second
      for (let i = 0; i < results.length && i < 2; i++) {

        // Downloads and updates the book cover
        var result = await this.coverController.downloadCoverFromUrl(libraryItem, results[i])

        if (result.error) {
          Logger.error(`[Scanner] Failed to download cover from url "${results[i]}" | Attempt ${i + 1}`, result.error)
        } else {
          return true
        }
      }
    }
    return false
  }

  async saveMetadata(audiobookId) {
    if (audiobookId) {
      var audiobook = this.db.audiobooks.find(ab => ab.id === audiobookId)
      if (!audiobook) {
        return {
          error: 'Audiobook not found'
        }
      }
      var savedPath = await audiobook.writeNfoFile()
      return {
        audiobookId,
        audiobookTitle: audiobook.title,
        savedPath
      }
    } else {
      var response = {
        success: 0,
        failed: 0
      }
      for (let i = 0; i < this.db.audiobooks.length; i++) {
        var audiobook = this.db.audiobooks[i]
        var savedPath = await audiobook.writeNfoFile()
        if (savedPath) {
          Logger.info(`[Scanner] Saved metadata nfo ${savedPath}`)
          response.success++
        } else {
          response.failed++
        }
      }
      return response
    }
  }

  async quickMatchBook(libraryItem, options = {}) {
    var provider = options.provider || 'google'
    var searchTitle = options.title || libraryItem.media.metadata.title
    var searchAuthor = options.author || libraryItem.media.metadata.authorName

    var results = await this.bookFinder.search(provider, searchTitle, searchAuthor)
    if (!results.length) {
      return {
        warning: `No ${provider} match found`
      }
    }
    var matchData = results[0]

    // Update cover if not set OR overrideCover flag
    var hasUpdated = false
    if (matchData.cover && (!libraryItem.media.coverPath || options.overrideCover)) {
      Logger.debug(`[Scanner] Updating cover "${matchData.cover}"`)
      var coverResult = await this.coverController.downloadCoverFromUrl(libraryItem, matchData.cover)
      if (!coverResult || coverResult.error || !coverResult.cover) {
        Logger.warn(`[Scanner] Match cover "${matchData.cover}" failed to use: ${coverResult ? coverResult.error : 'Unknown Error'}`)
      } else {
        hasUpdated = true
      }
    }

    // Update media metadata if not set OR overrideDetails flag
    const detailKeysToUpdate = ['title', 'subtitle', 'narrator', 'publisher', 'publishedYear', 'asin', 'isbn']
    const updatePayload = {}
    for (const key in matchData) {
      if (matchData[key] && detailKeysToUpdate.includes(key)) {
        if (key === 'narrator') {
          if ((!libraryItem.media.metadata.narratorName || options.overrideDetails)) {
            updatePayload.narrators = [matchData[key]]
          }
        } else if ((!libraryItem.media.metadata[key] || options.overrideDetails)) {
          updatePayload[key] = matchData[key]
        }
      }
    }

    // Add or set author if not set
    if (matchData.author && !libraryItem.media.metadata.authorName) {
      var author = this.db.authors.find(au => au.checkNameEquals(matchData.author))
      if (!author) {
        author = new Author()
        author.setData({ name: matchData.author })
        await this.db.insertEntity('author', author)
        this.emitter('author_added', author)
      }
      updatePayload.authors = [author.toJSONMinimal()]
    }

    // Add or set series if not set
    if (matchData.series && !libraryItem.media.metadata.seriesName) {
      var seriesItem = this.db.series.find(au => au.checkNameEquals(matchData.series))
      if (!seriesItem) {
        seriesItem = new Series()
        seriesItem.setData({ name: matchData.series })
        await this.db.insertEntity('series', seriesItem)
        this.emitter('series_added', seriesItem)
      }
      updatePayload.series = [seriesItem.toJSONMinimal(matchData.volumeNumber)]
    }

    if (Object.keys(updatePayload).length) {
      Logger.debug('[Scanner] Updating details', updatePayload)
      if (libraryItem.media.update({ metadata: updatePayload })) {
        hasUpdated = true
      }
    }

    if (hasUpdated) {
      await this.db.updateLibraryItem(libraryItem)
      this.emitter('item_updated', libraryItem.toJSONExpanded())
    }

    return {
      updated: hasUpdated,
      libraryItem: libraryItem.toJSONExpanded()
    }
  }

  async matchLibraryBooks(library) {
    if (this.isLibraryScanning(library.id)) {
      Logger.error(`[Scanner] Already scanning ${library.id}`)
      return
    }

    const provider = library.provider || 'google'
    var audiobooksInLibrary = this.db.audiobooks.filter(ab => ab.libraryId === library.id)
    if (!audiobooksInLibrary.length) {
      return
    }

    var libraryScan = new LibraryScan()
    libraryScan.setData(library, null, 'match')
    this.librariesScanning.push(libraryScan.getScanEmitData)
    this.emitter('scan_start', libraryScan.getScanEmitData)

    Logger.info(`[Scanner] Starting library match books scan ${libraryScan.id} for ${libraryScan.libraryName}`)

    for (let i = 0; i < audiobooksInLibrary.length; i++) {
      var audiobook = audiobooksInLibrary[i]
      Logger.debug(`[Scanner] Quick matching "${audiobook.title}" (${i + 1} of ${audiobooksInLibrary.length})`)
      var result = await this.quickMatchBook(audiobook, { provider })
      if (result.warning) {
        Logger.warn(`[Scanner] Match warning ${result.warning} for audiobook "${audiobook.title}"`)
      } else if (result.updated) {
        libraryScan.resultsUpdated++
      }

      if (this.cancelLibraryScan[libraryScan.libraryId]) {
        Logger.info(`[Scanner] Library match scan canceled for "${libraryScan.libraryName}"`)
        delete this.cancelLibraryScan[libraryScan.libraryId]
        var scanData = libraryScan.getScanEmitData
        scanData.results = false
        this.emitter('scan_complete', scanData)
        this.librariesScanning = this.librariesScanning.filter(ls => ls.id !== library.id)
        return
      }
    }

    this.librariesScanning = this.librariesScanning.filter(ls => ls.id !== library.id)
    this.emitter('scan_complete', libraryScan.getScanEmitData)
  }
}
module.exports = Scanner