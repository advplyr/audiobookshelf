const { isNullOrNaN } = require('../utils/index')

const Logger = require('../Logger')
const AudioFileMetadata = require('./AudioFileMetadata')

class AudioFile {
  constructor(data) {
    this.index = null
    this.ino = null
    this.filename = null
    this.ext = null
    this.path = null
    this.fullPath = null
    this.addedAt = null

    this.trackNumFromMeta = null
    this.trackNumFromFilename = null
    this.cdNumFromFilename = null

    this.format = null
    this.duration = null
    this.size = null
    this.bitRate = null
    this.language = null
    this.codec = null
    this.timeBase = null
    this.channels = null
    this.channelLayout = null
    this.chapters = []
    this.embeddedCoverArt = null

    // Tags scraped from the audio file
    this.metadata = null

    this.manuallyVerified = false
    this.invalid = false
    this.exclude = false
    this.error = null

    if (data) {
      this.construct(data)
    }
  }

  // Sort number takes cd num into account
  // get sortNumber() {
  //   if (this.manuallyVerified) return this.index
  //   var num = this.index
  //   if (this.cdNumFromFilename && !isNaN(this.cdNumFromFilename)) {
  //     num += (Number(this.cdNumFromFilename) * 1000)
  //   }
  //   return num
  // }

  toJSON() {
    return {
      index: this.index,
      ino: this.ino,
      filename: this.filename,
      ext: this.ext,
      path: this.path,
      fullPath: this.fullPath,
      addedAt: this.addedAt,
      trackNumFromMeta: this.trackNumFromMeta,
      trackNumFromFilename: this.trackNumFromFilename,
      cdNumFromFilename: this.cdNumFromFilename,
      manuallyVerified: !!this.manuallyVerified,
      invalid: !!this.invalid,
      exclude: !!this.exclude,
      error: this.error || null,
      format: this.format,
      duration: this.duration,
      size: this.size,
      bitRate: this.bitRate,
      language: this.language,
      codec: this.codec,
      timeBase: this.timeBase,
      channels: this.channels,
      channelLayout: this.channelLayout,
      chapters: this.chapters,
      embeddedCoverArt: this.embeddedCoverArt,
      metadata: this.metadata ? this.metadata.toJSON() : {}
    }
  }

  construct(data) {
    this.index = data.index
    this.ino = data.ino
    this.filename = data.filename
    this.ext = data.ext
    this.path = data.path
    this.fullPath = data.fullPath
    this.addedAt = data.addedAt
    this.manuallyVerified = !!data.manuallyVerified
    this.invalid = !!data.invalid
    this.exclude = !!data.exclude
    this.error = data.error || null

    this.trackNumFromMeta = data.trackNumFromMeta
    this.trackNumFromFilename = data.trackNumFromFilename
    this.cdNumFromFilename = data.cdNumFromFilename

    this.format = data.format
    this.duration = data.duration
    this.size = data.size
    this.bitRate = data.bitRate
    this.language = data.language
    this.codec = data.codec || null
    this.timeBase = data.timeBase
    this.channels = data.channels
    this.channelLayout = data.channelLayout
    this.chapters = data.chapters
    this.embeddedCoverArt = data.embeddedCoverArt || null

    // Old version of AudioFile used `tagAlbum` etc.
    var isOldVersion = Object.keys(data).find(key => key.startsWith('tag'))
    if (isOldVersion) {
      this.metadata = new AudioFileMetadata(data)
    } else {
      this.metadata = new AudioFileMetadata(data.metadata || {})
    }
  }

  setData(data) {
    this.index = data.index || null
    this.ino = data.ino || null
    this.filename = data.filename
    this.ext = data.ext
    this.path = data.path
    this.fullPath = data.fullPath
    this.addedAt = Date.now()

    this.trackNumFromMeta = data.trackNumFromMeta
    this.trackNumFromFilename = data.trackNumFromFilename
    this.cdNumFromFilename = data.cdNumFromFilename

    this.manuallyVerified = !!data.manuallyVerified
    this.invalid = !!data.invalid
    this.exclude = !!data.exclude
    this.error = data.error || null

    this.format = data.format
    this.duration = data.duration
    this.size = data.size
    this.bitRate = data.bit_rate || null
    this.language = data.language
    this.codec = data.codec || null
    this.timeBase = data.time_base
    this.channels = data.channels
    this.channelLayout = data.channel_layout
    this.chapters = data.chapters || []
    this.embeddedCoverArt = data.embedded_cover_art || null

    this.metadata = new AudioFileMetadata()
    this.metadata.setData(data)
  }

