const date = require('date-and-time')
const { getId } = require('../utils/index')
const { PlayMethod } = require('../utils/constants')
const BookMetadata = require('./metadata/BookMetadata')
const PodcastMetadata = require('./metadata/PodcastMetadata')

class PlaybackSession {
  constructor(session) {
    this.id = null
    this.userId = null
    this.libraryItemId = null
    this.episodeId = null

    this.mediaType = null
    this.mediaMetadata = null
    this.chapters = null
    this.displayTitle = null
    this.displayAuthor = null
    this.coverPath = null
    this.duration = null

    this.playMethod = null
    this.mediaPlayer = null

    this.date = null
    this.dayOfWeek = null

    this.timeListening = null
    this.startedAt = null
    this.updatedAt = null

    // Not saved in DB
    this.lastSave = 0
    this.audioTracks = []
    this.currentTime = 0
    this.stream = null

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
      episodeId: this.episodeId,
      mediaType: this.mediaType,
      mediaMetadata: this.mediaMetadata ? this.mediaMetadata.toJSON() : null,
      chapters: (this.chapters || []).map(c => ({ ...c })),
      displayTitle: this.displayTitle,
      displayAuthor: this.displayAuthor,
      coverPath: this.coverPath,
      duration: this.duration,
      playMethod: this.playMethod,
      mediaPlayer: this.mediaPlayer,
      date: this.date,
      dayOfWeek: this.dayOfWeek,
      timeListening: this.timeListening,
      lastUpdate: this.lastUpdate,
      updatedAt: this.updatedAt
    }
  }

  toJSONForClient(libraryItem) {
    return {
      id: this.id,
      sessionType: this.sessionType,
      userId: this.userId,
      libraryItemId: this.libraryItemId,
      episodeId: this.episodeId,
      mediaType: this.mediaType,
      mediaMetadata: this.mediaMetadata ? this.mediaMetadata.toJSON() : null,
      chapters: (this.chapters || []).map(c => ({ ...c })),
      displayTitle: this.displayTitle,
      displayAuthor: this.displayAuthor,
      coverPath: this.coverPath,
      duration: this.duration,
      playMethod: this.playMethod,
      mediaPlayer: this.mediaPlayer,
      date: this.date,
      dayOfWeek: this.dayOfWeek,
      timeListening: this.timeListening,
      lastUpdate: this.lastUpdate,
      updatedAt: this.updatedAt,
      audioTracks: this.audioTracks.map(at => at.toJSON()),
      currentTime: this.currentTime,
      libraryItem: libraryItem.toJSONExpanded()
    }
  }

  construct(session) {
    this.id = session.id
    this.sessionType = session.sessionType
    this.userId = session.userId
    this.libraryItemId = session.libraryItemId
    this.episodeId = session.episodeId
    this.mediaType = session.mediaType
    this.duration = session.duration
    this.playMethod = session.playMethod
    this.mediaPlayer = session.mediaPlayer || null
    this.chapters = session.chapters || []

    this.mediaMetadata = null
    if (session.mediaMetadata) {
      if (this.mediaType === 'book') {
        this.mediaMetadata = new BookMetadata(session.mediaMetadata)
      } else if (this.mediaType === 'podcast') {
        this.mediaMetadata = new PodcastMetadata(session.mediaMetadata)
      }
    }
    this.displayTitle = session.displayTitle || ''
    this.displayAuthor = session.displayAuthor || ''
    this.coverPath = session.coverPath
    this.date = session.date
    this.dayOfWeek = session.dayOfWeek

    this.timeListening = session.timeListening || null
    this.startedAt = session.startedAt
    this.updatedAt = session.updatedAt || null
  }

  get progress() { // Value between 0 and 1
    if (!this.duration) return 0
    return Math.max(0, Math.min(this.currentTime / this.duration, 1))
  }

  setData(libraryItem, user, mediaPlayer, episodeId = null) {
    this.id = getId('play')
    this.userId = user.id
    this.libraryItemId = libraryItem.id
    this.episodeId = episodeId
    this.mediaType = libraryItem.mediaType
    this.mediaMetadata = libraryItem.media.metadata.clone()
    this.chapters = (libraryItem.media.chapters || []).map(c => ({ ...c })) // Only book mediaType has chapters
    this.displayTitle = libraryItem.media.getPlaybackTitle(episodeId)
    this.displayAuthor = libraryItem.media.getPlaybackAuthor(episodeId)
    this.coverPath = libraryItem.media.coverPath
    this.duration = libraryItem.media.duration

    this.mediaPlayer = mediaPlayer

    this.timeListening = 0
    this.date = date.format(new Date(), 'YYYY-MM-DD')
    this.dayOfWeek = date.format(new Date(), 'dddd')
    this.startedAt = Date.now()
    this.updatedAt = Date.now()
  }

  addListeningTime(timeListened) {
    if (!timeListened || isNaN(timeListened)) return

    if (!this.date) {
      // Set date info on first listening update
      this.date = date.format(new Date(), 'YYYY-MM-DD')
      this.dayOfWeek = date.format(new Date(), 'dddd')
    }

    this.timeListening += timeListened
    this.updatedAt = Date.now()
  }

  // New date since start of listening session
  checkDateRollover() {
    if (!this.date) return false
    return date.format(new Date(), 'YYYY-MM-DD') !== this.date
  }
}
module.exports = PlaybackSession