export default class AudioTrack {
  constructor(track, userToken, routerBasePath) {
    this.index = track.index || 0
    this.startOffset = track.startOffset || 0 // Total time of all previous tracks
    this.duration = track.duration || 0
    this.title = track.title || ''
    this.contentUrl = track.contentUrl || null
    this.mimeType = track.mimeType
    this.metadata = track.metadata || {}

    this.userToken = userToken
    this.routerBasePath = routerBasePath || ''
  }

  /**
   * Used for CastPlayer
   */
  get fullContentUrl() {
    if (!this.contentUrl || this.contentUrl.startsWith('http')) return this.contentUrl

    if (process.env.NODE_ENV === 'development') {
      return `${process.env.serverUrl}${this.contentUrl}?token=${this.userToken}`
    }
    return `${window.location.origin}${this.routerBasePath}${this.contentUrl}?token=${this.userToken}`
  }

  /**
   * Used for LocalPlayer
   */
  get relativeContentUrl() {
    if (!this.contentUrl || this.contentUrl.startsWith('http')) return this.contentUrl

    return `${this.routerBasePath}${this.contentUrl}?token=${this.userToken}`
  }
}
