export default class AudioTrack {
  constructor(track) {
    this.index = track.index || 0
    this.startOffset = track.startOffset || 0 // Total time of all previous tracks
    this.duration = track.duration || 0
    this.title = track.filename || ''
    this.contentUrl = track.contentUrl || null
    this.mimeType = track.mimeType
  }

  get fullContentUrl() {
    if (!this.contentUrl || this.contentUrl.startsWith('http')) return this.contentUrl

    if (process.env.NODE_ENV === 'development') {
      return `${process.env.serverUrl}${this.contentUrl}`
    }
    return `${window.location.origin}/${this.contentUrl}`
  }
}