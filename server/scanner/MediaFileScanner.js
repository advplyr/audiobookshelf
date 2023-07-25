const Path = require('path')

const AudioFile = require('../objects/files/AudioFile')
const VideoFile = require('../objects/files/VideoFile')

const prober = require('../utils/prober')
const toneProber = require('../utils/toneProber')
const Logger = require('../Logger')
const { LogLevel } = require('../utils/constants')

class MediaFileScanner {
  constructor() { }

  getTrackAndDiscNumberFromFilename(mediaMetadataFromScan, audioLibraryFile) {
    const { title, author, series, publishedYear } = mediaMetadataFromScan
    const { filename, path } = audioLibraryFile.metadata
    let partbasename = Path.basename(filename, Path.extname(filename))

    // Remove title, author, series, and publishedYear from filename if there
    if (title) partbasename = partbasename.replace(title, '')
    if (author) partbasename = partbasename.replace(author, '')
    if (series) partbasename = partbasename.replace(series, '')
    if (publishedYear) partbasename = partbasename.replace(publishedYear)

    // Look for disc number
    let discNumber = null
    const discMatch = partbasename.match(/\b(disc|cd) ?(\d\d?)\b/i)
    if (discMatch && discMatch.length > 2 && discMatch[2]) {
      if (!isNaN(discMatch[2])) {
        discNumber = Number(discMatch[2])
      }

      // Remove disc number from filename
      partbasename = partbasename.replace(/\b(disc|cd) ?(\d\d?)\b/i, '')
    }

    // Look for disc number in folder path e.g. /Book Title/CD01/audiofile.mp3
    const pathdir = Path.dirname(path).split('/').pop()
    if (pathdir && /^cd\d{1,3}$/i.test(pathdir)) {
      const discFromFolder = Number(pathdir.replace(/cd/i, ''))
      if (!isNaN(discFromFolder) && discFromFolder !== null) discNumber = discFromFolder
    }

    const numbersinpath = partbasename.match(/\d{1,4}/g)
    const trackNumber = numbersinpath && numbersinpath.length ? parseInt(numbersinpath[0]) : null
    return {
      trackNumber,
      discNumber
    }
  }

  getAverageScanDurationMs(results) {
    if (!results.length) return 0
    let total = 0
    for (let i = 0; i < results.length; i++) total += results[i].elapsed
    return Math.floor(total / results.length)
  }