  // New scanner creates AudioFile from AudioFileScanner
  setDataFromProbe(fileData, probeData) {
    this.index = fileData.index || null
    this.ino = fileData.ino || null
    this.filename = fileData.filename
    this.ext = fileData.ext
    this.path = fileData.path
    this.fullPath = fileData.fullPath
    this.addedAt = Date.now()

    this.trackNumFromMeta = fileData.trackNumFromMeta
    this.trackNumFromFilename = fileData.trackNumFromFilename
    this.cdNumFromFilename = fileData.cdNumFromFilename

    this.format = probeData.format
    this.duration = probeData.duration
    this.size = probeData.size
    this.bitRate = probeData.bitRate || null
    this.language = probeData.language
    this.codec = probeData.codec || null
    this.timeBase = probeData.timeBase
    this.channels = probeData.channels
    this.channelLayout = probeData.channelLayout
    this.chapters = probeData.chapters || []
    this.metadata = probeData.audioFileMetadata
    this.embeddedCoverArt = probeData.embeddedCoverArt
  }

  validateTrackIndex() {
    var numFromMeta = isNullOrNaN(this.trackNumFromMeta) ? null : Number(this.trackNumFromMeta)
    var numFromFilename = isNullOrNaN(this.trackNumFromFilename) ? null : Number(this.trackNumFromFilename)

    if (numFromMeta !== null) return numFromMeta
    if (numFromFilename !== null) return numFromFilename

    this.invalid = true
    this.error = 'Failed to get track number'
    return null
  }

  setDuplicateTrackNumber(num) {
    this.invalid = true
    this.error = 'Duplicate track number "' + num + '"'
  }

  syncChapters(updatedChapters) {
    if (this.chapters.length !== updatedChapters.length) {
      this.chapters = updatedChapters.map(ch => ({ ...ch }))
      return true
    } else if (updatedChapters.length === 0) {
      if (this.chapters.length > 0) {
        this.chapters = []
        return true
      }
      return false
    }

    var hasUpdates = false
    for (let i = 0; i < updatedChapters.length; i++) {
      if (JSON.stringify(updatedChapters[i]) !== JSON.stringify(this.chapters[i])) {
        hasUpdates = true
      }
    }
    if (hasUpdates) {
      this.chapters = updatedChapters.map(ch => ({ ...ch }))
    }
    return hasUpdates
  }

  // Called from audioFileScanner.js with scanData
  updateMetadata(data) {
    if (!this.metadata) this.metadata = new AudioFileMetadata()

    var dataMap = {
      format: data.format,
      duration: data.duration,
      size: data.size,
      bitRate: data.bit_rate || null,
      language: data.language,
      codec: data.codec || null,
      timeBase: data.time_base,
      channels: data.channels,
      channelLayout: data.channel_layout,
      chapters: data.chapters || [],
      embeddedCoverArt: data.embedded_cover_art || null,
      trackNumFromMeta: data.trackNumFromMeta,
      trackNumFromFilename: data.trackNumFromFilename,
      cdNumFromFilename: data.cdNumFromFilename
    }

    var hasUpdates = false
    for (const key in dataMap) {
      if (key === 'chapters') {
        var chaptersUpdated = this.syncChapters(dataMap.chapters)
        if (chaptersUpdated) {
          hasUpdates = true
        }
      } else if (dataMap[key] !== this[key]) {
        // Logger.debug(`[AudioFile] "${key}" from ${this[key]} => ${dataMap[key]}`)
        this[key] = dataMap[key]
        hasUpdates = true
      }
    }

    if (this.metadata.updateData(data)) {
      hasUpdates = true
    }

    return hasUpdates
  }

  clone() {
    return new AudioFile(this.toJSON())
  }

  // If the file or parent directory was renamed it is synced here
  syncFile(newFile) {
    var hasUpdates = false
    var keysToSync = ['path', 'fullPath', 'ext', 'filename']
    keysToSync.forEach((key) => {
      if (newFile[key] !== undefined && newFile[key] !== this[key]) {
        hasUpdates = true
        this[key] = newFile[key]
      }
    })
    return hasUpdates
  }

  updateFromScan(scannedAudioFile) {
    var hasUpdated = false

    var newjson = scannedAudioFile.toJSON()
    if (this.manuallyVerified) newjson.manuallyVerified = true
    if (this.exclude) newjson.exclude = true
    newjson.addedAt = this.addedAt

    for (const key in newjson) {
      if (key === 'metadata') {
        if (!this.metadata || !this.metadata.isEqual(scannedAudioFile.metadata)) {
          this.metadata = scannedAudioFile.metadata
          hasUpdated = true
        }
      } else if (key === 'chapters') {
        if (this.syncChapters(newjson.chapters || [])) {
          hasUpdated = true
        }
      } else if (this[key] !== newjson[key]) {
        // console.log(this.filename, 'key', key, 'updated', this[key], newjson[key])
        this[key] = newjson[key]
        hasUpdated = true
      }
    }
    return hasUpdated
  }
}
module.exports = AudioFile