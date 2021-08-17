class User {
  constructor(user) {
    this.id = null
    this.username = null
    this.pash = null
    this.type = null
    this.stream = null
    this.token = null
    this.createdAt = null
    this.audiobooks = null

    if (user) {
      this.construct(user)
    }
  }

  toJSON() {
    return {
      id: this.id,
      username: this.username,
      pash: this.pash,
      type: this.type,
      stream: this.stream,
      token: this.token,
      audiobooks: this.audiobooks,
      createdAt: this.createdAt
    }
  }

  toJSONForBrowser() {
    return {
      id: this.id,
      username: this.username,
      type: this.type,
      stream: this.stream,
      token: this.token,
      audiobooks: this.audiobooks,
      createdAt: this.createdAt
    }
  }

  construct(user) {
    this.id = user.id
    this.username = user.username
    this.pash = user.pash
    this.type = user.type
    this.stream = user.stream
    this.token = user.token
    this.audiobooks = user.audiobooks || null
    this.createdAt = user.createdAt
  }

  updateAudiobookProgress(stream) {
    if (!this.audiobooks) this.audiobooks = {}
    if (!this.audiobooks[stream.audiobookId]) {
      this.audiobooks[stream.audiobookId] = {
        audiobookId: stream.audiobookId,
        totalDuration: stream.totalDuration,
        startedAt: Date.now()
      }
    }
    this.audiobooks[stream.audiobookId].lastUpdate = Date.now()
    this.audiobooks[stream.audiobookId].progress = stream.clientProgress
    this.audiobooks[stream.audiobookId].currentTime = stream.clientCurrentTime
  }

  resetAudiobookProgress(audiobookId) {
    if (!this.audiobooks || !this.audiobooks[audiobookId]) {
      return false
    }
    delete this.audiobooks[audiobookId]
    return true
  }
}
module.exports = User