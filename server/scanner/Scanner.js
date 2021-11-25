const fs = require('fs-extra')
const Path = require('path')

// Utils
const Logger = require('../Logger')
const { version } = require('../../package.json')
const audioFileScanner = require('../utils/audioFileScanner')
const { groupFilesIntoAudiobookPaths, getAudiobookFileData, scanRootDir } = require('../utils/scandir')
const { comparePaths, getIno, getId, msToTimestamp } = require('../utils/index')
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
    this.librariesScanning.push(libraryScan)

    this.emitter('scan_start', libraryScan.getScanEmitData)

    Logger.info(`[Scanner] Starting library scan ${libraryScan.id} for ${libraryScan.libraryName}`)

    await this.scanLibrary(libraryScan)

    libraryScan.setComplete()
    Logger.info(`[Scanner] Library scan ${libraryScan.id} completed in ${libraryScan.elapsedTimestamp}. ${libraryScan.resultStats}`)

    this.librariesScanning = this.librariesScanning.filter(ls => ls.id !== library.id)
    this.emitter('scan_complete', libraryScan.getScanEmitData)
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

    var audiobooksToUpdate = []
    var audiobookRescans = []
    var newAudiobookScans = []

    // Check for existing & removed audiobooks
    for (let i = 0; i < audiobooksInLibrary.length; i++) {
      var audiobook = audiobooksInLibrary[i]
      var dataFound = audiobookDataFound.find(abd => abd.ino === audiobook.ino || comparePaths(abd.path, audiobook.path))
      if (!dataFound) {
        Logger.info(`[Scanner] Audiobook "${audiobook.title}" is missing`)
        audiobook.setMissing()
        audiobooksToUpdate.push(audiobook)
      } else {
        var checkRes = audiobook.checkScanData(dataFound)
        if (checkRes.newAudioFileData.length || checkRes.newOtherFileData.length) {
          // existing audiobook has new files
          checkRes.audiobook = audiobook
          checkRes.bookScanData = dataFound
          audiobookRescans.push(this.rescanAudiobook(checkRes, libraryScan))
          libraryScan.resultsMissing++
        } else if (checkRes.updated) {
          audiobooksToUpdate.push(audiobook)
          libraryScan.resultsUpdated++
        }
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
        newAudiobookScans.push(this.scanNewAudiobook(dataFound, libraryScan))
      }
    }

    if (audiobookRescans.length) {
      var updatedAudiobooks = (await Promise.all(audiobookRescans)).filter(ab => !!ab)
      if (updatedAudiobooks.length) {
        audiobooksToUpdate = audiobooksToUpdate.concat(updatedAudiobooks)
        libraryScan.resultsUpdated += updatedAudiobooks.length
      }
    }
    if (audiobooksToUpdate.length) {
      Logger.debug(`[Scanner] Library "${libraryScan.libraryName}" updating ${audiobooksToUpdate.length} books`)
      await this.db.updateEntities('audiobook', audiobooksToUpdate)
    }

    if (newAudiobookScans.length) {
      var newAudiobooks = (await Promise.all(newAudiobookScans)).filter(ab => !!ab)
      if (newAudiobooks.length) {
        Logger.debug(`[Scanner] Library "${libraryScan.libraryName}" inserting ${newAudiobooks.length} books`)
        await this.db.insertEntities('audiobook', newAudiobooks)
        libraryScan.resultsAdded = newAudiobooks.length
      }
    }
  }

  async rescanAudiobook(audiobookCheckData, libraryScan) {
    const { newAudioFileData, newOtherFileData, audiobook, bookScanData } = audiobookCheckData
    Logger.debug(`[Scanner] Library "${libraryScan.libraryName}" Re-scanning "${audiobook.path}"`)

    if (newAudioFileData.length) {
      var audioScanResult = await AudioFileScanner.scanAudioFiles(newAudioFileData, bookScanData)
      Logger.debug(`[Scanner] Library "${libraryScan.libraryName}" Book "${audiobook.path}" Audio file scan took ${msToTimestamp(audioScanResult.elapsed, true)} for ${audioScanResult.audioFiles.length} with average time of ${msToTimestamp(audioScanResult.averageScanDuration, true)}`)
      if (audioScanResult.audioFiles.length) {
        var totalAudioFilesToInclude = audiobook.audioFilesToInclude.length + audioScanResult.audioFiles.length

        // validate & add audio files to audiobook
        for (let i = 0; i < audioScanResult.audioFiles.length; i++) {
          var newAF = audioScanResult.audioFiles[i]
          var trackIndex = newAF.validateTrackIndex(totalAudioFilesToInclude === 1)
          if (trackIndex !== null) {
            if (audiobook.checkHasTrackNum(trackIndex)) {
              newAF.setDuplicateTrackNumber(trackIndex)
            } else {
              newAF.index = trackIndex
            }
          }
          audiobook.addAudioFile(newAF)
        }

        audiobook.rebuildTracks()
      }
    }
    if (newOtherFileData.length) {
      await audiobook.syncOtherFiles(newOtherFileData, this.MetadataPath)
    }
    return audiobook
  }

  async scanNewAudiobook(audiobookData, libraryScan) {
    Logger.debug(`[Scanner] Library "${libraryScan.libraryName}" Scanning new "${audiobookData.path}"`)
    var audiobook = new Audiobook()
    audiobook.setData(audiobookData)

    if (audiobookData.audioFiles.length) {
      var audioScanResult = await AudioFileScanner.scanAudioFiles(audiobookData.audioFiles, audiobookData)
      Logger.debug(`[Scanner] Library "${libraryScan.libraryName}" Book "${audiobookData.path}" Audio file scan took ${msToTimestamp(audioScanResult.elapsed, true)} for ${audioScanResult.audioFiles.length} with average time of ${msToTimestamp(audioScanResult.averageScanDuration, true)}`)
      if (audioScanResult.audioFiles.length) {
        // validate & add audio files to audiobook
        for (let i = 0; i < audioScanResult.audioFiles.length; i++) {
          var newAF = audioScanResult.audioFiles[i]
          var trackIndex = newAF.validateTrackIndex(audioScanResult.audioFiles.length === 1)
          if (trackIndex !== null) {
            if (audiobook.checkHasTrackNum(trackIndex)) {
              newAF.setDuplicateTrackNumber(trackIndex)
            } else {
              newAF.index = trackIndex
            }
          }
          audiobook.addAudioFile(newAF)
        }
        audiobook.rebuildTracks()
      } else if (!audiobook.ebooks.length) {
        // Audiobook has no ebooks and no valid audio tracks do not continue
        Logger.warn(`[Scanner] Audiobook has no ebooks and no valid audio tracks "${audiobook.path}"`)
        return null
      }
    }

    // Look for desc.txt and reader.txt and update
    await audiobook.saveDataFromTextFiles()

    // Extract embedded cover art if cover is not already in directory
    if (audiobook.hasEmbeddedCoverArt && !audiobook.cover) {
      var outputCoverDirs = this.getCoverDirectory(audiobook)
      var relativeDir = await audiobook.saveEmbeddedCoverArt(outputCoverDirs.fullPath, outputCoverDirs.relPath)
      if (relativeDir) {
        Logger.debug(`[Scanner] Saved embedded cover art "${relativeDir}"`)
      }
    }

    return audiobook
  }
}
module.exports = Scanner