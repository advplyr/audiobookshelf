const Logger = require('../Logger')
const date = require('date-and-time')
const { getId } = require('../utils/index')

class UserListeningSession {
  constructor(session) {
    this.id = null
    this.sessionType = 'listeningSession'
    this.userId = null
    this.audiobookId = null
    this.audiobookTitle = null
    this.audiobookAuthor = null
    this.audiobookDuration = 0
    this.audiobookGenres = []

    this.date = null
    this.dayOfWeek = null

    this.timeListening = null
    this.lastUpdate = null
    this.startedAt = null

    if (session) {
      this.construct(session)
    }
  }

  toJSON() {
    return {
      id: this.id,
      sessionType: this.sessionType,
      userId: this.userId,
      audiobookId: this.audiobookId,
      audiobookTitle: this.audiobookTitle,
      audiobookAuthor: this.audiobookAuthor,
      audiobookDuration: this.audiobookDuration,
      audiobookGenres: [...this.audiobookGenres],
      date: this.date,
      dayOfWeek: this.dayOfWeek,
      timeListening: this.timeListening,
      lastUpdate: this.lastUpdate,
      startedAt: this.startedAt
    }
  }

  construct(session) {
    this.id = session.id
    this.sessionType = session.sessionType
    this.userId = session.userId
    this.audiobookId = session.audiobookId
    this.audiobookTitle = session.audiobookTitle
    this.audiobookAuthor = session.audiobookAuthor
    this.audiobookDuration = session.audiobookDuration || 0
    this.audiobookGenres = session.audiobookGenres

    this.date = session.date
    this.dayOfWeek = session.dayOfWeek

    this.timeListening = session.timeListening || null
    this.lastUpdate = session.lastUpdate || null
    this.startedAt = session.startedAt
  }

  setData(libraryItem, user) {
    this.id = getId('ls')
    this.userId = user.id
    this.audiobookId = libraryItem.id
    // TODO: For podcasts this needs to be generic
    this.audiobookTitle = libraryItem.media.metadata.title || ''
    this.audiobookAuthor = libraryItem.media.metadata.authorName || ''
    this.audiobookDuration = libraryItem.media.duration || 0
    this.audiobookGenres = [...libraryItem.media.metadata.genres]

    this.timeListening = 0
    this.lastUpdate = Date.now()
    this.startedAt = Date.now()
  }

  addListeningTime(timeListened) {
    if (timeListened && !isNaN(timeListened)) {
      if (!this.date) {
        // Set date info on first listening update
        this.date = date.format(new Date(), 'YYYY-MM-DD')
        this.dayOfWeek = date.format(new Date(), 'dddd')
      }

      this.timeListening += timeListened
      this.lastUpdate = Date.now()
    }
  }

  // New date since start of listening session
  checkDateRollover() {
    if (!this.date) return false
    return date.format(new Date(), 'YYYY-MM-DD') !== this.date
  }
}
module.exports = UserListeningSession