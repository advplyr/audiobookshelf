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

    this.tagAlbum = null
    this.tagArtist = null
    this.tagGenre = null
    this.tagTitle = null
    this.tagTrack = null

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
      tagAlbum: this.tagAlbum,
      tagArtist: this.tagArtist,
      tagGenre: this.tagGenre,
      tagTitle: this.tagTitle,
      tagTrack: this.tagTrack
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

    this.tagAlbum = data.tagAlbum
    this.tagArtist = data.tagArtist
    this.tagGenre = data.tagGenre
    this.tagTitle = data.tagTitle
    this.tagTrack = data.tagTrack
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
    this.bitRate = data.bit_rate
    this.language = data.language
    this.codec = data.codec
    this.timeBase = data.time_base
    this.channels = data.channels
    this.channelLayout = data.channel_layout

    this.tagAlbum = data.file_tag_album || null
    this.tagArtist = data.file_tag_artist || null
    this.tagGenre = data.file_tag_genre || null
    this.tagTitle = data.file_tag_title || null
    this.tagTrack = data.file_tag_track || null
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