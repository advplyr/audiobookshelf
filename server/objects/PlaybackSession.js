const date = require('../libs/dateAndTime')
const { getId } = require('../utils/index')
const BookMetadata = require('./metadata/BookMetadata')
const PodcastMetadata = require('./metadata/PodcastMetadata')
const DeviceInfo = require('./DeviceInfo')
const VideoMetadata = require('./metadata/VideoMetadata')

class PlaybackSession {
  constructor(session) {
    this.id = null
    this.userId = null
    this.libraryId = null
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
    this.deviceInfo = null

    this.date = null
    this.dayOfWeek = null

    this.timeListening = null
    this.startTime = null // media current time at start of playback
    this.currentTime = 0 // Last current time set

    this.startedAt = null
    this.updatedAt = null

    // Not saved in DB
    this.lastSave = 0
    this.audioTracks = []
    this.videoTrack = null
    this.stream = null

    if (session) {
      this.construct(session)
    }
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      libraryId: this.libraryId,
      libraryItemId: this.libraryItemId,
      episodeId: this.episodeId,
      mediaType: this.mediaType,
      mediaMetadata: this.mediaMetadata?.toJSON() || null,
      chapters: (this.chapters || []).map(c => ({ ...c })),
      displayTitle: this.displayTitle,
      displayAuthor: this.displayAuthor,
      coverPath: this.coverPath,
      duration: this.duration,
      playMethod: this.playMethod,
      mediaPlayer: this.mediaPlayer,
      deviceInfo: this.deviceInfo?.toJSON() || null,
      date: this.date,
      dayOfWeek: this.dayOfWeek,
      timeListening: this.timeListening,
      startTime: this.startTime,
      currentTime: this.currentTime,
      startedAt: this.startedAt,
      updatedAt: this.updatedAt
    }
  }

  toJSONForClient(libraryItem) {
    return {
      id: this.id,
      userId: this.userId,
      libraryId: this.libraryId,
      libraryItemId: this.libraryItemId,
      episodeId: this.episodeId,
      mediaType: this.mediaType,
      mediaMetadata: this.mediaMetadata?.toJSON() || null,
      chapters: (this.chapters || []).map(c => ({ ...c })),
      displayTitle: this.displayTitle,
      displayAuthor: this.displayAuthor,
      coverPath: this.coverPath,
      duration: this.duration,
      playMethod: this.playMethod,
      mediaPlayer: this.mediaPlayer,
      deviceInfo: this.deviceInfo?.toJSON() || null,
      date: this.date,
      dayOfWeek: this.dayOfWeek,
      timeListening: this.timeListening,
      startTime: this.startTime,
      currentTime: this.currentTime,
      startedAt: this.startedAt,
      updatedAt: this.updatedAt,
      audioTracks: this.audioTracks.map(at => at.toJSON()),
      videoTrack: this.videoTrack ? this.videoTrack.toJSON() : null,
      libraryItem: libraryItem.toJSONExpanded()
    }
  }

  construct(session) {
    this.id = session.id
    this.userId = session.userId
    this.libraryId = session.libraryId || null
    this.libraryItemId = session.libraryItemId
    this.episodeId = session.episodeId
    this.mediaType = session.mediaType
    this.duration = session.duration
    this.playMethod = session.playMethod
    this.mediaPlayer = session.mediaPlayer || null
    this.deviceInfo = new DeviceInfo(session.deviceInfo)
    this.chapters = session.chapters || []

    this.mediaMetadata = null
    if (session.mediaMetadata) {
      if (this.mediaType === 'book') {
        this.mediaMetadata = new BookMetadata(session.mediaMetadata)
      } else if (this.mediaType === 'podcast') {
        this.mediaMetadata = new PodcastMetadata(session.mediaMetadata)
      } else if (this.mediaType === 'video') {
        this.mediaMetadata = new VideoMetadata(session.mediaMetadata)
      }
    }
    this.displayTitle = session.displayTitle || ''
    this.displayAuthor = session.displayAuthor || ''
    this.coverPath = session.coverPath
    this.date = session.date
    this.dayOfWeek = session.dayOfWeek

    this.timeListening = session.timeListening || null
    this.startTime = session.startTime || 0
    this.currentTime = session.currentTime || 0

    this.startedAt = session.startedAt
    this.updatedAt = session.updatedAt || null
  }

  get mediaItemId() {
    if (this.episodeId) return `${this.libraryItemId}-${this.episodeId}`
    return this.libraryItemId
  }

  get progress() { // Value between 0 and 1
    if (!this.duration) return 0
    return Math.max(0, Math.min(this.currentTime / this.duration, 1))
  }

  get deviceId() {
    return this.deviceInfo?.deviceId
  }

  get deviceDescription() {
    if (!this.deviceInfo) return 'No Device Info'
    return this.deviceInfo.deviceDescription
  }

  get mediaProgressObject() {
    return {
      duration: this.duration,
      currentTime: this.currentTime,
      progress: this.progress,
      lastUpdate: this.updatedAt
    }
  }

  setData(libraryItem, user, mediaPlayer, deviceInfo, startTime, episodeId = null) {
    this.id = getId('play')
    this.userId = user.id
    this.libraryId = libraryItem.libraryId
    this.libraryItemId = libraryItem.id
    this.episodeId = episodeId
    this.mediaType = libraryItem.mediaType
    this.mediaMetadata = libraryItem.media.metadata.clone()
    this.chapters = libraryItem.media.getChapters(episodeId)
    this.displayTitle = libraryItem.media.getPlaybackTitle(episodeId)
    this.displayAuthor = libraryItem.media.getPlaybackAuthor()
    this.coverPath = libraryItem.media.coverPath

    if (episodeId) {
      this.duration = libraryItem.media.getEpisodeDuration(episodeId)
    } else {
      this.duration = libraryItem.media.duration
    }

    this.mediaPlayer = mediaPlayer
    this.deviceInfo = deviceInfo || new DeviceInfo()

    this.timeListening = 0
    this.startTime = startTime
    this.currentTime = startTime

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

    this.timeListening += Number.parseFloat(timeListened)
    this.updatedAt = Date.now()
  }

  // New date since start of listening session
  checkDateRollover() {
    if (!this.date) return false
    return date.format(new Date(), 'YYYY-MM-DD') !== this.date
  }
}
module.exports = PlaybackSession