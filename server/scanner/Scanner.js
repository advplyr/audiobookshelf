const fs = require('fs-extra')
const Path = require('path')

// Utils
const Logger = require('../Logger')
const { version } = require('../../package.json')
const { groupFilesIntoAudiobookPaths, getAudiobookFileData, scanRootDir } = require('../utils/scandir')
const { comparePaths, getIno, getId, msToTimestamp } = require('../utils/index')
const { ScanResult, CoverDestination, LogLevel } = require('../utils/constants')

const AudioFileScanner = require('./AudioFileScanner')
const BookFinder = require('../BookFinder')
const Audiobook = require('../objects/Audiobook')
const LibraryScan = require('./LibraryScan')
const ScanOptions = require('./ScanOptions')

class Scanner {
  constructor(AUDIOBOOK_PATH, METADATA_PATH, db, coverController, emitter) {
    this.AudiobookPath = AUDIOBOOK_PATH
    this.MetadataPath = METADATA_PATH
    this.BookMetadataPath = Path.posix.join(this.MetadataPath.replace(/\\/g, '/'), 'books')
    var LogDirPath = Path.join(this.MetadataPath, 'logs')
    this.ScanLogPath = Path.join(LogDirPath, 'scans')

    this.db = db
    this.coverController = coverController
    this.emitter = emitter

    this.cancelLibraryScan = {}
    this.librariesScanning = []

    this.bookFinder = new BookFinder()
  }

  getCoverDirectory(audiobook) {
    if (this.db.serverSettings.coverDestination === CoverDestination.AUDIOBOOK) {
      return {
        fullPath: audiobook.fullPath,
        relPath: '/s/book/' + audiobook.id
      }
    } else {
      return {
        fullPath: Path.posix.join(this.BookMetadataPath, audiobook.id),
        relPath: Path.posix.join('/metadata', 'books', audiobook.id)
      }
    }
  }

  isLibraryScanning(libraryId) {
    return this.librariesScanning.find(ls => ls.id === libraryId)
  }

  setCancelLibraryScan(libraryId) {
    var libraryScanning = this.librariesScanning.find(ls => ls.id === libraryId)
    if (!libraryScanning) return
    this.cancelLibraryScan[libraryId] = true
  }

  async scanAudiobookById(audiobookId) {
    var audiobook = this.db.audiobooks.find(ab => ab.id === audiobookId)
    if (!audiobook) {
      Logger.error(`[Scanner] Scan audiobook by id not found ${audiobookId}`)
      return ScanResult.NOTHING
    }
    const library = this.db.libraries.find(lib => lib.id === audiobook.libraryId)
    if (!library) {
      Logger.error(`[Scanner] Scan audiobook by id library not found "${audiobook.libraryId}"`)
      return ScanResult.NOTHING
    }
    const folder = library.folders.find(f => f.id === audiobook.folderId)
    if (!folder) {
      Logger.error(`[Scanner] Scan audiobook by id folder not found "${audiobook.folderId}" in library "${library.name}"`)
      return ScanResult.NOTHING
    }
    Logger.info(`[Scanner] Scanning Audiobook "${audiobook.title}"`)
    return this.scanAudiobook(folder, audiobook)
  }

