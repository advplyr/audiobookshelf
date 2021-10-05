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

    this.trackNumFromMeta = data.trackNumFromMeta || null
    this.trackNumFromFilename = data.trackNumFromFilename || null

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

    this.trackNumFromMeta = data.trackNumFromMeta || null
    this.trackNumFromFilename = data.trackNumFromFilename || null

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
      embeddedCoverArt: data.embedded_cover_art || null
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
}
module.exports = AudioFile