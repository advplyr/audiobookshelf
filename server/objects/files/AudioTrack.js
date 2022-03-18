const Path = require('path')

class AudioTrack {
  constructor() {
    this.index = null
    this.startOffset = null
    this.duration = null
    this.title = null
    this.contentUrl = null
    this.mimeType = null
  }

  toJSON() {
    return {
      index: this.index,
      startOffset: this.startOffset,
      duration: this.duration,
      title: this.title,
      contentUrl: this.contentUrl,
      mimeType: this.mimeType
    }
  }

  setData(itemId, audioFile, startOffset) {
    this.index = audioFile.index
    this.startOffset = startOffset
    this.duration = audioFile.duration
    this.title = audioFile.metadata.filename || ''
    this.contentUrl = Path.join(`/s/item/${itemId}`, audioFile.metadata.relPath)
    this.mimeType = audioFile.mimeType
  }

  setFromStream(title, duration, contentUrl) {
    this.index = 1
    this.startOffset = 0
    this.duration = duration
    this.title = title
    this.contentUrl = contentUrl
    this.mimeType = 'application/vnd.apple.mpegurl'
  }
}
module.exports = AudioTrack