  async scanAudiobook(folder, audiobook) {
    var audiobookData = await getAudiobookFileData(folder, audiobook.fullPath, this.db.serverSettings)
    if (!audiobookData) {
      return ScanResult.NOTHING
    }
    var hasUpdated = false

    var checkRes = audiobook.checkScanData(audiobookData, version)
    if (checkRes.updated) hasUpdated = true

    // Sync other files first so that local images are used as cover art
    // TODO: Cleanup other file sync
    var allOtherFiles = checkRes.newOtherFileData.concat(audiobook._otherFiles)
    if (await audiobook.syncOtherFiles(allOtherFiles, this.MetadataPath, this.db.serverSettings.scannerPreferOpfMetadata)) {
      hasUpdated = true
    }

    // Scan all audio files
    if (audiobookData.audioFiles.length) {
      if (await AudioFileScanner.scanAudioFiles(audiobookData.audioFiles, audiobookData, audiobook, this.db.serverSettings.scannerPreferAudioMetadata)) {
        hasUpdated = true
      }

      // Extract embedded cover art if cover is not already in directory
      if (audiobook.hasEmbeddedCoverArt && !audiobook.cover) {
        var outputCoverDirs = this.getCoverDirectory(audiobook)
        var relativeDir = await audiobook.saveEmbeddedCoverArt(outputCoverDirs.fullPath, outputCoverDirs.relPath)
        if (relativeDir) {
          Logger.debug(`[Scanner] Saved embedded cover art "${relativeDir}"`)
          hasUpdated = true
        }
      }
    }

    if (!audiobook.audioFilesToInclude.length && !audiobook.ebooks.length) { // Audiobook is invalid
      audiobook.setInvalid()
      hasUpdated = true
    } else if (audiobook.isInvalid) {
      audiobook.isInvalid = false
      hasUpdated = true
    }

    if (hasUpdated) {
      this.emitter('audiobook_updated', audiobook.toJSONExpanded())
      await this.db.updateEntity('audiobook', audiobook)
      return ScanResult.UPDATED
    }
    return ScanResult.UPTODATE
  }

