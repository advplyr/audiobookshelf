export default class AudioTrack {
  constructor(track, userToken) {
    this.index = track.index || 0
    this.startOffset = track.startOffset || 0 // Total time of all previous tracks
    this.duration = track.duration || 0
    this.title = track.title || ''
    this.contentUrl = track.contentUrl || null
    this.mimeType = track.mimeType
    this.metadata = track.metadata || {}

    this.userToken = userToken
  }

  get fullContentUrl() {
    if (!this.contentUrl || this.contentUrl.startsWith('http')) return this.contentUrl

    if (process.env.NODE_ENV === 'development') {
      return `${process.env.serverUrl}${this.contentUrl}?token=${this.userToken}`
    }
    return `${window.location.origin}${this.contentUrl}?token=${this.userToken}`
  }

  get relativeContentUrl() {
    if (!this.contentUrl || this.contentUrl.startsWith('http')) return this.contentUrl

    return this.contentUrl + `?token=${this.userToken}`
  }
}
