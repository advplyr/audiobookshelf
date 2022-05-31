const Path = require('path')
const date = require('date-and-time')
const serverVersion = require('../../package.json').version
const { PlayMethod } = require('../utils/constants')
const PlaybackSession = require('../objects/PlaybackSession')
const DeviceInfo = require('../objects/DeviceInfo')
const Stream = require('../objects/Stream')
const Logger = require('../Logger')
const fs = require('fs-extra')

const uaParserJs = require('../libs/uaParserJs')
const requestIp = require('../libs/requestIp')

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

  getDeviceInfo(req) {
    const ua = uaParserJs(req.headers['user-agent'])
    const ip = requestIp.getClientIp(req)
    const clientDeviceInfo = req.body ? req.body.deviceInfo || null : null // From mobile client

    const deviceInfo = new DeviceInfo()
    deviceInfo.setData(ip, ua, clientDeviceInfo, serverVersion)
    return deviceInfo
  }

  async startSessionRequest(req, res, episodeId) {
    const deviceInfo = this.getDeviceInfo(req)

    const { user, libraryItem, body: options } = req
    const session = await this.startSession(user, deviceInfo, libraryItem, episodeId, options)
    res.json(session.toJSONForClient(libraryItem))
  }

  async syncSessionRequest(user, session, payload, res) {
    var result = await this.syncSession(user, session, payload)
    if (result) {
      res.json(session.toJSONForClient(result.libraryItem))
    }
  }

  async syncLocalSessionRequest(user, sessionJson, res) {
    var libraryItem = this.db.getLibraryItem(sessionJson.libraryItemId)
    if (!libraryItem) {
      Logger.error(`[PlaybackSessionManager] syncLocalSessionRequest: Library item not found for session "${sessionJson.libraryItemId}"`)
      return res.sendStatus(200)
    }

    var session = await this.db.getPlaybackSession(sessionJson.id)
    if (!session) {
      // New session from local
      session = new PlaybackSession(sessionJson)
      await this.db.insertEntity('session', session)
    } else {
      session.timeListening = sessionJson.timeListening
      session.updatedAt = sessionJson.updatedAt
      session.date = date.format(new Date(), 'YYYY-MM-DD')
      session.dayOfWeek = date.format(new Date(), 'dddd')
      await this.db.updateEntity('session', session)
    }

    session.currentTime = sessionJson.currentTime

    const itemProgressUpdate = {
      duration: session.duration,
      currentTime: session.currentTime,
      progress: session.progress,
      lastUpdate: session.updatedAt // Keep media progress update times the same as local
    }
    var wasUpdated = user.createUpdateMediaProgress(libraryItem, itemProgressUpdate, session.episodeId)
    if (wasUpdated) {
      await this.db.updateEntity('user', user)
      var itemProgress = user.getMediaProgress(session.libraryItemId, session.episodeId)
      this.clientEmitter(user.id, 'user_item_progress_updated', {
        id: itemProgress.id,
        data: itemProgress.toJSON()
      })
    }
    res.sendStatus(200)
  }

  async closeSessionRequest(user, session, syncData, res) {
    await this.closeSession(user, session, syncData)
    res.sendStatus(200)
  }

  async startSession(user, deviceInfo, libraryItem, episodeId, options) {
    // Close any sessions already open for user
    var userSessions = this.sessions.filter(playbackSession => playbackSession.userId === user.id)
    for (const session of userSessions) {
      Logger.info(`[PlaybackSessionManager] startSession: Closing open session "${session.displayTitle}" for user "${user.username}"`)
      await this.closeSession(user, session, null)
    }

    var shouldDirectPlay = options.forceDirectPlay || (!options.forceTranscode && libraryItem.media.checkCanDirectPlay(options, episodeId))
    var mediaPlayer = options.mediaPlayer || 'unknown'

    const userProgress = user.getMediaProgress(libraryItem.id, episodeId)
    var userStartTime = 0
    if (userProgress) userStartTime = Number.parseFloat(userProgress.currentTime) || 0
    const newPlaybackSession = new PlaybackSession()
    newPlaybackSession.setData(libraryItem, user, mediaPlayer, deviceInfo, userStartTime, episodeId)

    if (libraryItem.mediaType === 'video') {
      if (shouldDirectPlay) {
        Logger.debug(`[PlaybackSessionManager] "${user.username}" starting direct play session for item "${libraryItem.id}"`)
        newPlaybackSession.videoTrack = libraryItem.media.getVideoTrack()
        newPlaybackSession.playMethod = PlayMethod.DIRECTPLAY
      } else {
        // HLS not supported for video yet
      }
    } else {
      var audioTracks = []
      if (shouldDirectPlay) {
        Logger.debug(`[PlaybackSessionManager] "${user.username}" starting direct play session for item "${libraryItem.id}"`)
        audioTracks = libraryItem.getDirectPlayTracklist(episodeId)
        newPlaybackSession.playMethod = PlayMethod.DIRECTPLAY
      } else {
        Logger.debug(`[PlaybackSessionManager] "${user.username}" starting stream session for item "${libraryItem.id}"`)
        var stream = new Stream(newPlaybackSession.id, this.StreamsPath, user, libraryItem, episodeId, userStartTime, this.clientEmitter.bind(this))
        await stream.generatePlaylist()
        stream.start() // Start transcode

        audioTracks = [stream.getAudioTrack()]
        newPlaybackSession.stream = stream
        newPlaybackSession.playMethod = PlayMethod.TRANSCODE

        stream.on('closed', () => {
          Logger.debug(`[PlaybackSessionManager] Stream closed for session "${newPlaybackSession.id}"`)
          newPlaybackSession.stream = null
        })
      }
      newPlaybackSession.audioTracks = audioTracks
    }

    // Will save on the first sync
    user.currentSessionId = newPlaybackSession.id

    this.sessions.push(newPlaybackSession)
    this.emitter('user_stream_update', user.toJSONForPublic(this.sessions, this.db.libraryItems))

    return newPlaybackSession
  }

  async syncSession(user, session, syncData) {
    var libraryItem = this.db.libraryItems.find(li => li.id === session.libraryItemId)
    if (!libraryItem) {
      Logger.error(`[PlaybackSessionManager] syncSession Library Item not found "${session.libraryItemId}"`)
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
    var wasUpdated = user.createUpdateMediaProgress(libraryItem, itemProgressUpdate, session.episodeId)
    if (wasUpdated) {

      await this.db.updateEntity('user', user)
      var itemProgress = user.getMediaProgress(session.libraryItemId, session.episodeId)
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

  // Check for streams that are not in memory and remove
  async removeOrphanStreams() {
    await fs.ensureDir(this.StreamsPath)
    try {
      var streamsInPath = await fs.readdir(this.StreamsPath)
      for (let i = 0; i < streamsInPath.length; i++) {
        var streamId = streamsInPath[i]
        if (streamId.startsWith('play_')) { // Make sure to only remove folders that are a stream
          var session = this.sessions.find(se => se.id === streamId)
          if (!session) {
            var streamPath = Path.join(this.StreamsPath, streamId)
            Logger.debug(`[PlaybackSessionManager] Removing orphan stream "${streamPath}"`)
            await fs.remove(streamPath)
          }
        }
      }
    } catch (error) {
      Logger.error(`[PlaybackSessionManager] cleanOrphanStreams failed`, error)
    }
  }
}
module.exports = PlaybackSessionManager