  async scan(libraryId, options = {}) {
    if (this.isLibraryScanning(libraryId)) {
      Logger.error(`[Scanner] Already scanning ${libraryId}`)
      return
    }

    var library = this.db.libraries.find(lib => lib.id === libraryId)
    if (!library) {
      Logger.error(`[Scanner] Library not found for scan ${libraryId}`)
      return
    } else if (!library.folders.length) {
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
    var audiobookDataFound = []

    // Scan each library
    for (let i = 0; i < libraryScan.folders.length; i++) {
      var folder = libraryScan.folders[i]
      var abDataFoundInFolder = await scanRootDir(folder, this.db.serverSettings)
      libraryScan.addLog(LogLevel.INFO, `${abDataFoundInFolder.length} ab data found in folder "${folder.fullPath}"`)
      audiobookDataFound = audiobookDataFound.concat(abDataFoundInFolder)
    }

    if (this.cancelLibraryScan[libraryScan.libraryId]) return true

    // Remove audiobooks with no inode
    audiobookDataFound = audiobookDataFound.filter(abd => abd.ino)
    var audiobooksInLibrary = this.db.audiobooks.filter(ab => ab.libraryId === libraryScan.libraryId)

    const NumScansPerChunk = 25
    const audiobooksToUpdateChunks = []
    const audiobookDataToRescanChunks = []
    const newAudiobookDataToScanChunks = []
    var audiobooksToUpdate = []
    var audiobookDataToRescan = []
    var newAudiobookDataToScan = []
    var audiobooksToFindCovers = []

    // Check for existing & removed audiobooks
    for (let i = 0; i < audiobooksInLibrary.length; i++) {
      var audiobook = audiobooksInLibrary[i]
      var dataFound = audiobookDataFound.find(abd => abd.ino === audiobook.ino || comparePaths(abd.path, audiobook.path))
      if (!dataFound) {
        libraryScan.addLog(LogLevel.WARN, `Audiobook "${audiobook.title}" is missing`)
        libraryScan.resultsMissing++
        audiobook.setMissing()
        audiobooksToUpdate.push(audiobook)
        if (audiobooksToUpdate.length === NumScansPerChunk) {
          audiobooksToUpdateChunks.push(audiobooksToUpdate)
          audiobooksToUpdate = []
        }
      } else {
        var checkRes = audiobook.checkScanData(dataFound, version)
        if (checkRes.newAudioFileData.length || checkRes.newOtherFileData.length || libraryScan.scanOptions.forceRescan) { // Audiobook has new files
          checkRes.audiobook = audiobook
          checkRes.bookScanData = dataFound
          audiobookDataToRescan.push(checkRes)
          if (audiobookDataToRescan.length === NumScansPerChunk) {
            audiobookDataToRescanChunks.push(audiobookDataToRescan)
            audiobookDataToRescan = []
          }
        } else if (libraryScan.findCovers && audiobook.book.shouldSearchForCover) {
          libraryScan.resultsUpdated++
          audiobooksToFindCovers.push(audiobook)
          audiobooksToUpdate.push(audiobook)
          if (audiobooksToUpdate.length === NumScansPerChunk) {
            audiobooksToUpdateChunks.push(audiobooksToUpdate)
            audiobooksToUpdate = []
          }
        } else if (checkRes.updated) { // Updated but no scan required
          libraryScan.resultsUpdated++
          audiobooksToUpdate.push(audiobook)
          if (audiobooksToUpdate.length === NumScansPerChunk) {
            audiobooksToUpdateChunks.push(audiobooksToUpdate)
            audiobooksToUpdate = []
          }
        }
        audiobookDataFound = audiobookDataFound.filter(abf => abf.ino !== dataFound.ino)
      }
    }
    if (audiobooksToUpdate.length) audiobooksToUpdateChunks.push(audiobooksToUpdate)
    if (audiobookDataToRescan.length) audiobookDataToRescanChunks.push(audiobookDataToRescan)

    // Potential NEW Audiobooks
    for (let i = 0; i < audiobookDataFound.length; i++) {
      var dataFound = audiobookDataFound[i]
      var hasEbook = dataFound.otherFiles.find(otherFile => otherFile.filetype === 'ebook')
      if (!hasEbook && !dataFound.audioFiles.length) {
        libraryScan.addLog(LogLevel.WARN, `Directory found "${audiobookDataFound.path}" has no ebook or audio files`)
      } else {
        newAudiobookDataToScan.push(dataFound)
        if (newAudiobookDataToScan.length === NumScansPerChunk) {
          newAudiobookDataToScanChunks.push(newAudiobookDataToScan)
          newAudiobookDataToScan = []
        }
      }
    }
    if (newAudiobookDataToScan.length) newAudiobookDataToScanChunks.push(newAudiobookDataToScan)

    // console.log('Num chunks to update', audiobooksToUpdateChunks.length)
    // console.log('Num chunks to rescan', audiobookDataToRescanChunks.length)
    // console.log('Num chunks to new scan', newAudiobookDataToScanChunks.length)

    // Audiobooks not requiring a scan but require a search for cover
    for (let i = 0; i < audiobooksToFindCovers.length; i++) {
      var audiobook = audiobooksToFindCovers[i]
      var updatedCover = await this.searchForCover(audiobook, libraryScan)
      audiobook.book.updateLastCoverSearch(updatedCover)
    }

    for (let i = 0; i < audiobooksToUpdateChunks.length; i++) {
      await this.updateAudiobooksChunk(audiobooksToUpdateChunks[i])
      if (this.cancelLibraryScan[libraryScan.libraryId]) return true
      // console.log('Update chunk done', i, 'of', audiobooksToUpdateChunks.length)
    }
    for (let i = 0; i < audiobookDataToRescanChunks.length; i++) {
      await this.rescanAudiobookDataChunk(audiobookDataToRescanChunks[i], libraryScan)
      if (this.cancelLibraryScan[libraryScan.libraryId]) return true
      // console.log('Rescan chunk done', i, 'of', audiobookDataToRescanChunks.length)
    }
    for (let i = 0; i < newAudiobookDataToScanChunks.length; i++) {
      await this.scanNewAudiobookDataChunk(newAudiobookDataToScanChunks[i], libraryScan)
      // console.log('New scan chunk done', i, 'of', newAudiobookDataToScanChunks.length)
      if (this.cancelLibraryScan[libraryScan.libraryId]) return true
    }
  }

  async updateAudiobooksChunk(audiobooksToUpdate) {
    await this.db.updateEntities('audiobook', audiobooksToUpdate)
    this.emitter('audiobooks_updated', audiobooksToUpdate.map(ab => ab.toJSONExpanded()))
  }

  async rescanAudiobookDataChunk(audiobookDataToRescan, libraryScan) {
    var audiobooksUpdated = await Promise.all(audiobookDataToRescan.map((abd) => {
      return this.rescanAudiobook(abd, libraryScan)
    }))
    audiobooksUpdated = audiobooksUpdated.filter(ab => ab) // Filter out nulls
    if (audiobooksUpdated.length) {
      libraryScan.resultsUpdated += audiobooksUpdated.length
      await this.db.updateEntities('audiobook', audiobooksUpdated)
      this.emitter('audiobooks_updated', audiobooksUpdated.map(ab => ab.toJSONExpanded()))
    }
  }

  async scanNewAudiobookDataChunk(newAudiobookDataToScan, libraryScan) {
    var newAudiobooks = await Promise.all(newAudiobookDataToScan.map((abd) => {
      return this.scanNewAudiobook(abd, libraryScan.preferAudioMetadata, libraryScan.preferOpfMetadata, libraryScan.findCovers, libraryScan)
    }))
    newAudiobooks = newAudiobooks.filter(ab => ab) // Filter out nulls
    libraryScan.resultsAdded += newAudiobooks.length
    await this.db.insertEntities('audiobook', newAudiobooks)
    this.emitter('audiobooks_added', newAudiobooks.map(ab => ab.toJSONExpanded()))
  }

  async rescanAudiobook(audiobookCheckData, libraryScan) {
    const { newAudioFileData, newOtherFileData, audiobook, bookScanData, updated, existingAudioFileData, existingOtherFileData } = audiobookCheckData
    libraryScan.addLog(LogLevel.DEBUG, `Library "${libraryScan.libraryName}" Re-scanning "${audiobook.path}"`)
    var hasUpdated = updated

    // Sync other files first to use local images as cover before extracting audio file cover
    if (newOtherFileData.length || libraryScan.scanOptions.forceRescan) {
      // TODO: Cleanup other file sync
      var allOtherFiles = newOtherFileData.concat(existingOtherFileData)
      if (await audiobook.syncOtherFiles(allOtherFiles, this.MetadataPath, libraryScan.preferOpfMetadata)) {
        hasUpdated = true
      }
    }

    // forceRescan all existing audio files - will probe and update ID3 tag metadata
    if (libraryScan.scanOptions.forceRescan && existingAudioFileData.length) {
      if (await AudioFileScanner.scanAudioFiles(existingAudioFileData, bookScanData, audiobook, libraryScan.preferAudioMetadata, libraryScan)) {
        hasUpdated = true
      }
    }
    // Scan new audio files
    if (newAudioFileData.length) {
      if (await AudioFileScanner.scanAudioFiles(newAudioFileData, bookScanData, audiobook, libraryScan.preferAudioMetadata, libraryScan)) {
        hasUpdated = true
      }
    }
    // If an audio file has embedded cover art and no cover is set yet, extract & use it
    if (newAudioFileData.length || libraryScan.scanOptions.forceRescan) {
      if (audiobook.hasEmbeddedCoverArt && !audiobook.cover) {
        var outputCoverDirs = this.getCoverDirectory(audiobook)
        var relativeDir = await audiobook.saveEmbeddedCoverArt(outputCoverDirs.fullPath, outputCoverDirs.relPath)
        if (relativeDir) {
          hasUpdated = true
          libraryScan.addLog(LogLevel.DEBUG, `Saved embedded cover art "${relativeDir}"`)
        }
      }
    }

    if (!audiobook.audioFilesToInclude.length && !audiobook.ebooks.length) { // Audiobook is invalid
      audiobook.setInvalid()
      hasUpdated = true
    } else if (audiobook.isInvalid) {
      audiobook.isInvalid = false
      hasUpdated = true
    }

    // Scan for cover if enabled and has no cover (and author or title has changed OR has been 7 days since last lookup)
    if (audiobook && libraryScan.findCovers && !audiobook.cover && audiobook.book.shouldSearchForCover) {
      var updatedCover = await this.searchForCover(audiobook, libraryScan)
      audiobook.book.updateLastCoverSearch(updatedCover)
      hasUpdated = true
    }

    return hasUpdated ? audiobook : null
  }

  async scanNewAudiobook(audiobookData, preferAudioMetadata, preferOpfMetadata, findCovers, libraryScan = null) {
    if (libraryScan) libraryScan.addLog(LogLevel.DEBUG, `Scanning new book "${audiobookData.path}"`)
    else Logger.debug(`[Scanner] Scanning new book "${audiobookData.path}"`)

    var audiobook = new Audiobook()
    audiobook.setData(audiobookData)

    if (audiobookData.audioFiles.length) {
      await AudioFileScanner.scanAudioFiles(audiobookData.audioFiles, audiobookData, audiobook, preferAudioMetadata, libraryScan)
    }

    if (!audiobook.audioFilesToInclude.length && !audiobook.ebooks.length) {
      // Audiobook has no ebooks and no valid audio tracks do not continue
      Logger.warn(`[Scanner] Audiobook has no ebooks and no valid audio tracks "${audiobook.path}"`)
      return null
    }

    // Look for desc.txt and reader.txt and update
    await audiobook.saveDataFromTextFiles(preferOpfMetadata)

    // Extract embedded cover art if cover is not already in directory
    if (audiobook.hasEmbeddedCoverArt && !audiobook.cover) {
      var outputCoverDirs = this.getCoverDirectory(audiobook)
      var relativeDir = await audiobook.saveEmbeddedCoverArt(outputCoverDirs.fullPath, outputCoverDirs.relPath)
      if (relativeDir) {
        if (libraryScan) libraryScan.addLog(LogLevel.DEBUG, `Saved embedded cover art "${relativeDir}"`)
        else Logger.debug(`[Scanner] Saved embedded cover art "${relativeDir}"`)
      }
    }

    // Scan for cover if enabled and has no cover
    if (audiobook && findCovers && !audiobook.cover && audiobook.book.shouldSearchForCover) {
      var updatedCover = await this.searchForCover(audiobook, libraryScan)
      audiobook.book.updateLastCoverSearch(updatedCover)
    }

    return audiobook
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
      var fileUpdateBookGroup = groupFilesIntoAudiobookPaths(relFilePaths, true)
      var folderScanResults = await this.scanFolderUpdates(library, folder, fileUpdateBookGroup)
      Logger.debug(`[Scanner] Folder scan results`, folderScanResults)
    }
  }

