const fs = require('fs-extra')
const Path = require('path')

// Utils
const Logger = require('../Logger')
const { version } = require('../../package.json')
const audioFileScanner = require('../utils/audioFileScanner')
const { groupFilesIntoAudiobookPaths, getAudiobookFileData, scanRootDir } = require('../utils/scandir')
const { comparePaths, getIno, getId } = require('../utils/index')
const { secondsToTimestamp } = require('../utils/fileUtils')
const { ScanResult, CoverDestination } = require('../utils/constants')

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

    this.db = db
    this.coverController = coverController
    this.emitter = emitter

    this.cancelScan = false
    this.cancelLibraryScan = {}
    this.librariesScanning = []

    this.bookFinder = new BookFinder()
  }

  async scan(libraryId, options = {}) {
    if (this.librariesScanning.includes(libraryId)) {
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

    Logger.info(`[Scanner] Starting library scan ${libraryScan.id} for ${libraryScan.libraryName}`)

    var results = await this.scanLibrary(libraryScan)

    Logger.info(`[Scanner] Library scan ${libraryScan.id} complete`)

    return results
  }

  async scanLibrary(libraryScan) {
    var audiobookDataFound = []
    for (let i = 0; i < libraryScan.folders.length; i++) {
      var folder = libraryScan.folders[i]
      var abDataFoundInFolder = await scanRootDir(folder, this.db.serverSettings)
      Logger.debug(`[Scanner] ${abDataFoundInFolder.length} ab data found in folder "${folder.fullPath}"`)
      audiobookDataFound = audiobookDataFound.concat(abDataFoundInFolder)
    }

    // Remove audiobooks with no inode
    audiobookDataFound = audiobookDataFound.filter(abd => abd.ino)

    var audiobooksInLibrary = this.db.audiobooks.filter(ab => ab.libraryId === libraryScan.libraryId)

    const audiobooksToUpdate = []
    const audiobooksToRescan = []
    const newAudiobookData = []

    // Check for existing & removed audiobooks
    for (let i = 0; i < audiobooksInLibrary.length; i++) {
      var audiobook = audiobooksInLibrary[i]
      var dataFound = audiobookDataFound.find(abd => abd.ino === audiobook.ino || comparePaths(abd.path, audiobook.path))
      if (!dataFound) {
        Logger.info(`[Scanner] Audiobook "${audiobook.title}" is missing`)
        audiobook.isMissing = true
        audiobook.lastUpdate = Date.now()
        scanResults.missing++
        audiobooksToUpdate.push(audiobook)
      } else {
        var checkRes = audiobook.checkShouldRescan(dataFound)
        if (checkRes.newAudioFileData.length || checkRes.newOtherFileData.length) {
          // existing audiobook has new files
          checkRes.audiobook = audiobook
          audiobooksToRescan.push(checkRes)
        } else if (checkRes.updated) {
          audiobooksToUpdate.push(audiobook)
        }

        // Remove this abf
        audiobookDataFound = audiobookDataFound.filter(abf => abf.ino !== dataFound.ino)
      }
    }

    // Potential NEW Audiobooks
    for (let i = 0; i < audiobookDataFound.length; i++) {
      var dataFound = audiobookDataFound[i]
      var hasEbook = dataFound.otherFiles.find(otherFile => otherFile.filetype === 'ebook')
      if (!hasEbook && !dataFound.audioFiles.length) {
        Logger.info(`[Scanner] Directory found "${audiobookDataFound.path}" has no ebook or audio files`)
      } else {
        newAudiobookData.push(dataFound)
      }
    }

    var rescans = []
    for (let i = 0; i < audiobooksToRescan.length; i++) {
      var rescan = this.rescanAudiobook(audiobooksToRescan[i])
      rescans.push(rescan)
    }
    var newscans = []
    for (let i = 0; i < newAudiobookData.length; i++) {
      var newscan = this.scanNewAudiobook(newAudiobookData[i])
      newscans.push(newscan)
    }

    var rescanResults = await Promise.all(rescans)

    var newscanResults = await Promise.all(newscans)

    // TODO: Return report
    return {
      updates: 0,
      additions: 0
    }
  }

  // Return scan result payload
  async rescanAudiobook(audiobookCheckData) {
    const { newAudioFileData, newOtherFileData, audiobook } = audiobookCheckData
    if (newAudioFileData.length) {
      var newAudioFiles = await this.scanAudioFiles(newAudioFileData)
      // TODO: Update audiobook tracks
    }
    if (newOtherFileData.length) {
      // TODO: Check other files
    }

    return {
      updated: true
    }
  }

  async scanNewAudiobook(audiobookData) {
    // TODO: Return new audiobook
    return null
  }

  async scanAudioFiles(audioFileData) {
    var proms = []
    for (let i = 0; i < audioFileData.length; i++) {
      var prom = AudioFileScanner.scan(audioFileData[i])
      proms.push(prom)
    }
    return Promise.all(proms)
  }
}
module.exports = Scanner