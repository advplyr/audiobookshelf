const Path = require('path')
const { encodeUriPath } = require('../../utils/index')

class AudioTrack {
  constructor() {
    this.index = null
    this.startOffset = null
    this.duration = null
    this.title = null
    this.contentUrl = null
    this.mimeType = null
    this.metadata = null
  }

  toJSON() {
    return {
      index: this.index,
      startOffset: this.startOffset,
      duration: this.duration,
      title: this.title,
      contentUrl: this.contentUrl,
      mimeType: this.mimeType,
      metadata: this.metadata ? this.metadata.toJSON() : null
    }
  }

  setData(itemId, audioFile, startOffset) {
    this.index = audioFile.index
    this.startOffset = startOffset
    this.duration = audioFile.duration
    this.title = audioFile.metadata.filename || ''
    this.contentUrl = Path.join(`${global.RouterBasePath}/s/item/${itemId}`, encodeUriPath(audioFile.metadata.relPath))
    this.mimeType = audioFile.mimeType
    this.metadata = audioFile.metadata.clone()
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