const date = require('../libs/dateAndTime')
const uuidv4 = require("uuid").v4
const serverVersion = require('../../package.json').version
const BookMetadata = require('./metadata/BookMetadata')
const PodcastMetadata = require('./metadata/PodcastMetadata')
const DeviceInfo = require('./DeviceInfo')
const VideoMetadata = require('./metadata/VideoMetadata')

/**
 * @openapi
 * components:
 *   schemas:
 *     playbackSession:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the playback session.
 *           type: string
 *           example: play_c786zm3qtjz6bd5q3n
 *         userId:
 *           description: The ID of the user the playback session is for.
 *           type: string
 *           example: root
 *         libraryId:
 *           oneOf:
 *             - $ref: '#/components/schemas/oldLibraryId'
 *             - $ref: '#/components/schemas/newLibraryId'
 *         libraryItemId:
 *           description: The ID of the library item.
 *           type: string
 *           example: li_bufnnmp4y5o2gbbxfm
 *         episodeId:
 *           description: The ID of the podcast episode. Will be null if this playback session was started without an episode ID.
 *           type: string
 *           example: ep_lh6ko39pumnrma3dhv
 *         mediaType:
 *           - $ref: '#/components/schemas/mediaType'
 *         mediaMetadata:
 *           description: The metadata of the library item's media.
 *           type: object
 *           additionalProperties:
 *             oneOf:
 *              - $ref: '#/components/schemas/bookMetadata'
 *              - $ref: '#/components/schemas/podcastMetadata'
 *         chapters:
 *           description: If the library item is a book, the chapters it contains.
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/bookChapter'
 *         displayTitle:
 *           description: The title of the playing item to show to the user.
 *           type: string
 *           example: Pilot
 *         displayAuthor:
 *           description: The author of the playing item to show to the user.
 *           type: string
 *           example: Night Vale Presents
 *         coverPath:
 *           description: The cover path of the library item's media.
 *           type: string
 *           example: /metadata/items/li_bufnnmp4y5o2gbbxfm/cover.jpg
 *         duration:
 *           description: The total duration (in seconds) of the playing item.
 *           type: number
 *           example: 1454.18449
 *         playMethod:
 *           description: What play method the playback session is using. See below for values.
 *           type: integer
 *           example: 0
 *         mediaPlayer:
 *           description: The given media player when the playback session was requested.
 *           type: string
 *           example: unknown
 *         deviceInfo:
 *           $ref: '#/components/schemas/deviceInfo'
 *         serverVersion:
 *           description: The server version the playback session was started with.
 *           type: string
 *           example: 2.4.4
 *         date:
 *           description: The day (in the format YYYY-MM-DD) the playback session was started.
 *           type: string
 *           example: '2022-11-11'
 *           format: date
 *         dayOfWeek:
 *           description: The day of the week the playback session was started.
 *           type: string
 *           example: Friday
 *         timeListening:
 *           description: The amount of time (in seconds) the user has spent listening using this playback session.
 *           type: number
 *           example: 0
 *         startTime:
 *           description: The time (in seconds) where the playback session started.
 *           type: number
 *           example: 0
 *         currentTime:
 *           description: The current time (in seconds) of the playback position.
 *           type: number
 *           example: 0
 *         startedAt:
 *           description: The time (in ms since POSIX epoch) when the playback session was started.
 *           type: integer
 *           example: 1668206493239
 *         updatedAt:
 *           description: The time (in ms since POSIX epoch) when the playback session was last updated.
 *           type: integer
 *           example: 1668206493239
 *     playbackSessionExpanded:
 *       type: [object, 'null']
 *       properties:
 *         id:
 *           description: The ID of the playback session.
 *           type: string
 *           example: play_c786zm3qtjz6bd5q3n
 *         userId:
 *           description: The ID of the user the playback session is for.
 *           type: string
 *           example: root
 *         libraryId:
 *           oneOf:
 *             - $ref: '#/components/schemas/oldLibraryId'
 *             - $ref: '#/components/schemas/newLibraryId'
 *         libraryItemId:
 *           description: The ID of the library item.
 *           type: string
 *           example: li_bufnnmp4y5o2gbbxfm
 *         episodeId:
 *           description: The ID of the podcast episode. Will be null if this playback session was started without an episode ID.
 *           type: string
 *           example: ep_lh6ko39pumnrma3dhv
 *         mediaType:
 *           - $ref: '#/components/schemas/mediaType'
 *         mediaMetadata:
 *           description: The metadata of the library item's media.
 *           type: object
 *           additionalProperties:
 *             oneOf:
 *              - $ref: '#/components/schemas/bookMetadata'
 *              - $ref: '#/components/schemas/podcastMetadata'
 *         chapters:
 *           description: If the library item is a book, the chapters it contains.
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/bookChapter'
 *         displayTitle:
 *           description: The title of the playing item to show to the user.
 *           type: string
 *           example: Pilot
 *         displayAuthor:
 *           description: The author of the playing item to show to the user.
 *           type: string
 *           example: Night Vale Presents
 *         coverPath:
 *           description: The cover path of the library item's media.
 *           type: string
 *           example: /metadata/items/li_bufnnmp4y5o2gbbxfm/cover.jpg
 *         duration:
 *           description: The total duration (in seconds) of the playing item.
 *           type: number
 *           example: 1454.18449
 *         playMethod:
 *           description: What play method the playback session is using. See below for values.
 *           type: integer
 *           example: 0
 *         mediaPlayer:
 *           description: The given media player when the playback session was requested.
 *           type: string
 *           example: unknown
 *         deviceInfo:
 *           $ref: '#/components/schemas/deviceInfo'
 *         serverVersion:
 *           description: The server version the playback session was started with.
 *           type: string
 *           example: 2.4.4
 *         date:
 *           description: The day (in the format YYYY-MM-DD) the playback session was started.
 *           type: string
 *           example: '2022-11-11'
 *           format: date
 *         dayOfWeek:
 *           description: The day of the week the playback session was started.
 *           type: string
 *           example: Friday
 *         timeListening:
 *           description: The amount of time (in seconds) the user has spent listening using this playback session.
 *           type: number
 *           example: 0
 *         startTime:
 *           description: The time (in seconds) where the playback session started.
 *           type: number
 *           example: 0
 *         currentTime:
 *           description: The current time (in seconds) of the playback position.
 *           type: number
 *           example: 0
 *         startedAt:
 *           description: The time (in ms since POSIX epoch) when the playback session was started.
 *           type: integer
 *           example: 1668206493239
 *         updatedAt:
 *           description: The time (in ms since POSIX epoch) when the playback session was last updated.
 *           type: integer
 *           example: 1668206493239
 *         audioTracks:
 *           description: The audio tracks that are being played with the playback session.
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/audioFile'
 *         videoTrack:
 *           description: The video track that is being played with the playback session. Will be null if the playback session is for a book or podcast. (Video Track Object does not exist)
 *           type: [string, 'null']
 *         libraryItem:
 *           $ref: '#/components/schemas/libraryItemExpanded'
 */