  async scanFolderUpdates(library, folder, fileUpdateBookGroup) {
    Logger.debug(`[Scanner] Scanning file update groups in folder "${folder.id}" of library "${library.name}"`)

    var bookGroupingResults = {}
    for (const bookDir in fileUpdateBookGroup) {
      var fullPath = Path.posix.join(folder.fullPath.replace(/\\/g, '/'), bookDir)

      // Check if book dir group is already an audiobook or in a subdir of an audiobook
      var existingAudiobook = this.db.audiobooks.find(ab => fullPath.startsWith(ab.fullPath))
      if (existingAudiobook) {

        // Is the audiobook exactly - check if was deleted
        if (existingAudiobook.fullPath === fullPath) {
          var exists = await fs.pathExists(fullPath)
          if (!exists) {
            Logger.info(`[Scanner] Scanning file update group and audiobook was deleted "${existingAudiobook.title}" - marking as missing`)
            existingAudiobook.setMissing()
            await this.db.updateAudiobook(existingAudiobook)
            this.emitter('audiobook_updated', existingAudiobook.toJSONExpanded())

            bookGroupingResults[bookDir] = ScanResult.REMOVED
            continue;
          }
        }

        // Scan audiobook for updates
        Logger.debug(`[Scanner] Folder update for relative path "${bookDir}" is in audiobook "${existingAudiobook.title}" - scan for updates`)
        bookGroupingResults[bookDir] = await this.scanAudiobook(folder, existingAudiobook)
        continue;
      }

      // Check if an audiobook is a subdirectory of this dir
      var childAudiobook = this.db.audiobooks.find(ab => ab.fullPath.startsWith(fullPath))
      if (childAudiobook) {
        Logger.warn(`[Scanner] Files were modified in a parent directory of an audiobook "${childAudiobook.title}" - ignoring`)
        bookGroupingResults[bookDir] = ScanResult.NOTHING
        continue;
      }

      Logger.debug(`[Scanner] Folder update group must be a new book "${bookDir}" in library "${library.name}"`)
      var newAudiobook = await this.scanPotentialNewAudiobook(folder, fullPath)
      if (newAudiobook) {
        await this.db.insertEntity('audiobook', newAudiobook)
        this.emitter('audiobook_added', newAudiobook.toJSONExpanded())
      }
      bookGroupingResults[bookDir] = newAudiobook ? ScanResult.ADDED : ScanResult.NOTHING
    }

    return bookGroupingResults
  }

