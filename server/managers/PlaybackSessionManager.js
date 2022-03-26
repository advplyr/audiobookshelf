const Path = require('path')
const { PlayMethod } = require('../utils/constants')
const PlaybackSession = require('../objects/PlaybackSession')
const Stream = require('../objects/Stream')
const Logger = require('../Logger')

class PlaybackSessionManager {
  constructor(db, emitter, clientEmitter) {
    this.db = db
    this.StreamsPath = Path.join(global.MetadataPath, 'streams')
    this.emitter = emitter
    this.clientEmitter = clientEmitter

    this.sessions = []
  }

  getSession(sessionId) {
    return this.sessions.find(s => s.id === sessionId)
  }
  getUserSession(userId) {
    return this.sessions.find(s => s.userId === userId)
  }
  getStream(sessionId) {
    var session = this.getSession(sessionId)
    return session ? session.stream : null
  }

  async startSessionRequest(user, libraryItem, options, res) {
    const session = await this.startSession(user, libraryItem, options)
    res.json(session.toJSONForClient(libraryItem))
  }

  async syncSessionRequest(user, session, payload, res) {
    var result = await this.syncSession(user, session, payload)
    if (result) {
      res.json(session.toJSONForClient(result.libraryItem))
    }
  }

  async closeSessionRequest(user, session, syncData, res) {
    await this.closeSession(user, session, syncData)
    res.sendStatus(200)
  }

  async startSession(user, libraryItem, options) {
    var shouldDirectPlay = options.forceDirectPlay || (!options.forceTranscode && libraryItem.media.checkCanDirectPlay(options))

    const userProgress = user.getMediaProgress(libraryItem.id)
    var userStartTime = 0
    if (userProgress) userStartTime = userProgress.currentTime || 0
    const newPlaybackSession = new PlaybackSession()
    newPlaybackSession.setData(libraryItem, user)

    var audioTracks = []
    if (shouldDirectPlay) {
      Logger.debug(`[PlaybackSessionManager] "${user.username}" starting direct play session for item "${libraryItem.id}"`)
      audioTracks = libraryItem.getDirectPlayTracklist(libraryItem.id)
      newPlaybackSession.playMethod = PlayMethod.DIRECTPLAY
    } else {
      Logger.debug(`[PlaybackSessionManager] "${user.username}" starting stream session for item "${libraryItem.id}"`)
      var stream = new Stream(newPlaybackSession.id, this.StreamsPath, user, libraryItem, userStartTime, this.clientEmitter.bind(this))
      await stream.generatePlaylist()
      audioTracks = [stream.getAudioTrack()]
      newPlaybackSession.stream = stream
      newPlaybackSession.playMethod = PlayMethod.TRANSCODE
      stream.on('closed', () => {
        Logger.debug(`[PlaybackSessionManager] Stream closed for session "${newPlaybackSession.id}"`)
        newPlaybackSession.stream = null
      })
    }

    newPlaybackSession.currentTime = userStartTime
    newPlaybackSession.audioTracks = audioTracks

    // Will save on the first sync
    user.currentSessionId = newPlaybackSession.id

    this.sessions.push(newPlaybackSession)
    this.emitter('user_stream_update', user.toJSONForPublic(this.sessions, this.db.libraryItems))

    return newPlaybackSession
  }

  async syncSession(user, session, syncData) {
    var libraryItem = this.db.libraryItems.find(li => li.id === session.libraryItemId)
    if (!libraryItem) {
      Logger.error(`[PlaybackSessionManager] syncSession Library Item not found "${sessino.libraryItemId}"`)
      return null
    }

    session.currentTime = syncData.currentTime
    session.addListeningTime(syncData.timeListened)
    Logger.debug(`[PlaybackSessionManager] syncSession "${session.id}" | Total Time Listened: ${session.timeListening}`)

    const itemProgressUpdate = {
      duration: syncData.duration,
      currentTime: syncData.currentTime,
      progress: session.progress
    }
    var wasUpdated = user.createUpdateMediaProgress(libraryItem, itemProgressUpdate)
    if (wasUpdated) {
      await this.db.updateEntity('user', user)
      var itemProgress = user.getMediaProgress(session.libraryItemId)
      this.clientEmitter(user.id, 'user_item_progress_updated', {
        id: itemProgress.id,
        data: itemProgress.toJSON()
      })
    }
    this.saveSession(session)
    return {
      libraryItem
    }
  }

  async closeSession(user, session, syncData = null) {
    if (syncData) {
      await this.syncSession(user, session, syncData)
    } else {
      await this.saveSession(session)
    }
    Logger.debug(`[PlaybackSessionManager] closeSession "${session.id}"`)
    this.emitter('user_stream_update', user.toJSONForPublic(this.sessions, this.db.libraryItems))
    return this.removeSession(session.id)
  }

  saveSession(session) {
    if (!session.timeListening) return // Do not save a session with no listening time

    if (session.lastSave) {
      return this.db.updateEntity('session', session)
    } else {
      session.lastSave = Date.now()
      return this.db.insertEntity('session', session)
    }
  }

  async removeSession(sessionId) {
    var session = this.sessions.find(s => s.id === sessionId)
    if (!session) return
    if (session.stream) {
      await session.stream.close()
    }
    this.sessions = this.sessions.filter(s => s.id !== sessionId)
    Logger.debug(`[PlaybackSessionManager] Removed session "${sessionId}"`)
  }
}
module.exports = PlaybackSessionManager