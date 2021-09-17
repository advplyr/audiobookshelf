const fs = require('fs-extra')
const Path = require('path')
const Logger = require('./Logger')
const BookFinder = require('./BookFinder')
const Audiobook = require('./objects/Audiobook')
const audioFileScanner = require('./utils/audioFileScanner')
const { groupFilesIntoAudiobookPaths, getAudiobookFileData, scanRootDir } = require('./utils/scandir')
const { comparePaths, getIno } = require('./utils/index')
const { secondsToTimestamp } = require('./utils/fileUtils')
const { ScanResult } = require('./utils/constants')

class Scanner {
  constructor(AUDIOBOOK_PATH, METADATA_PATH, db, emitter) {
    this.AudiobookPath = AUDIOBOOK_PATH
    this.MetadataPath = METADATA_PATH
    this.db = db
    this.emitter = emitter

    this.cancelScan = false

    this.bookFinder = new BookFinder()
  }

  get audiobooks() {
    return this.db.audiobooks
  }

  async setAudiobookDataInos(audiobookData) {
    for (let i = 0; i < audiobookData.length; i++) {
      var abd = audiobookData[i]
      var matchingAB = this.db.audiobooks.find(_ab => comparePaths(_ab.path, abd.path))
      if (matchingAB) {
        if (!matchingAB.ino) {
          matchingAB.ino = await getIno(matchingAB.fullPath)
        }
        abd.ino = matchingAB.ino
      } else {
        abd.ino = await getIno(abd.fullPath)
        if (!abd.ino) {
          Logger.error('[Scanner] Invalid ino - ignoring audiobook data', abd.path)
        }
      }
    }
    return audiobookData.filter(abd => !!abd.ino)
  }

  async setAudioFileInos(audiobookDataAudioFiles, audiobookAudioFiles) {
    for (let i = 0; i < audiobookDataAudioFiles.length; i++) {
      var abdFile = audiobookDataAudioFiles[i]
      var matchingFile = audiobookAudioFiles.find(af => comparePaths(af.path, abdFile.path))
      if (matchingFile) {
        if (!matchingFile.ino) {
          matchingFile.ino = await getIno(matchingFile.fullPath)
        }
        abdFile.ino = matchingFile.ino
      } else {
        abdFile.ino = await getIno(abdFile.fullPath)
        if (!abdFile.ino) {
          Logger.error('[Scanner] Invalid abdFile ino - ignoring abd audio file', abdFile.path)
        }
      }
    }
    return audiobookDataAudioFiles.filter(abdFile => !!abdFile.ino)
  }