  async scan(mediaType, libraryFile, mediaMetadataFromScan, verbose = false) {
    const probeStart = Date.now()

    const probeData = await prober.probe(libraryFile.metadata.path, verbose)

    if (probeData.error) {
      Logger.error(`[MediaFileScanner] ${probeData.error} : "${libraryFile.metadata.path}"`)
      return null
    }

    if (mediaType === 'video') {
      if (!probeData.videoStream) {
        Logger.error('[MediaFileScanner] Invalid video file no video stream')
        return null
      }

      const videoFile = new VideoFile()
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

      const audioFile = new AudioFile()
      audioFile.trackNumFromMeta = probeData.audioMetaTags.trackNumber
      audioFile.discNumFromMeta = probeData.audioMetaTags.discNumber
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
  async executeMediaFileScans(libraryItem, mediaLibraryFiles) {
    const mediaType = libraryItem.mediaType

    const scanStart = Date.now()
    const mediaMetadata = libraryItem.media.metadata || null
    const batchSize = 32
    const results = []
    for (let batch = 0; batch < mediaLibraryFiles.length; batch += batchSize) {
      const proms = []
      for (let i = batch; i < Math.min(batch + batchSize, mediaLibraryFiles.length); i++) {
        proms.push(this.scan(mediaType, mediaLibraryFiles[i], mediaMetadata))
      }
      results.push(...await Promise.all(proms).then((scanResults) => scanResults.filter(sr => sr)))
    }

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
    let prev = nums[0]
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
      Logger.debug(`[MediaFileScanner] Smart track order for "${libraryItem.media.metadata.title}" using disc key ${discKey} and track key ${trackKey}`)
      audioFiles.sort((a, b) => {
        let Dx = a[discKey] - b[discKey]
        if (Dx === 0) Dx = a[trackKey] - b[trackKey]
        return Dx
      })
    } else {
      Logger.debug(`[MediaFileScanner] Smart track order for "${libraryItem.media.metadata.title}" using track key ${trackKey}`)
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

  /**
  * Scans media files for a library item and adds them as audio tracks and sets library item metadata
  * @async
  * @param {Array<LibraryFile>} mediaLibraryFiles - Media files for this library item
  * @param {LibraryItem} libraryItem
  * @param {LibraryScan} [libraryScan=null] - Optional when doing a library scan to use LibraryScan config/logs
  * @return {Promise<Boolean>} True if any updates were made
  */
  async scanMediaFiles(mediaLibraryFiles, libraryItem, libraryScan = null) {
    const preferAudioMetadata = libraryScan ? !!libraryScan.preferAudioMetadata : !!global.ServerSettings.scannerPreferAudioMetadata

    let hasUpdated = false

    const mediaScanResult = await this.executeMediaFileScans(libraryItem, mediaLibraryFiles)

    if (libraryItem.mediaType === 'video') {
      if (mediaScanResult.videoFiles.length) {
        // TODO: Check for updates etc
        hasUpdated = true
        libraryItem.media.setVideoFile(mediaScanResult.videoFiles[0])
      }
    } else if (mediaScanResult.audioFiles.length) {
      if (libraryScan) {
        libraryScan.addLog(LogLevel.DEBUG, `Library Item "${libraryItem.path}" Media file scan took ${mediaScanResult.elapsed}ms for ${mediaScanResult.audioFiles.length} with average time of ${mediaScanResult.averageScanDuration}ms per MB`)
      }
      Logger.debug(`Library Item "${libraryItem.path}" Media file scan took ${mediaScanResult.elapsed}ms with ${mediaScanResult.audioFiles.length} audio files averaging ${mediaScanResult.averageScanDuration}ms per MB`)

      const newAudioFiles = mediaScanResult.audioFiles.filter(af => {
        return !libraryItem.media.findFileWithInode(af.ino)
      })

      // Book: Adding audio files to book media
      if (libraryItem.mediaType === 'book') {
        const mediaScanFileInodes = mediaScanResult.audioFiles.map(af => af.ino)
        // Filter for existing valid track audio files not included in the audio files scanned
        const existingAudioFiles = libraryItem.media.audioFiles.filter(af => af.isValidTrack && !mediaScanFileInodes.includes(af.ino))

        if (newAudioFiles.length) {
          // Single Track Audiobooks
          if (mediaScanFileInodes.length + existingAudioFiles.length === 1) {
            const af = mediaScanResult.audioFiles[0]
            af.index = 1
            libraryItem.media.addAudioFile(af)
            hasUpdated = true
          } else {
            const allAudioFiles = existingAudioFiles.concat(mediaScanResult.audioFiles)
            this.runSmartTrackOrder(libraryItem, allAudioFiles)
            hasUpdated = true
          }
        } else {
          // Only update metadata not index
          mediaScanResult.audioFiles.forEach((af) => {
            const existingAF = libraryItem.media.findFileWithInode(af.ino)
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
          libraryItem.media.rebuildTracks()
        }
      } else if (libraryItem.mediaType === 'podcast') { // Podcast Media Type
        const existingAudioFiles = mediaScanResult.audioFiles.filter(af => libraryItem.media.findFileWithInode(af.ino))

        if (newAudioFiles.length) {
          let newIndex = Math.max(...libraryItem.media.episodes.filter(ep => ep.index == null || isNaN(ep.index)).map(ep => Number(ep.index))) + 1
          newAudioFiles.forEach((newAudioFile) => {
            libraryItem.media.addNewEpisodeFromAudioFile(newAudioFile, newIndex++)
          })
          hasUpdated = true
        }

        // Update audio file metadata for audio files already there
        existingAudioFiles.forEach((af) => {
          const podcastEpisode = libraryItem.media.findEpisodeWithInode(af.ino)
          af.index = 1
          if (podcastEpisode?.audioFile.updateFromScan(af)) {
            hasUpdated = true

            podcastEpisode.setDataFromAudioMetaTags(podcastEpisode.audioFile.metaTags, false)
          }
        })

        if (libraryItem.media.setMetadataFromAudioFile(preferAudioMetadata)) {
          hasUpdated = true
        }
      } else if (libraryItem.mediaType === 'music') { // Music
        // Only one audio file in library item
        if (newAudioFiles.length) { // New audio file
          libraryItem.media.setAudioFile(newAudioFiles[0])
          hasUpdated = true
        } else if (libraryItem.media.audioFile && libraryItem.media.audioFile.updateFromScan(mediaScanResult.audioFiles[0])) {
          hasUpdated = true
          console.log('Updated from scan')
        }

        if (libraryItem.media.setMetadataFromAudioFile()) {
          hasUpdated = true
        }

        // If the audio track has no title meta tag then use the audio file name
        if (!libraryItem.media.metadata.title && libraryItem.media.audioFile) {
          const audioFileName = libraryItem.media.audioFile.metadata.filename
          libraryItem.media.metadata.title = Path.basename(audioFileName, Path.extname(audioFileName))
          hasUpdated = true
        }
      }
    }

    return hasUpdated
  }

  probeAudioFile(audioFile) {
    Logger.debug(`[MediaFileScanner] Running ffprobe for audio file at "${audioFile.metadata.path}"`)
    return prober.rawProbe(audioFile.metadata.path)
  }
}
module.exports = new MediaFileScanner()