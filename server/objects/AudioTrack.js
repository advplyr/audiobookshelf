var { bytesPretty } = require('../utils/fileUtils')

class AudioTrack {
  constructor(audioTrack = null) {
    this.index = null
    this.ino = null

    this.path = null
    this.fullPath = null
    this.ext = null
    this.filename = null

    this.format = null
    this.duration = null
    this.size = null
    this.bitRate = null
    this.language = null
    this.codec = null
    this.timeBase = null
    this.channels = null
    this.channelLayout = null

    if (audioTrack) {
      this.construct(audioTrack)
    }
  }

  construct(audioTrack) {
    this.index = audioTrack.index
    this.ino = audioTrack.ino || null

    this.path = audioTrack.path
    this.fullPath = audioTrack.fullPath
    this.ext = audioTrack.ext
    this.filename = audioTrack.filename

    this.format = audioTrack.format
    this.duration = audioTrack.duration
    this.size = audioTrack.size
    this.bitRate = audioTrack.bitRate
    this.language = audioTrack.language
    this.codec = audioTrack.codec
    this.timeBase = audioTrack.timeBase
    this.channels = audioTrack.channels
    this.channelLayout = audioTrack.channelLayout
  }

  get name() {
    return `${String(this.index).padStart(3, '0')}: ${this.filename} (${bytesPretty(this.size)}) [${this.duration}]`
  }

  toJSON() {
    return {
      index: this.index,
      ino: this.ino,
      path: this.path,
      fullPath: this.fullPath,
      ext: this.ext,
      filename: this.filename,
      format: this.format,
      duration: this.duration,
      size: this.size,
      bitRate: this.bitRate,
      language: this.language,
      timeBase: this.timeBase,
      channels: this.channels,
      channelLayout: this.channelLayout,
    }
  }

  setData(probeData) {
    this.index = probeData.index
    this.ino = probeData.ino || null

    this.path = probeData.path
    this.fullPath = probeData.fullPath
    this.ext = probeData.ext
    this.filename = probeData.filename

    this.format = probeData.format
    this.duration = probeData.duration
    this.size = probeData.size
    this.bitRate = probeData.bitRate
    this.language = probeData.language
    this.codec = probeData.codec
    this.timeBase = probeData.timeBase
    this.channels = probeData.channels
    this.channelLayout = probeData.channelLayout
  }

  syncMetadata(audioFile) {
    var hasUpdates = false
    var keysToSync = ['format', 'duration', 'size', 'bitRate', 'language', 'codec', 'timeBase', 'channels', 'channelLayout']
    keysToSync.forEach((key) => {
      if (audioFile[key] !== undefined && audioFile[key] !== this[key]) {
        hasUpdates = true
        this[key] = audioFile[key]
      }
    })
    return hasUpdates
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
module.exports = AudioTrack