  async scanAudiobookData(audiobookData) {
    var existingAudiobook = this.audiobooks.find(a => a.ino === audiobookData.ino)
    Logger.debug(`[Scanner] Scanning "${audiobookData.title}" (${audiobookData.ino}) - ${!!existingAudiobook ? 'Exists' : 'New'}`)

    if (existingAudiobook) {

      // REMOVE: No valid audio files
      // TODO: Label as incomplete, do not actually delete
      if (!audiobookData.audioFiles.length) {
        Logger.error(`[Scanner] "${existingAudiobook.title}" no valid audio files found - removing audiobook`)

        await this.db.removeEntity('audiobook', existingAudiobook.id)
        this.emitter('audiobook_removed', existingAudiobook.toJSONMinified())

        return ScanResult.REMOVED
      }

      audiobookData.audioFiles = await this.setAudioFileInos(audiobookData.audioFiles, existingAudiobook.audioFiles)

      // Check for audio files that were removed
      var abdAudioFileInos = audiobookData.audioFiles.map(af => af.ino)
      var removedAudioFiles = existingAudiobook.audioFiles.filter(file => !abdAudioFileInos.includes(file.ino))
      if (removedAudioFiles.length) {
        Logger.info(`[Scanner] ${removedAudioFiles.length} audio files removed for audiobook "${existingAudiobook.title}"`)
        removedAudioFiles.forEach((af) => existingAudiobook.removeAudioFile(af))
      }

      // Check for new audio files and sync existing audio files
      var newAudioFiles = []
      var hasUpdatedAudioFiles = false
      audiobookData.audioFiles.forEach((file) => {
        var existingAudioFile = existingAudiobook.getAudioFileByIno(file.ino)
        if (existingAudioFile) { // Audio file exists, sync paths
          if (existingAudiobook.syncAudioFile(existingAudioFile, file)) {
            hasUpdatedAudioFiles = true
          }
        } else {
          newAudioFiles.push(file)
        }
      })
      if (newAudioFiles.length) {
        Logger.info(`[Scanner] ${newAudioFiles.length} new audio files were found for audiobook "${existingAudiobook.title}"`)
        // Scan new audio files found - sets tracks
        await audioFileScanner.scanAudioFiles(existingAudiobook, newAudioFiles)
      }

      // REMOVE: No valid audio tracks
      // TODO: Label as incomplete, do not actually delete
      if (!existingAudiobook.tracks.length) {
        Logger.error(`[Scanner] "${existingAudiobook.title}" has no valid tracks after update - removing audiobook`)

        await this.db.removeEntity('audiobook', existingAudiobook.id)
        this.emitter('audiobook_removed', existingAudiobook.toJSONMinified())
        return ScanResult.REMOVED
      }

      var hasUpdates = removedAudioFiles.length || newAudioFiles.length || hasUpdatedAudioFiles

      if (existingAudiobook.checkUpdateMissingParts()) {
        Logger.info(`[Scanner] "${existingAudiobook.title}" missing parts updated`)
        hasUpdates = true
      }

      if (existingAudiobook.syncOtherFiles(audiobookData.otherFiles)) {
        hasUpdates = true
      }

      // Syncs path and fullPath
      if (existingAudiobook.syncPaths(audiobookData)) {
        hasUpdates = true
      }

      if (existingAudiobook.isMissing) {
        existingAudiobook.isMissing = false
        hasUpdates = true
        Logger.info(`[Scanner] "${existingAudiobook.title}" was missing but now it is found`)
      }

      if (hasUpdates) {
        existingAudiobook.setChapters()

        Logger.info(`[Scanner] "${existingAudiobook.title}" was updated - saving`)
        existingAudiobook.lastUpdate = Date.now()
        await this.db.updateAudiobook(existingAudiobook)
        this.emitter('audiobook_updated', existingAudiobook.toJSONMinified())

        return ScanResult.UPDATED
      }

      return ScanResult.UPTODATE
    }

    // NEW: Check new audiobook
    if (!audiobookData.audioFiles.length) {
      Logger.error('[Scanner] No valid audio tracks for Audiobook', audiobookData.path)
      return ScanResult.NOTHING
    }

    var audiobook = new Audiobook()
    audiobook.setData(audiobookData)
    await audioFileScanner.scanAudioFiles(audiobook, audiobookData.audioFiles)
    if (!audiobook.tracks.length) {
      Logger.warn('[Scanner] Invalid audiobook, no valid tracks', audiobook.title)
      return ScanResult.NOTHING
    }

    audiobook.checkUpdateMissingParts()
    audiobook.setChapters()

    Logger.info(`[Scanner] Audiobook "${audiobook.title}" Scanned (${audiobook.sizePretty}) [${audiobook.durationPretty}]`)
    await this.db.insertAudiobook(audiobook)
    this.emitter('audiobook_added', audiobook.toJSONMinified())
    return ScanResult.ADDED
  }

