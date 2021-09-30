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
    this.codec = data.codec
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
    // this.tagAlbum = data.tagAlbum
    // this.tagArtist = data.tagArtist
    // this.tagGenre = data.tagGenre
    // this.tagTitle = data.tagTitle
    // this.tagTrack = data.tagTrack
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
    this.codec = data.codec
    this.timeBase = data.time_base
    this.channels = data.channels
    this.channelLayout = data.channel_layout
    this.chapters = data.chapters || []
    this.embeddedCoverArt = data.embedded_cover_art || null

    this.metadata = new AudioFileMetadata()
    this.metadata.setData(data)
  }

  clone() {
    return new AudioFile(this.toJSON())
  }

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