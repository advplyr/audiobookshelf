const Path = require('path')

const AudioFile = require('../objects/files/AudioFile')
const VideoFile = require('../objects/files/VideoFile')

const prober = require('../utils/prober')
const Logger = require('../Logger')
const { LogLevel } = require('../utils/constants')

class MediaFileScanner {
  constructor() { }

  getTrackAndDiscNumberFromFilename(mediaMetadataFromScan, audioLibraryFile) {
    const { title, author, series, publishedYear } = mediaMetadataFromScan
    const { filename, path } = audioLibraryFile.metadata
    var partbasename = Path.basename(filename, Path.extname(filename))

    // Remove title, author, series, and publishedYear from filename if there
    if (title) partbasename = partbasename.replace(title, '')
    if (author) partbasename = partbasename.replace(author, '')
    if (series) partbasename = partbasename.replace(series, '')
    if (publishedYear) partbasename = partbasename.replace(publishedYear)

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

    // Look for disc number in folder path e.g. /Book Title/CD01/audiofile.mp3
    var pathdir = Path.dirname(path).split('/').pop()
    if (pathdir && /^cd\d{1,3}$/i.test(pathdir)) {
      var discFromFolder = Number(pathdir.replace(/cd/i, ''))
      if (!isNaN(discFromFolder) && discFromFolder !== null) discNumber = discFromFolder
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

  async scan(mediaType, libraryFile, mediaMetadataFromScan, verbose = false) {
    var probeStart = Date.now()
    var probeData = await prober.probe(libraryFile.metadata.path, verbose)
    if (probeData.error) {
      Logger.error(`[MediaFileScanner] ${probeData.error} : "${libraryFile.metadata.path}"`)
      return null
    }

    if (mediaType === 'video') {
      if (!probeData.videoStream) {
        Logger.error('[MediaFileScanner] Invalid video file no video stream')
        return null
      }

      var videoFile = new VideoFile()
      videoFile.setDataFromProbe(libraryFile, probeData)

      return {
        videoFile,
        elapsed: Date.now() - probeStart
      }
    } else {
      if (!probeData.audioStream) {
        Logger.error('[MediaFileScanner] Invalid audio file no audio stream')
        return null
      }

      var audioFile = new AudioFile()
      audioFile.trackNumFromMeta = probeData.trackNumber
      audioFile.discNumFromMeta = probeData.discNumber
      if (mediaType === 'book') {
        const { trackNumber, discNumber } = this.getTrackAndDiscNumberFromFilename(mediaMetadataFromScan, libraryFile)
        audioFile.trackNumFromFilename = trackNumber
        audioFile.discNumFromFilename = discNumber
      }
      audioFile.setDataFromProbe(libraryFile, probeData)

      return {
        audioFile,
        elapsed: Date.now() - probeStart
      }
    }
  }

  // Returns array of { MediaFile, elapsed, averageScanDuration } from audio file scan objects
  async executeMediaFileScans(mediaType, mediaLibraryFiles, scanData) {
    var mediaMetadataFromScan = scanData.media.metadata || null
    var proms = []
    for (let i = 0; i < mediaLibraryFiles.length; i++) {
      proms.push(this.scan(mediaType, mediaLibraryFiles[i], mediaMetadataFromScan))
    }
    var scanStart = Date.now()
    var results = await Promise.all(proms).then((scanResults) => scanResults.filter(sr => sr))
    return {
      audioFiles: results.filter(r => r.audioFile).map(r => r.audioFile),
      videoFiles: results.filter(r => r.videoFile).map(r => r.videoFile),
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

  runSmartTrackOrder(libraryItem, audioFiles) {
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
      Logger.debug(`[AudioFileScanner] Smart track order for "${libraryItem.media.metadata.title}" using disc key ${discKey} and track key ${trackKey}`)
      audioFiles.sort((a, b) => {
        let Dx = a[discKey] - b[discKey]
        if (Dx === 0) Dx = a[trackKey] - b[trackKey]
        return Dx
      })
    } else {
      Logger.debug(`[AudioFileScanner] Smart track order for "${libraryItem.media.metadata.title}" using track key ${trackKey}`)
      audioFiles.sort((a, b) => a[trackKey] - b[trackKey])
    }

    for (let i = 0; i < audioFiles.length; i++) {
      audioFiles[i].index = i + 1
      var existingAF = libraryItem.media.findFileWithInode(audioFiles[i].ino)
      if (existingAF) {
        if (existingAF.updateFromScan) existingAF.updateFromScan(audioFiles[i])
      } else {
        libraryItem.media.addAudioFile(audioFiles[i])
      }
    }
  }

  async scanMediaFiles(mediaLibraryFiles, scanData, libraryItem, preferAudioMetadata, preferOverdriveMediaMarker, libraryScan = null) {
    var hasUpdated = false

    var mediaScanResult = await this.executeMediaFileScans(libraryItem.mediaType, mediaLibraryFiles, scanData)
    if (libraryItem.mediaType === 'video') {
      if (mediaScanResult.videoFiles.length) {
        // TODO: Check for updates etc
        hasUpdated = true
        libraryItem.media.setVideoFile(mediaScanResult.videoFiles[0])
      }
    } else if (mediaScanResult.audioFiles.length) {
      if (libraryScan) {
        libraryScan.addLog(LogLevel.DEBUG, `Library Item "${scanData.path}" Audio file scan took ${mediaScanResult.elapsed}ms for ${mediaScanResult.audioFiles.length} with average time of ${mediaScanResult.averageScanDuration}ms`)
        Logger.debug(`Library Item "${scanData.path}" Audio file scan took ${mediaScanResult.elapsed}ms for ${mediaScanResult.audioFiles.length} with average time of ${mediaScanResult.averageScanDuration}ms`)
      }

      var totalAudioFilesToInclude = mediaScanResult.audioFiles.length
      var newAudioFiles = mediaScanResult.audioFiles.filter(af => {
        return !libraryItem.media.findFileWithInode(af.ino)
      })

      // Book: Adding audio files to book media
      if (libraryItem.mediaType === 'book') {
        if (newAudioFiles.length) {
          // Single Track Audiobooks
          if (totalAudioFilesToInclude === 1) {
            var af = mediaScanResult.audioFiles[0]
            af.index = 1
            libraryItem.media.addAudioFile(af)
            hasUpdated = true
          } else {
            this.runSmartTrackOrder(libraryItem, mediaScanResult.audioFiles)
            hasUpdated = true
          }
        } else {
          // Only update metadata not index
          mediaScanResult.audioFiles.forEach((af) => {
            var existingAF = libraryItem.media.findFileWithInode(af.ino)
            if (existingAF) {
              af.index = existingAF.index
              if (existingAF.updateFromScan && existingAF.updateFromScan(af)) {
                hasUpdated = true
              }
            }
          })
        }

        // Set book details from audio file ID3 tags, optional prefer
        if (libraryItem.media.setMetadataFromAudioFile(preferAudioMetadata)) {
          hasUpdated = true
        }

        if (hasUpdated) {
          libraryItem.media.rebuildTracks(preferOverdriveMediaMarker)
        }
      } else { // Podcast Media Type
        var existingAudioFiles = mediaScanResult.audioFiles.filter(af => libraryItem.media.findFileWithInode(af.ino))

        if (newAudioFiles.length) {
          var newIndex = libraryItem.media.episodes.length + 1
          newAudioFiles.forEach((newAudioFile) => {
            libraryItem.media.addNewEpisodeFromAudioFile(newAudioFile, newIndex++)
          })
          libraryItem.media.reorderEpisodes()
          hasUpdated = true
        }

        // Update audio file metadata for audio files already there
        existingAudioFiles.forEach((af) => {
          var peAudioFile = libraryItem.media.findFileWithInode(af.ino)
          if (peAudioFile.updateFromScan && peAudioFile.updateFromScan(af)) {
            hasUpdated = true
          }
        })
      }
    }

    return hasUpdated
  }
}
module.exports = new MediaFileScanner()