  async scan() {
    // TODO: This temporary fix from pre-release should be removed soon, including the "fixRelativePath" and "checkUpdateInos"
    // TEMP - fix relative file paths
    // TEMP - update ino for each audiobook
    // if (this.audiobooks.length) {
    //   for (let i = 0; i < this.audiobooks.length; i++) {
    //     var ab = this.audiobooks[i]
    //     var shouldUpdate = ab.fixRelativePath(this.AudiobookPath) || !ab.ino

    //     // Update ino if an audio file has the same ino as the audiobook
    //     var shouldUpdateIno = !ab.ino || (ab.audioFiles || []).find(abf => abf.ino === ab.ino)
    //     if (shouldUpdateIno) {
    //       await ab.checkUpdateInos()
    //     }
    //     if (shouldUpdate) {
    //       await this.db.updateAudiobook(ab)
    //     }
    //   }
    // }

    const scanStart = Date.now()
    var audiobookDataFound = await scanRootDir(this.AudiobookPath, this.db.serverSettings)

    // Set ino for each ab data as a string
    audiobookDataFound = await this.setAudiobookDataInos(audiobookDataFound)

    if (this.cancelScan) {
      this.cancelScan = false
      return null
    }

    var scanResults = {
      removed: 0,
      updated: 0,
      added: 0,
      missing: 0
    }

    // Check for removed audiobooks
    for (let i = 0; i < this.audiobooks.length; i++) {
      var audiobook = this.audiobooks[i]
      var dataFound = audiobookDataFound.find(abd => abd.ino === audiobook.ino)
      if (!dataFound) {
        Logger.info(`[Scanner] Audiobook "${audiobook.title}" is missing`)
        audiobook.isMissing = true
        audiobook.lastUpdate = Date.now()
        scanResults.missing++
        await this.db.updateAudiobook(audiobook)
        this.emitter('audiobook_updated', audiobook.toJSONMinified())
      }
      if (this.cancelScan) {
        this.cancelScan = false
        return null
      }
    }

    // Check for new and updated audiobooks
    for (let i = 0; i < audiobookDataFound.length; i++) {
      var audiobookData = audiobookDataFound[i]
      var result = await this.scanAudiobookData(audiobookData)
      if (result === ScanResult.ADDED) scanResults.added++
      if (result === ScanResult.REMOVED) scanResults.removed++
      if (result === ScanResult.UPDATED) scanResults.updated++

      var progress = Math.round(100 * (i + 1) / audiobookDataFound.length)
      this.emitter('scan_progress', {
        scanType: 'files',
        progress: {
          total: audiobookDataFound.length,
          done: i + 1,
          progress
        }
      })
      if (this.cancelScan) {
        this.cancelScan = false
        break
      }
    }
    const scanElapsed = Math.floor((Date.now() - scanStart) / 1000)
    Logger.info(`[Scanned] Finished | ${scanResults.added} added | ${scanResults.updated} updated | ${scanResults.removed} removed | ${scanResults.missing} missing | elapsed: ${secondsToTimestamp(scanElapsed)}`)
    return scanResults
  }

  async scanAudiobook(audiobookPath) {
    Logger.debug('[Scanner] scanAudiobook', audiobookPath)
    var audiobookData = await getAudiobookFileData(this.AudiobookPath, audiobookPath, this.db.serverSettings)
    if (!audiobookData) {
      return ScanResult.NOTHING
    }
    audiobookData.ino = await getIno(audiobookData.fullPath)
    return this.scanAudiobookData(audiobookData)
  }

