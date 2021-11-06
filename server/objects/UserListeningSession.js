const Logger = require('../Logger')

class UserListeningSession {
  constructor(session) {
    this.userId = null
    this.audiobookId = null
    this.audiobookTitle = null
    this.audiobookAuthor = null

    this.timeListening = null
    this.lastUpdate = null
    this.startedAt = null
    this.finishedAt = null

    if (session) {
      this.construct(session)
    }
  }

  toJSON() {
    return {
      userId: this.userId,
      audiobookId: this.audiobookId,
      audiobookTitle: this.audiobookTitle,
      audiobookAuthor: this.audiobookAuthor,
      timeListening: this.timeListening,
      lastUpdate: this.lastUpdate,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt
    }
  }

  construct(session) {
    this.userId = session.userId
    this.audiobookId = session.audiobookId
    this.audiobookTitle = session.audiobookTitle
    this.audiobookAuthor = session.audiobookAuthor

    this.timeListening = session.timeListening || null
    this.lastUpdate = session.lastUpdate || null
    this.startedAt = session.startedAt
    this.finishedAt = session.finishedAt || null
  }

  setData(audiobook, user) {
    this.userId = user.id
    this.audiobookId = audiobook.id
    this.audiobookTitle = audiobook.title || ''
    this.audiobookAuthor = audiobook.author || ''

    this.timeListening = 0
    this.lastUpdate = Date.now()
    this.startedAt = Date.now()
    this.finishedAt = null
  }
}
module.exports = UserListeningSession