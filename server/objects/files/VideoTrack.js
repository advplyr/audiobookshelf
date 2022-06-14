const Path = require('path')
const { encodeUriPath } = require('../../utils/index')

class VideoTrack {
  constructor() {
    this.index = null
    this.duration = null
    this.title = null
    this.contentUrl = null
    this.mimeType = null
    this.metadata = null
  }

  toJSON() {
    return {
      index: this.index,
      duration: this.duration,
      title: this.title,
      contentUrl: this.contentUrl,
      mimeType: this.mimeType,
      metadata: this.metadata ? this.metadata.toJSON() : null
    }
  }

  setData(itemId, videoFile) {
    this.index = videoFile.index
    this.duration = videoFile.duration
    this.title = videoFile.metadata.filename || ''
    this.contentUrl = Path.join(`/s/item/${itemId}`, encodeUriPath(videoFile.metadata.relPath))
    this.mimeType = videoFile.mimeType
    this.metadata = videoFile.metadata.clone()
  }

  setFromStream(title, duration, contentUrl) {
    this.index = 1
    this.duration = duration
    this.title = title
    this.contentUrl = contentUrl
    this.mimeType = 'application/vnd.apple.mpegurl'
  }
}
module.exports = VideoTrack