  // Files were modified in this directory, check it out
  async checkDir(dir) {
    var exists = await fs.pathExists(dir)
    if (!exists) {
      // Audiobook was deleted, TODO: Should confirm this better
      var audiobook = this.db.audiobooks.find(ab => ab.fullPath === dir)
      if (audiobook) {
        var audiobookJSON = audiobook.toJSONMinified()
        await this.db.removeEntity('audiobook', audiobook.id)
        this.emitter('audiobook_removed', audiobookJSON)
        return ScanResult.REMOVED
      }

      // Path inside audiobook was deleted, scan audiobook
      audiobook = this.db.audiobooks.find(ab => dir.startsWith(ab.fullPath))
      if (audiobook) {
        Logger.info(`[Scanner] Path inside audiobook "${audiobook.title}" was deleted: ${dir}`)
        return this.scanAudiobook(audiobook.fullPath)
      }

      Logger.warn('[Scanner] Path was deleted but no audiobook found', dir)
      return ScanResult.NOTHING
    }

    // Check if this is a subdirectory of an audiobook
    var audiobook = this.db.audiobooks.find((ab) => dir.startsWith(ab.fullPath))
    if (audiobook) {
      Logger.debug(`[Scanner] Check Dir audiobook "${audiobook.title}" found: ${dir}`)
      return this.scanAudiobook(audiobook.fullPath)
    }

    // Check if an audiobook is a subdirectory of this dir
    audiobook = this.db.audiobooks.find(ab => ab.fullPath.startsWith(dir))
    if (audiobook) {
      Logger.warn(`[Scanner] Files were added/updated in a root directory of an existing audiobook, ignore files: ${dir}`)
      return ScanResult.NOTHING
    }

    // Must be a new audiobook
    Logger.debug(`[Scanner] Check Dir must be a new audiobook: ${dir}`)
    return this.scanAudiobook(dir)
  }

  // Array of files that may have been renamed, removed or added
  async filesChanged(filepaths) {
    if (!filepaths.length) return ScanResult.NOTHING
    var relfilepaths = filepaths.map(path => path.replace(this.AudiobookPath, ''))
    var fileGroupings = groupFilesIntoAudiobookPaths(relfilepaths)

    var results = []
    for (const dir in fileGroupings) {
      Logger.debug(`[Scanner] Check dir ${dir}`)
      var fullPath = Path.join(this.AudiobookPath, dir)
      var result = await this.checkDir(fullPath)
      Logger.debug(`[Scanner] Check dir result ${result}`)
      results.push(result)
    }
    return results
  }

  async fetchMetadata(id, trackIndex = 0) {
    var audiobook = this.audiobooks.find(a => a.id === id)
    if (!audiobook) {
      return false
    }
    var tracks = audiobook.tracks
    var index = isNaN(trackIndex) ? 0 : Number(trackIndex)
    var firstTrack = tracks[index]
    var firstTrackFullPath = firstTrack.fullPath
    var scanResult = await audioFileScanner.scan(firstTrackFullPath)
    return scanResult
  }

  async scanCovers() {
    var audiobooksNeedingCover = this.audiobooks.filter(ab => !ab.cover && ab.author)
    var found = 0
    var notFound = 0
    for (let i = 0; i < audiobooksNeedingCover.length; i++) {
      var audiobook = audiobooksNeedingCover[i]
      var options = {
        titleDistance: 2,
        authorDistance: 2
      }
      var results = await this.bookFinder.findCovers('openlibrary', audiobook.title, audiobook.author, options)
      if (results.length) {
        Logger.debug(`[Scanner] Found best cover for "${audiobook.title}"`)
        audiobook.book.cover = results[0]
        await this.db.updateAudiobook(audiobook)
        found++
        this.emitter('audiobook_updated', audiobook.toJSONMinified())
      } else {
        notFound++
      }

      var progress = Math.round(100 * (i + 1) / audiobooksNeedingCover.length)
      this.emitter('scan_progress', {
        scanType: 'covers',
        progress: {
          total: audiobooksNeedingCover.length,
          done: i + 1,
          progress
        }
      })

      if (this.cancelScan) {
        this.cancelScan = false
        break
      }
    }
    return {
      found,
      notFound
    }
  }

  async find(req, res) {
    var method = req.params.method
    var query = req.query

    var result = null

    if (method === 'isbn') {
      result = await this.bookFinder.findByISBN(query)
    } else if (method === 'search') {
      result = await this.bookFinder.search(query.provider, query.title, query.author || null)
    }

    res.json(result)
  }

  async findCovers(req, res) {
    var query = req.query
    var options = {
      fallbackTitleOnly: !!query.fallbackTitleOnly
    }
    var result = await this.bookFinder.findCovers(query.provider, query.title, query.author || null, options)
    res.json(result)
  }
}
module.exports = Scanner