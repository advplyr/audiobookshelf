const Path = require('path')
const Logger = require('./Logger')
const BookFinder = require('./BookFinder')
const Audiobook = require('./Audiobook')
const audioFileScanner = require('./utils/audioFileScanner')
const { getAllAudiobookFiles } = require('./utils/scandir')
const { secondsToTimestamp } = require('./utils/fileUtils')

class Scanner {
  constructor(AUDIOBOOK_PATH, METADATA_PATH, db, emitter) {
    this.AudiobookPath = AUDIOBOOK_PATH
    this.MetadataPath = METADATA_PATH
    this.db = db
    this.emitter = emitter

    this.bookFinder = new BookFinder()
  }

  get audiobooks() {
    return this.db.audiobooks
  }

  async scan() {
    // TEMP - fix relative file paths
    if (this.audiobooks.length) {
      for (let i = 0; i < this.audiobooks.length; i++) {
        var ab = this.audiobooks[i]
        if (ab.fixRelativePath(this.AudiobookPath)) {
          await this.db.updateAudiobook(ab)
        }
      }
    }

    const scanStart = Date.now()
    var audiobookDataFound = await getAllAudiobookFiles(this.AudiobookPath)

    var scanResults = {
      removed: 0,
      updated: 0,
      added: 0
    }

    // Check for removed audiobooks
    for (let i = 0; i < this.audiobooks.length; i++) {
      var dataFound = audiobookDataFound.find(abd => abd.path === this.audiobooks[i].path)
      if (!dataFound) {
        Logger.info(`[Scanner] Removing audiobook "${this.audiobooks[i].title}" - no longer in dir`)

        await this.db.removeEntity('audiobook', this.audiobooks[i].id)
        if (!this.audiobooks[i]) {
          Logger.error('[Scanner] Oops... audiobook is now invalid...')
          continue;
        }
        scanResults.removed++
        this.emitter('audiobook_removed', this.audiobooks[i].toJSONMinified())
      }
    }

    for (let i = 0; i < audiobookDataFound.length; i++) {
      var audiobookData = audiobookDataFound[i]
      var existingAudiobook = this.audiobooks.find(a => a.fullPath === audiobookData.fullPath)
      if (existingAudiobook) {
        Logger.debug(`[Scanner] Audiobook already added, check updates for "${existingAudiobook.title}"`)

        if (!audiobookData.parts.length) {
          Logger.error(`[Scanner] "${existingAudiobook.title}" no valid audio files found - removing audiobook`)

          await this.db.removeEntity('audiobook', existingAudiobook.id)
          this.emitter('audiobook_removed', existingAudiobook.toJSONMinified())
          scanResults.removed++
        } else {

          // Check for audio files that were removed
          var removedAudioFiles = existingAudiobook.audioFiles.filter(file => !audiobookData.parts.includes(file.filename))
          if (removedAudioFiles.length) {
            Logger.info(`[Scanner] ${removedAudioFiles.length} audio files removed for audiobook "${existingAudiobook.title}"`)
            removedAudioFiles.forEach((af) => existingAudiobook.removeAudioFile(af))
          }

          // Check for audio files that were added
          var newParts = audiobookData.parts.filter(part => !existingAudiobook.audioPartExists(part))
          if (newParts.length) {
            Logger.info(`[Scanner] ${newParts.length} new audio parts were found for audiobook "${existingAudiobook.title}"`)

            // If previously invalid part, remove from invalid list because it will be re-scanned
            newParts.forEach((part) => {
              if (existingAudiobook.invalidParts.includes(part)) {
                existingAudiobook.invalidParts = existingAudiobook.invalidParts.filter(p => p !== part)
              }
            })
            // Scan new audio parts found
            await audioFileScanner.scanParts(existingAudiobook, newParts)
          }

          if (!existingAudiobook.tracks.length) {
            Logger.error(`[Scanner] "${existingAudiobook.title}" has no valid tracks after update - removing audiobook`)

            await this.db.removeEntity('audiobook', existingAudiobook.id)
            this.emitter('audiobook_removed', existingAudiobook.toJSONMinified())
          } else {
            var hasUpdates = removedAudioFiles.length || newParts.length

            if (existingAudiobook.checkUpdateMissingParts()) {
              Logger.info(`[Scanner] "${existingAudiobook.title}" missing parts updated`)
              hasUpdates = true
            }

            if (existingAudiobook.syncOtherFiles(audiobookData.otherFiles)) {
              hasUpdates = true
            }

            if (hasUpdates) {
              Logger.info(`[Scanner] "${existingAudiobook.title}" was updated - saving`)
              existingAudiobook.lastUpdate = Date.now()
              await this.db.updateAudiobook(existingAudiobook)
              this.emitter('audiobook_updated', existingAudiobook.toJSONMinified())
              scanResults.updated++
            }
          }
        } // end if update existing
      } else {
        if (!audiobookData.parts.length) {
          Logger.error('[Scanner] No valid audio tracks for Audiobook', audiobookData)
        } else {
          var audiobook = new Audiobook()
          audiobook.setData(audiobookData)
          await audioFileScanner.scanParts(audiobook, audiobookData.parts)
          if (!audiobook.tracks.length) {
            Logger.warn('[Scanner] Invalid audiobook, no valid tracks', audiobook.title)
          } else {
            audiobook.checkUpdateMissingParts()
            Logger.info(`[Scanner] Audiobook "${audiobook.title}" Scanned (${audiobook.sizePretty}) [${audiobook.durationPretty}]`)
            await this.db.insertAudiobook(audiobook)
            this.emitter('audiobook_added', audiobook.toJSONMinified())
            scanResults.added++
          }
        } // end if add new
      }
      var progress = Math.round(100 * (i + 1) / audiobookDataFound.length)
      this.emitter('scan_progress', {
        total: audiobookDataFound.length,
        done: i + 1,
        progress
      })
    }
    const scanElapsed = Math.floor((Date.now() - scanStart) / 1000)
    Logger.info(`[Scanned] Finished | ${scanResults.added} added | ${scanResults.updated} updated | ${scanResults.removed} removed | elapsed: ${secondsToTimestamp(scanElapsed)}`)
    return scanResults
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
    var result = await this.bookFinder.findCovers(query.provider, query.title, query.author || null)
    res.json(result)
  }
}
module.exports = Scanner