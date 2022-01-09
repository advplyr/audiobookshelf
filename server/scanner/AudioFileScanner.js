const Path = require('path')

const AudioFile = require('../objects/AudioFile')

const prober = require('../utils/prober')
const Logger = require('../Logger')
const { LogLevel } = require('../utils/constants')

class AudioFileScanner {
  constructor() { }

  getTrackAndDiscNumberFromFilename(bookScanData, filename) {
    const { title, author, series, publishYear } = bookScanData
    var partbasename = Path.basename(filename, Path.extname(filename))

    // Remove title, author, series, and publishYear from filename if there
    if (title) partbasename = partbasename.replace(title, '')
    if (author) partbasename = partbasename.replace(author, '')
    if (series) partbasename = partbasename.replace(series, '')
    if (publishYear) partbasename = partbasename.replace(publishYear)

    // Look for disc number
    var discNumber = null
    var discMatch = partbasename.match(/\b(disc|cd) ?(\d\d?)\b/i)
    if (discMatch && discMatch.length > 2 && discMatch[2]) {
      if (!isNaN(discMatch[2])) {
        discNumber = Number(discMatch[2])
      }

      // Remove disc number from filename
      partbasename = partbasename.replace(/\b(disc|cd) ?(\d\d?)\b/i, '')
    }

    var numbersinpath = partbasename.match(/\d{1,4}/g)
    var trackNumber = numbersinpath && numbersinpath.length ? parseInt(numbersinpath[0]) : null
    return {
      trackNumber,
      discNumber
    }
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
    audioFileData.trackNumFromMeta = probeData.trackNumber
    audioFileData.discNumFromMeta = probeData.discNumber

    const { trackNumber, discNumber } = this.getTrackAndDiscNumberFromFilename(bookScanData, audioFileData.filename)
    audioFileData.trackNumFromFilename = trackNumber
    audioFileData.discNumFromFilename = discNumber

    audioFile.setDataFromProbe(audioFileData, probeData)

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

  isSequential(nums) {
    if (!nums || !nums.length) return false
    if (nums.length === 1) return true
    var prev = nums[0]
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] - prev > 1) return false
      prev = nums[i]
    }
    return true
  }

  removeDupes(nums) {
    if (!nums || !nums.length) return []
    if (nums.length === 1) return nums

    var nodupes = [nums[0]]
    nums.forEach((num) => {
      if (num > nodupes[nodupes.length - 1]) nodupes.push(num)
    })
    return nodupes
  }

  // Must be all audiofiles in audiobook
  runSmartTrackOrder(audiobook, audioFiles) {
    var discsFromFilename = []
    var tracksFromFilename = []
    var discsFromMeta = []
    var tracksFromMeta = []

    audioFiles.forEach((af) => {
      if (af.discNumFromFilename !== null) discsFromFilename.push(af.discNumFromFilename)
      if (af.discNumFromMeta !== null) discsFromMeta.push(af.discNumFromMeta)
      if (af.trackNumFromFilename !== null) tracksFromFilename.push(af.trackNumFromFilename)
      if (af.trackNumFromMeta !== null) tracksFromMeta.push(af.trackNumFromMeta)
      af.validateTrackIndex() // Sets error if no valid track number
    })
    discsFromFilename.sort((a, b) => a - b)
    discsFromMeta.sort((a, b) => a - b)
    tracksFromFilename.sort((a, b) => a - b)
    tracksFromMeta.sort((a, b) => a - b)
    console.log('AB DISCS', audiobook.title, discsFromFilename, discsFromMeta)
    console.log('AB TRACKS', audiobook.title, tracksFromFilename, tracksFromMeta)

    var discKey = null
    if (discsFromMeta.length === audioFiles.length && this.isSequential(discsFromMeta)) {
      discKey = 'discNumFromMeta'
    } else if (discsFromFilename.length === audioFiles.length && this.isSequential(discsFromFilename)) {
      discKey = 'discNumFromFilename'
    }

    var trackKey = null
    tracksFromFilename = this.removeDupes(tracksFromFilename)
    tracksFromMeta = this.removeDupes(tracksFromMeta)
    if (tracksFromFilename.length > tracksFromMeta.length) {
      trackKey = 'trackNumFromFilename'
    } else {
      trackKey = 'trackNumFromMeta'
    }


    if (discKey !== null) {
      Logger.debug(`[AudioFileScanner] Smart track order for "${audiobook.title}" using disc key ${discKey} and track key ${trackKey}`)
      audioFiles.sort((a, b) => {
        let Dx = a[discKey] - b[discKey]
        if (Dx === 0) Dx = a[trackKey] - b[trackKey]
        return Dx
      })
    } else {
      Logger.debug(`[AudioFileScanner] Smart track order for "${audiobook.title}" using track key ${trackKey}`)
      audioFiles.sort((a, b) => a[trackKey] - b[trackKey])
    }

    for (let i = 0; i < audioFiles.length; i++) {
      audioFiles[i].index = i + 1
      audiobook.addAudioFile(audioFiles[i])
    }
  }

  async scanAudioFiles(audioFileDataArray, bookScanData, audiobook, preferAudioMetadata, libraryScan = null) {
    var hasUpdated = false

    var audioScanResult = await this.executeAudioFileScans(audioFileDataArray, bookScanData)
    if (audioScanResult.audioFiles.length) {
      if (libraryScan) {
        libraryScan.addLog(LogLevel.DEBUG, `Book "${bookScanData.path}" Audio file scan took ${audioScanResult.elapsed}ms for ${audioScanResult.audioFiles.length} with average time of ${audioScanResult.averageScanDuration}ms`)
      }

      var numExistingAudioFilesToInclude = audiobook.audioFilesToInclude.filter(af => !audioScanResult.audioFiles.find(_af => _af.ino === af.ino)).length
      var totalAudioFilesToInclude = numExistingAudioFilesToInclude + audioScanResult.audioFiles.length

      if (numExistingAudioFilesToInclude <= 0) { // SMART TRACK ORDER for New or empty audiobooks
        this.runSmartTrackOrder(audiobook, audioScanResult.audioFiles)
        hasUpdated = true
      } else {
        // validate & add/update audio files to existing audiobook
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