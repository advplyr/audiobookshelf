const date = require('date-and-time')
const { getId } = require('../../utils/index')
const { PlayMethod } = require('../../utils/constants')
const BookMetadata = require('../metadata/BookMetadata')
const PodcastMetadata = require('../metadata/PodcastMetadata')

class PlaybackSession {
  constructor(session) {
    this.id = null
    this.userId = null
    this.libraryItemId = null
    this.mediaType = null
    this.mediaMetadata = null

    this.playMethod = null

    this.date = null
    this.dayOfWeek = null

    this.timeListening = null
    this.startedAt = null
    this.updatedAt = null

    if (session) {
      this.construct(session)
    }
  }

  toJSON() {
    return {
      id: this.id,
      sessionType: this.sessionType,
      userId: this.userId,
      libraryItemId: this.libraryItemId,
      mediaType: this.mediaType,
      mediaMetadata: this.mediaMetadata ? this.mediaMetadata.toJSON() : null,
      playMethod: this.playMethod,
      date: this.date,
      dayOfWeek: this.dayOfWeek,
      timeListening: this.timeListening,
      lastUpdate: this.lastUpdate,
      updatedAt: this.updatedAt
    }
  }

  construct(session) {
    this.id = session.id
    this.sessionType = session.sessionType
    this.userId = session.userId
    this.libraryItemId = session.libraryItemId
    this.mediaType = session.mediaType
    this.playMethod = session.playMethod

    this.mediaMetadata = null
    if (session.mediaMetadata) {
      if (this.mediaType === 'book') {
        this.mediaMetadata = new BookMetadata(session.mediaMetadata)
      } else if (this.mediaType === 'podcast') {
        this.mediaMetadata = new PodcastMetadata(session.mediaMetadata)
      }
    }

    this.date = session.date
    this.dayOfWeek = session.dayOfWeek

    this.timeListening = session.timeListening || null
    this.startedAt = session.startedAt
    this.updatedAt = session.updatedAt || null
  }

  setData(libraryItem, user) {
    this.id = getId('ls')
    this.userId = user.id
    this.libraryItemId = libraryItem.id
    this.mediaType = libraryItem.mediaType
    this.mediaMetadata = libraryItem.media.metadata.clone()
    this.playMethod = PlayMethod.TRANSCODE

    this.timeListening = 0
    this.startedAt = Date.now()
    this.updatedAt = Date.now()
  }

  addListeningTime(timeListened) {
    if (timeListened && !isNaN(timeListened)) {
      if (!this.date) {
        // Set date info on first listening update
        this.date = date.format(new Date(), 'YYYY-MM-DD')
        this.dayOfWeek = date.format(new Date(), 'dddd')
      }

      this.timeListening += timeListened
      this.updatedAt = Date.now()
    }
  }

  // New date since start of listening session
  checkDateRollover() {
    if (!this.date) return false
    return date.format(new Date(), 'YYYY-MM-DD') !== this.date
  }
}
module.exports = PlaybackSession