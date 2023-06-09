const Path = require('path')
const { encodeUriPath } = require('../../utils/fileUtils')

class VideoTrack {
  constructor() {
    this.index = null
    this.duration = null
    this.title = null
    this.contentUrl = null
    this.mimeType = null
    this.codec = null
    this.metadata = null
  }

  toJSON() {
    return {
      index: this.index,
      duration: this.duration,
      title: this.title,
      contentUrl: this.contentUrl,
      mimeType: this.mimeType,
      codec: this.codec,
      metadata: this.metadata ? this.metadata.toJSON() : null
    }
  }

  setData(itemId, videoFile) {
    this.index = videoFile.index
    this.duration = videoFile.duration
    this.title = videoFile.metadata.filename || ''
    // TODO: Switch to /api/items/:id/file/:fileid
    this.contentUrl = Path.join(`${global.RouterBasePath}/s/item/${itemId}`, encodeUriPath(videoFile.metadata.relPath))
    this.mimeType = videoFile.mimeType
    this.codec = videoFile.codec
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