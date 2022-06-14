const { VideoMimeType } = require('../../utils/constants')
const FileMetadata = require('../metadata/FileMetadata')

class VideoFile {
  constructor(data) {
    this.index = null
    this.ino = null
    this.metadata = null
    this.addedAt = null
    this.updatedAt = null

    this.format = null
    this.duration = null
    this.bitRate = null
    this.language = null
    this.codec = null
    this.timeBase = null
    this.frameRate = null
    this.width = null
    this.height = null
    this.embeddedCoverArt = null

    this.invalid = false
    this.error = null

    if (data) {
      this.construct(data)
    }
  }

  toJSON() {
    return {
      index: this.index,
      ino: this.ino,
      metadata: this.metadata.toJSON(),
      addedAt: this.addedAt,
      updatedAt: this.updatedAt,
      invalid: !!this.invalid,
      error: this.error || null,
      format: this.format,
      duration: this.duration,
      bitRate: this.bitRate,
      language: this.language,
      codec: this.codec,
      timeBase: this.timeBase,
      frameRate: this.frameRate,
      width: this.width,
      height: this.height,
      embeddedCoverArt: this.embeddedCoverArt,
      mimeType: this.mimeType
    }
  }

  construct(data) {
    this.index = data.index
    this.ino = data.ino
    this.metadata = new FileMetadata(data.metadata || {})
    this.addedAt = data.addedAt
    this.updatedAt = data.updatedAt
    this.invalid = !!data.invalid
    this.error = data.error || null

    this.format = data.format
    this.duration = data.duration
    this.bitRate = data.bitRate
    this.language = data.language
    this.codec = data.codec || null
    this.timeBase = data.timeBase
    this.frameRate = data.frameRate
    this.width = data.width
    this.height = data.height
    this.embeddedCoverArt = data.embeddedCoverArt || null
  }

  get mimeType() {
    var format = this.metadata.format.toUpperCase()
    if (VideoMimeType[format]) {
      return VideoMimeType[format]
    } else {
      return VideoMimeType.MP4
    }
  }

  clone() {
    return new VideoFile(this.toJSON())
  }

  setDataFromProbe(libraryFile, probeData) {
    this.ino = libraryFile.ino || null

    this.metadata = libraryFile.metadata.clone()
    this.addedAt = Date.now()
    this.updatedAt = Date.now()

    const videoStream = probeData.videoStream

    this.format = probeData.format
    this.duration = probeData.duration
    this.bitRate = videoStream.bit_rate || probeData.bitRate || null
    this.language = probeData.language
    this.codec = videoStream.codec || null
    this.timeBase = videoStream.time_base
    this.frameRate = videoStream.frame_rate || null
    this.width = videoStream.width || null
    this.height = videoStream.height || null
    this.embeddedCoverArt = probeData.embeddedCoverArt
  }
}
module.exports = VideoFile