const Path = require('path')
const Logger = require('../Logger')
const prober = require('../utils/prober')
const LibraryItem = require('../models/LibraryItem')
const AudioFile = require('../objects/files/AudioFile')

class AudioFileScanner {
  constructor() { }

  /**
   * Is array of numbers sequential, i.e. 1, 2, 3, 4
   * @param {number[]} nums 
   * @returns {boolean}
   */
  isSequential(nums) {
    if (!nums?.length) return false
    if (nums.length === 1) return true
    let prev = nums[0]
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] - prev > 1) return false
      prev = nums[i]
    }
    return true
  }

  /**
   * Remove 
   * @param {number[]} nums 
   * @returns {number[]}
   */
  removeDupes(nums) {
    if (!nums || !nums.length) return []
    if (nums.length === 1) return nums

    let nodupes = [nums[0]]
    nums.forEach((num) => {
      if (num > nodupes[nodupes.length - 1]) nodupes.push(num)
    })
    return nodupes
  }

  /**
   * Order audio files by track/disc number
   * @param {import('../models/Book')} book 
   * @param {import('../models/Book').AudioFileObject[]} audioFiles 
   * @returns {import('../models/Book').AudioFileObject[]}
   */
  runSmartTrackOrder(book, audioFiles) {
    let discsFromFilename = []
    let tracksFromFilename = []
    let discsFromMeta = []
    let tracksFromMeta = []

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

    let discKey = null
    if (discsFromMeta.length === audioFiles.length && this.isSequential(discsFromMeta)) {
      discKey = 'discNumFromMeta'
    } else if (discsFromFilename.length === audioFiles.length && this.isSequential(discsFromFilename)) {
      discKey = 'discNumFromFilename'
    }

    let trackKey = null
    tracksFromFilename = this.removeDupes(tracksFromFilename)
    tracksFromMeta = this.removeDupes(tracksFromMeta)
    if (tracksFromFilename.length > tracksFromMeta.length) {
      trackKey = 'trackNumFromFilename'
    } else {
      trackKey = 'trackNumFromMeta'
    }

    if (discKey !== null) {
      Logger.debug(`[AudioFileScanner] Smart track order for "${book.title}" using disc key ${discKey} and track key ${trackKey}`)
      audioFiles.sort((a, b) => {
        let Dx = a[discKey] - b[discKey]
        if (Dx === 0) Dx = a[trackKey] - b[trackKey]
        return Dx
      })
    } else {
      Logger.debug(`[AudioFileScanner] Smart track order for "${book.title}" using track key ${trackKey}`)
      audioFiles.sort((a, b) => a[trackKey] - b[trackKey])
    }

    for (let i = 0; i < audioFiles.length; i++) {
      audioFiles[i].index = i + 1
    }
    return audioFiles
  }

  /**
   * Get track and disc number from audio filename
   * @param {{title:string, subtitle:string, series:string, sequence:string, publishedYear:string, narrators:string}} mediaMetadataFromScan 
   * @param {LibraryItem.LibraryFileObject} audioLibraryFile 
   * @returns {{trackNumber:number, discNumber:number}}
   */
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

  /**
   * 
   * @param {string} mediaType 
   * @param {LibraryItem.LibraryFileObject} libraryFile 
   * @param {{title:string, subtitle:string, series:string, sequence:string, publishedYear:string, narrators:string}} mediaMetadataFromScan 
   * @returns {Promise<AudioFile>}
   */
  async scan(mediaType, libraryFile, mediaMetadataFromScan) {
    const probeData = await prober.probe(libraryFile.metadata.path)

    if (probeData.error) {
      Logger.error(`[MediaFileScanner] ${probeData.error} : "${libraryFile.metadata.path}"`)
      return null
    }

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

    return audioFile
  }

  /**
   * Scan LibraryFiles and return AudioFiles
   * @param {string} mediaType
   * @param {import('./LibraryItemScanData')} libraryItemScanData 
   * @param {LibraryItem.LibraryFileObject[]} audioLibraryFiles
   * @returns {Promise<AudioFile[]>}
   */
  async executeMediaFileScans(mediaType, libraryItemScanData, audioLibraryFiles) {
    const batchSize = 32
    const results = []
    for (let batch = 0; batch < audioLibraryFiles.length; batch += batchSize) {
      const proms = []
      for (let i = batch; i < Math.min(batch + batchSize, audioLibraryFiles.length); i++) {
        proms.push(this.scan(mediaType, audioLibraryFiles[i], libraryItemScanData.mediaMetadata))
      }
      results.push(...await Promise.all(proms).then((scanResults) => scanResults.filter(sr => sr)))
    }

    return results
  }
}
module.exports = new AudioFileScanner()