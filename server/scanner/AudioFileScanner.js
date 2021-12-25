const Path = require('path')

const AudioFile = require('../objects/AudioFile')

const prober = require('../utils/prober')
const Logger = require('../Logger')
const { LogLevel } = require('../utils/constants')

class AudioFileScanner {
  constructor() { }

  getTrackNumberFromMeta(scanData) {
    return !isNaN(scanData.trackNumber) && scanData.trackNumber !== null ? Math.trunc(Number(scanData.trackNumber)) : null
  }

  getTrackNumberFromFilename(bookScanData, filename) {
    const { title, author, series, publishYear } = bookScanData
    var partbasename = Path.basename(filename, Path.extname(filename))

    // Remove title, author, series, and publishYear from filename if there
    if (title) partbasename = partbasename.replace(title, '')
    if (author) partbasename = partbasename.replace(author, '')
    if (series) partbasename = partbasename.replace(series, '')
    if (publishYear) partbasename = partbasename.replace(publishYear)

    // Remove eg. "disc 1" from path
    partbasename = partbasename.replace(/\bdisc \d\d?\b/i, '')

    // Remove "cd01" or "cd 01" from path
    partbasename = partbasename.replace(/\bcd ?\d\d?\b/i, '')

    var numbersinpath = partbasename.match(/\d{1,4}/g)
    if (!numbersinpath) return null

    var number = numbersinpath.length ? parseInt(numbersinpath[0]) : null
    return number
  }

  getCdNumberFromFilename(bookScanData, filename) {
    const { title, author, series, publishYear } = bookScanData
    var partbasename = Path.basename(filename, Path.extname(filename))

    // Remove title, author, series, and publishYear from filename if there
    if (title) partbasename = partbasename.replace(title, '')
    if (author) partbasename = partbasename.replace(author, '')
    if (series) partbasename = partbasename.replace(series, '')
    if (publishYear) partbasename = partbasename.replace(publishYear)

    var cdNumber = null

    var cdmatch = partbasename.match(/\b(disc|cd) ?(\d\d?)\b/i)
    if (cdmatch && cdmatch.length > 2 && cdmatch[2]) {
      if (!isNaN(cdmatch[2])) {
        cdNumber = Number(cdmatch[2])
      }
    }

    return cdNumber
  }

  getAverageScanDurationMs(results) {
    if (!results.length) return 0
    var total = 0
    for (let i = 0; i < results.length; i++) total += results[i].elapsed
    return Math.floor(total / results.length)
  }

  async scan(audioFileData, bookScanData, verbose = false) {
    var probeStart = Date.now()
    // Logger.debug(`[AudioFileScanner] Start Probe ${audioFileData.fullPath}`)
    var probeData = await prober.probe(audioFileData.fullPath, verbose)
    if (probeData.error) {
      Logger.error(`[AudioFileScanner] ${probeData.error} : "${audioFileData.fullPath}"`)
      return null
    }
    // Logger.debug(`[AudioFileScanner] Finished Probe ${audioFileData.fullPath} elapsed ${msToTimestamp(Date.now() - probeStart, true)}`)

    var audioFile = new AudioFile()
    audioFileData.trackNumFromMeta = this.getTrackNumberFromMeta(probeData)
    audioFileData.trackNumFromFilename = this.getTrackNumberFromFilename(bookScanData, audioFileData.filename)
    audioFileData.cdNumFromFilename = this.getCdNumberFromFilename(bookScanData, audioFileData.filename)
    audioFile.setDataFromProbe(audioFileData, probeData)
    if (audioFile.embeddedCoverArt) {

    }
    return {
      audioFile,
      elapsed: Date.now() - probeStart
    }
  }


  // Returns array of { AudioFile, elapsed, averageScanDuration } from audio file scan objects
  async executeAudioFileScans(audioFileDataArray, bookScanData) {
    var proms = []
    for (let i = 0; i < audioFileDataArray.length; i++) {
      proms.push(this.scan(audioFileDataArray[i], bookScanData))
    }
    var scanStart = Date.now()
    var results = await Promise.all(proms).then((scanResults) => scanResults.filter(sr => sr))
    return {
      audioFiles: results.map(r => r.audioFile),
      elapsed: Date.now() - scanStart,
      averageScanDuration: this.getAverageScanDurationMs(results)
    }
  }

  async scanAudioFiles(audioFileDataArray, bookScanData, audiobook, preferAudioMetadata, libraryScan = null) {
    var hasUpdated = false

    var audioScanResult = await this.executeAudioFileScans(audioFileDataArray, bookScanData)
    if (audioScanResult.audioFiles.length) {
      if (libraryScan) {
        libraryScan.addLog(LogLevel.DEBUG, `Book "${bookScanData.path}" Audio file scan took ${audioScanResult.elapsed}ms for ${audioScanResult.audioFiles.length} with average time of ${audioScanResult.averageScanDuration}ms`)
      }

      var totalAudioFilesToInclude = audiobook.audioFilesToInclude.filter(af => !audioScanResult.audioFiles.find(_af => _af.ino === af.ino)).length + audioScanResult.audioFiles.length

      // validate & add/update audio files to audiobook
      for (let i = 0; i < audioScanResult.audioFiles.length; i++) {
        var newAF = audioScanResult.audioFiles[i]
        var existingAF = audiobook.getAudioFileByIno(newAF.ino)

        var trackIndex = null
        if (totalAudioFilesToInclude === 1) { // Single track audiobooks
          trackIndex = 1
        } else if (existingAF && existingAF.manuallyVerified) { // manually verified audio files use existing index
          trackIndex = existingAF.index
        } else {
          trackIndex = newAF.validateTrackIndex()
        }

        if (trackIndex !== null) {
          if (audiobook.checkHasTrackNum(trackIndex, newAF.ino)) {
            newAF.setDuplicateTrackNumber(trackIndex)
          } else {
            newAF.index = trackIndex
          }
        }
        if (existingAF) {
          if (audiobook.updateAudioFile(newAF)) {
            hasUpdated = true
          }
        } else {
          audiobook.addAudioFile(newAF)
          hasUpdated = true
        }
      }

      // Set book details from audio file ID3 tags, optional prefer
      if (audiobook.setDetailsFromFileMetadata(preferAudioMetadata)) {
        hasUpdated = true
      }

      if (hasUpdated) {
        audiobook.rebuildTracks()
      }
    }
    return hasUpdated
  }
}
module.exports = new AudioFileScanner()