  async scanPotentialNewAudiobook(folder, fullPath) {
    var audiobookData = await getAudiobookFileData(folder, fullPath, this.db.serverSettings)
    if (!audiobookData) return null
    var serverSettings = this.db.serverSettings
    return this.scanNewAudiobook(audiobookData, serverSettings.scannerPreferAudioMetadata, serverSettings.scannerPreferOpfMetadata, serverSettings.scannerFindCovers)
  }

  async searchForCover(audiobook, libraryScan = null) {
    var options = {
      titleDistance: 2,
      authorDistance: 2
    }
    var scannerCoverProvider = this.db.serverSettings.scannerCoverProvider
    var results = await this.bookFinder.findCovers(scannerCoverProvider, audiobook.title, audiobook.authorFL, options)
    if (results.length) {
      if (libraryScan) libraryScan.addLog(LogLevel.DEBUG, `Found best cover for "${audiobook.title}"`)
      else Logger.debug(`[Scanner] Found best cover for "${audiobook.title}"`)

      // If the first cover result fails, attempt to download the second
      for (let i = 0; i < results.length && i < 2; i++) {

        // Downloads and updates the book cover
        var result = await this.coverController.downloadCoverFromUrl(audiobook, results[i])

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

  // TEMP: Old version created ids that had a chance of repeating
  async fixDuplicateIds() {
    var ids = {}
    var audiobooksUpdated = 0
    for (let i = 0; i < this.db.audiobooks.length; i++) {
      var ab = this.db.audiobooks[i]
      if (ids[ab.id]) {
        var abCopy = new Audiobook(ab.toJSON())
        abCopy.id = getId('ab')
        if (abCopy.book.cover) {
          abCopy.book.cover = abCopy.book.cover.replace(ab.id, abCopy.id)
        }
        Logger.warn('Found duplicate ID - updating from', ab.id, 'to', abCopy.id)
        await this.db.removeEntity('audiobook', ab.id)
        await this.db.insertEntity('audiobook', abCopy)
        audiobooksUpdated++
      } else {
        ids[ab.id] = true
      }
    }
    if (audiobooksUpdated) {
      Logger.info(`[Scanner] Updated ${audiobooksUpdated} audiobook IDs`)
    }
  }
}
module.exports = Scanner