class PlaybackSession {
  constructor(session) {
    this.id = null
    this.userId = null
    this.libraryId = null
    this.libraryItemId = null
    this.bookId = null
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
    this.serverVersion = null

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
      bookId: this.bookId,
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
      serverVersion: this.serverVersion,
      date: this.date,
      dayOfWeek: this.dayOfWeek,
      timeListening: this.timeListening,
      startTime: this.startTime,
      currentTime: this.currentTime,
      startedAt: this.startedAt,
      updatedAt: this.updatedAt
    }
  }

  /**
   * Session data to send to clients
   * @param {[oldLibraryItem]} libraryItem optional
   * @returns {object}
   */
  toJSONForClient(libraryItem) {
    return {
      id: this.id,
      userId: this.userId,
      libraryId: this.libraryId,
      libraryItemId: this.libraryItemId,
      bookId: this.bookId,
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
      serverVersion: this.serverVersion,
      date: this.date,
      dayOfWeek: this.dayOfWeek,
      timeListening: this.timeListening,
      startTime: this.startTime,
      currentTime: this.currentTime,
      startedAt: this.startedAt,
      updatedAt: this.updatedAt,
      audioTracks: this.audioTracks.map(at => at.toJSON()),
      videoTrack: this.videoTrack?.toJSON() || null,
      libraryItem: libraryItem?.toJSONExpanded() || null
    }
  }

  construct(session) {
    this.id = session.id
    this.userId = session.userId
    this.libraryId = session.libraryId || null
    this.libraryItemId = session.libraryItemId
    this.bookId = session.bookId || null
    this.episodeId = session.episodeId
    this.mediaType = session.mediaType
    this.duration = session.duration
    this.playMethod = session.playMethod
    this.mediaPlayer = session.mediaPlayer || null

    // Temp do not store old IDs
    if (this.libraryId?.startsWith('lib_')) {
      this.libraryId = null
    }
    if (this.libraryItemId?.startsWith('li_') || this.libraryItemId?.startsWith('local_')) {
      this.libraryItemId = null
    }
    if (this.episodeId?.startsWith('ep_') || this.episodeId?.startsWith('local_')) {
      this.episodeId = null
    }

    if (session.deviceInfo instanceof DeviceInfo) {
      this.deviceInfo = new DeviceInfo(session.deviceInfo.toJSON())
    } else {
      this.deviceInfo = new DeviceInfo(session.deviceInfo)
    }

    this.serverVersion = session.serverVersion
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
    this.updatedAt = session.updatedAt || session.startedAt

    // Local playback sessions dont set this date field so set using updatedAt
    if (!this.date && session.updatedAt) {
      this.date = date.format(new Date(session.updatedAt), 'YYYY-MM-DD')
      this.dayOfWeek = date.format(new Date(session.updatedAt), 'dddd')
    }
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
    return this.deviceInfo?.id
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
    this.id = uuidv4()
    this.userId = user.id
    this.libraryId = libraryItem.libraryId
    this.libraryItemId = libraryItem.id
    this.bookId = episodeId ? null : libraryItem.media.id
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
    this.serverVersion = serverVersion

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