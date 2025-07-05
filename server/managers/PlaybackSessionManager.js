const uuidv4 = require('uuid').v4
const Path = require('path')
const serverVersion = require('../../package.json').version
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')

const date = require('../libs/dateAndTime')
const fs = require('../libs/fsExtra')
const uaParserJs = require('../libs/uaParser')
const requestIp = require('../libs/requestIp')

const { PlayMethod } = require('../utils/constants')

const PlaybackSession = require('../objects/PlaybackSession')
const DeviceInfo = require('../objects/DeviceInfo')
const Stream = require('../objects/Stream')

class PlaybackSessionManager {
  constructor() {
    this.StreamsPath = Path.join(global.MetadataPath, 'streams')

    this.oldPlaybackSessionMap = {} // TODO: Remove after updated mobile versions

    /** @type {PlaybackSession[]} */
    this.sessions = []
  }

  /**
   * Get open session by id
   *
   * @param {string} sessionId
   * @returns {PlaybackSession}
   */
  getSession(sessionId) {
    return this.sessions.find((s) => s.id === sessionId)
  }
  getUserSession(userId) {
    return this.sessions.find((s) => s.userId === userId)
  }
  getStream(sessionId) {
    const session = this.getSession(sessionId)
    return session?.stream || null
  }

  /**
   *
   * @param {import('../controllers/LibraryItemController').LibraryItemControllerRequest} req
   * @param {Object} [clientDeviceInfo]
   * @returns {Promise<DeviceInfo>}
   */
  async getDeviceInfo(req, clientDeviceInfo = null) {
    const ua = uaParserJs(req.headers['user-agent'])
    const ip = requestIp.getClientIp(req)

    const deviceInfo = new DeviceInfo()
    deviceInfo.setData(ip, ua, clientDeviceInfo, serverVersion, req.user?.id)

    if (clientDeviceInfo?.deviceId) {
      const existingDevice = await Database.deviceModel.getOldDeviceByDeviceId(clientDeviceInfo.deviceId)
      if (existingDevice) {
        if (existingDevice.update(deviceInfo)) {
          await Database.deviceModel.updateFromOld(existingDevice)
        }
        return existingDevice
      }
    }

    await Database.deviceModel.createFromOld(deviceInfo)

    return deviceInfo
  }

  /**
   *
   * @param {import('../controllers/LibraryItemController').LibraryItemControllerRequest} req
   * @param {import('express').Response} res
   * @param {string} [episodeId]
   */
  async startSessionRequest(req, res, episodeId) {
    const deviceInfo = await this.getDeviceInfo(req, req.body?.deviceInfo)
    Logger.debug(`[PlaybackSessionManager] startSessionRequest for device ${deviceInfo.deviceDescription}`)
    const { libraryItem, body: options } = req
    const session = await this.startSession(req.user, deviceInfo, libraryItem, episodeId, options)
    res.json(session.toJSONForClient(libraryItem))
  }

  /**
   *
   * @param {import('../models/User')} user
   * @param {*} session
   * @param {*} payload
   * @param {import('express').Response} res
   */
  async syncSessionRequest(user, session, payload, res) {
    if (await this.syncSession(user, session, payload)) {
      res.sendStatus(200)
    } else {
      res.sendStatus(500)
    }
  }

  async syncLocalSessionsRequest(req, res) {
    const deviceInfo = await this.getDeviceInfo(req, req.body?.deviceInfo)
    const user = req.user
    const sessions = req.body.sessions || []

    const syncResults = []
    for (const sessionJson of sessions) {
      Logger.info(`[PlaybackSessionManager] Syncing local session "${sessionJson.displayTitle}" (${sessionJson.id}) (updatedAt: ${sessionJson.updatedAt})`)
      const result = await this.syncLocalSession(user, sessionJson, deviceInfo)
      syncResults.push(result)
    }

    res.json({
      results: syncResults
    })
  }

  /**
   *
   * @param {import('../models/User')} user
   * @param {*} sessionJson
   * @param {*} deviceInfo
   * @returns
   */
  async syncLocalSession(user, sessionJson, deviceInfo) {
    // TODO: Combine libraryItem query with library query
    const libraryItem = await Database.libraryItemModel.getExpandedById(sessionJson.libraryItemId)
    const episode = sessionJson.episodeId && libraryItem && libraryItem.isPodcast ? libraryItem.media.podcastEpisodes.find((pe) => pe.id === sessionJson.episodeId) : null
    if (!libraryItem || (libraryItem.isPodcast && !episode)) {
      Logger.error(`[PlaybackSessionManager] syncLocalSession: Media item not found for session "${sessionJson.displayTitle}" (${sessionJson.id})`)
      return {
        id: sessionJson.id,
        success: false,
        error: 'Media item not found'
      }
    }

    const library = await Database.libraryModel.findByPk(libraryItem.libraryId)
    if (!library) {
      Logger.error(`[PlaybackSessionManager] syncLocalSession: Library not found for session "${sessionJson.displayTitle}" (${sessionJson.id})`)
      return {
        id: sessionJson.id,
        success: false,
        error: 'Library not found'
      }
    }

    sessionJson.userId = user.id
    sessionJson.serverVersion = serverVersion

    // TODO: Temp update local playback session id to uuidv4 & library item/book/episode ids
    if (sessionJson.id?.startsWith('play_local_')) {
      if (!this.oldPlaybackSessionMap[sessionJson.id]) {
        const newSessionId = uuidv4()
        this.oldPlaybackSessionMap[sessionJson.id] = newSessionId
        sessionJson.id = newSessionId
      } else {
        sessionJson.id = this.oldPlaybackSessionMap[sessionJson.id]
      }
    }
    if (sessionJson.libraryItemId !== libraryItem.id) {
      Logger.info(`[PlaybackSessionManager] Mapped old libraryItemId "${sessionJson.libraryItemId}" to ${libraryItem.id}`)
      sessionJson.libraryItemId = libraryItem.id
      sessionJson.bookId = episode ? null : libraryItem.media.id
    }
    if (!sessionJson.bookId && !episode) {
      sessionJson.bookId = libraryItem.media.id
    }
    if (episode && sessionJson.episodeId !== episode.id) {
      Logger.info(`[PlaybackSessionManager] Mapped old episodeId "${sessionJson.episodeId}" to ${episode.id}`)
      sessionJson.episodeId = episode.id
    }
    if (sessionJson.libraryId !== libraryItem.libraryId) {
      sessionJson.libraryId = libraryItem.libraryId
    }

    let session = await Database.getPlaybackSession(sessionJson.id)
    if (!session) {
      // New session from local
      session = new PlaybackSession(sessionJson)
      session.deviceInfo = deviceInfo

      if (session.mediaMetadata == null) {
        session.mediaMetadata = {}
      }

      // Populate mediaMetadata with the current library items metadata for any keys not set by client
      const libraryItemMediaMetadata = libraryItem.media.oldMetadataToJSON()
      for (const key in libraryItemMediaMetadata) {
        if (session.mediaMetadata[key] === undefined) {
          session.mediaMetadata[key] = libraryItemMediaMetadata[key]
        }
      }

      if (session.displayTitle == null || session.displayTitle === '') {
        session.displayTitle = libraryItem.title
      }
      if (session.displayAuthor == null || session.displayAuthor === '') {
        session.displayAuthor = libraryItem.authorNamesFirstLast
      }
      session.duration = libraryItem.media.getPlaybackDuration(sessionJson.episodeId)

      Logger.debug(`[PlaybackSessionManager] Inserting new session for "${session.displayTitle}" (${session.id})`)
      await Database.createPlaybackSession(session)
    } else {
      session.currentTime = sessionJson.currentTime
      session.timeListening = sessionJson.timeListening
      session.updatedAt = sessionJson.updatedAt

      let jsDate = new Date(sessionJson.updatedAt)
      if (isNaN(jsDate)) {
        jsDate = new Date()
      }
      session.date = date.format(jsDate, 'YYYY-MM-DD')
      session.dayOfWeek = date.format(jsDate, 'dddd')

      Logger.debug(`[PlaybackSessionManager] Updated session for "${session.displayTitle}" (${session.id})`)
      await Database.updatePlaybackSession(session)
    }

    const result = {
      id: session.id,
      success: true,
      progressSynced: false
    }

    const mediaItemId = session.episodeId || libraryItem.media.id
    let userProgressForItem = user.getMediaProgress(mediaItemId)
    if (userProgressForItem) {
      if (userProgressForItem.updatedAt.valueOf() > session.updatedAt) {
        Logger.info(`[PlaybackSessionManager] Not updating progress for "${session.displayTitle}" because it has been updated more recently (${userProgressForItem.updatedAt.valueOf()} > ${session.updatedAt}) (incoming currentTime: ${session.currentTime}) (current currentTime: ${userProgressForItem.currentTime})`)
      } else {
        Logger.info(`[PlaybackSessionManager] Updating progress for "${session.displayTitle}" with current time ${session.currentTime} (previously ${userProgressForItem.currentTime})`)
        const updateResponse = await user.createUpdateMediaProgressFromPayload({
          libraryItemId: libraryItem.id,
          episodeId: session.episodeId,
          ...session.mediaProgressObject,
          markAsFinishedPercentComplete: library.librarySettings.markAsFinishedPercentComplete,
          markAsFinishedTimeRemaining: library.librarySettings.markAsFinishedTimeRemaining
        })
        result.progressSynced = !!updateResponse.mediaProgress
        if (result.progressSynced) {
          userProgressForItem = updateResponse.mediaProgress
        }
      }
    } else {
      Logger.info(`[PlaybackSessionManager] Creating new media progress for media item "${session.displayTitle}"`)
      const updateResponse = await user.createUpdateMediaProgressFromPayload({
        libraryItemId: libraryItem.id,
        episodeId: session.episodeId,
        ...session.mediaProgressObject,
        markAsFinishedPercentComplete: library.librarySettings.markAsFinishedPercentComplete,
        markAsFinishedTimeRemaining: library.librarySettings.markAsFinishedTimeRemaining
      })
      result.progressSynced = !!updateResponse.mediaProgress
      if (result.progressSynced) {
        userProgressForItem = updateResponse.mediaProgress
      }
    }

    // Update user and emit socket event
    if (result.progressSynced) {
      SocketAuthority.clientEmitter(user.id, 'user_item_progress_updated', {
        id: userProgressForItem.id,
        sessionId: session.id,
        deviceDescription: session.deviceDescription,
        data: userProgressForItem.getOldMediaProgress()
      })
    }

    return result
  }

  /**
   *
   * @param {import('../controllers/SessionController').RequestWithUser} req
   * @param {*} res
   */
  async syncLocalSessionRequest(req, res) {
    const deviceInfo = await this.getDeviceInfo(req, req.body?.deviceInfo)
    const sessionJson = req.body
    const result = await this.syncLocalSession(req.user, sessionJson, deviceInfo)
    if (result.error) {
      res.status(500).send(result.error)
    } else {
      res.sendStatus(200)
    }
  }

  /**
   *
   * @param {import('../models/User')} user
   * @param {*} session
   * @param {*} syncData
   * @param {import('express').Response} res
   */
  async closeSessionRequest(user, session, syncData, res) {
    await this.closeSession(user, session, syncData)
    res.sendStatus(200)
  }

  /**
   *
   * @param {import('../models/User')} user
   * @param {DeviceInfo} deviceInfo
   * @param {import('../models/LibraryItem')} libraryItem
   * @param {string|null} episodeId
   * @param {{forceDirectPlay?:boolean, forceTranscode?:boolean, mediaPlayer:string, supportedMimeTypes?:string[]}} options
   * @returns {Promise<PlaybackSession>}
   */
  async startSession(user, deviceInfo, libraryItem, episodeId, options) {
    // Close any sessions already open for user and device
    const userSessions = this.sessions.filter((playbackSession) => playbackSession.userId === user.id && playbackSession.deviceId === deviceInfo.id)
    for (const session of userSessions) {
      Logger.info(`[PlaybackSessionManager] startSession: Closing open session "${session.displayTitle}" for user "${user.username}" (Device: ${session.deviceDescription})`)
      await this.closeSession(user, session, null)
    }

    const shouldDirectPlay = options.forceDirectPlay || (!options.forceTranscode && libraryItem.media.checkCanDirectPlay(options.supportedMimeTypes, episodeId))
    const mediaPlayer = options.mediaPlayer || 'unknown'

    const mediaItemId = episodeId || libraryItem.media.id
    const userProgress = user.getMediaProgress(mediaItemId)
    let userStartTime = 0
    if (userProgress) {
      if (userProgress.isFinished) {
        Logger.info(`[PlaybackSessionManager] Starting session for user "${user.username}" and resetting progress for finished item "${libraryItem.media.title}"`)
        // Keep userStartTime as 0 so the client restarts the media
      } else {
        userStartTime = Number.parseFloat(userProgress.currentTime) || 0
      }
    }
    const newPlaybackSession = new PlaybackSession()
    newPlaybackSession.setData(libraryItem, user.id, mediaPlayer, deviceInfo, userStartTime, episodeId)

    let audioTracks = []
    if (shouldDirectPlay) {
      Logger.debug(`[PlaybackSessionManager] "${user.username}" starting direct play session for item "${libraryItem.id}" with id ${newPlaybackSession.id} (Device: ${newPlaybackSession.deviceDescription})`)
      audioTracks = libraryItem.getTrackList(episodeId)
      newPlaybackSession.playMethod = PlayMethod.DIRECTPLAY
    } else {
      Logger.debug(`[PlaybackSessionManager] "${user.username}" starting stream session for item "${libraryItem.id}" (Device: ${newPlaybackSession.deviceDescription})`)
      const stream = new Stream(newPlaybackSession.id, this.StreamsPath, user, libraryItem, episodeId, userStartTime)
      await stream.generatePlaylist()
      stream.start() // Start transcode

      audioTracks = [stream.getAudioTrack()]
      newPlaybackSession.stream = stream
      newPlaybackSession.playMethod = PlayMethod.TRANSCODE

      stream.on('closed', () => {
        Logger.debug(`[PlaybackSessionManager] Stream closed for session "${newPlaybackSession.id}" (Device: ${newPlaybackSession.deviceDescription})`)
        newPlaybackSession.stream = null
      })
    }
    newPlaybackSession.audioTracks = audioTracks

    this.sessions.push(newPlaybackSession)
    SocketAuthority.adminEmitter('user_stream_update', user.toJSONForPublic(this.sessions))

    return newPlaybackSession
  }

  /**
   *
   * @param {import('../models/User')} user
   * @param {*} session
   * @param {*} syncData
   * @returns {Promise<boolean>}
   */
  async syncSession(user, session, syncData) {
    // TODO: Combine libraryItem query with library query
    const libraryItem = await Database.libraryItemModel.getExpandedById(session.libraryItemId)
    if (!libraryItem) {
      Logger.error(`[PlaybackSessionManager] syncSession Library Item not found "${session.libraryItemId}"`)
      return false
    }

    const library = await Database.libraryModel.findByPk(libraryItem.libraryId)
    if (!library) {
      Logger.error(`[PlaybackSessionManager] syncSession Library not found "${libraryItem.libraryId}"`)
      return false
    }

    session.currentTime = syncData.currentTime
    session.addListeningTime(syncData.timeListened)
    Logger.debug(`[PlaybackSessionManager] syncSession "${session.id}" (Device: ${session.deviceDescription}) | Total Time Listened: ${session.timeListening}`)

    const updateResponse = await user.createUpdateMediaProgressFromPayload({
      libraryItemId: libraryItem.id,
      episodeId: session.episodeId,
      // duration no longer required (v2.15.1) but used if available
      duration: syncData.duration || session.duration || 0,
      currentTime: syncData.currentTime,
      progress: session.progress,
      markAsFinishedTimeRemaining: library.librarySettings.markAsFinishedTimeRemaining,
      markAsFinishedPercentComplete: library.librarySettings.markAsFinishedPercentComplete
    })
    if (updateResponse.mediaProgress) {
      SocketAuthority.clientEmitter(user.id, 'user_item_progress_updated', {
        id: updateResponse.mediaProgress.id,
        sessionId: session.id,
        deviceDescription: session.deviceDescription,
        data: updateResponse.mediaProgress.getOldMediaProgress()
      })
    }
    this.saveSession(session)

    return true
  }

  /**
   *
   * @param {import('../models/User')} user
   * @param {*} session
   * @param {*} syncData
   * @returns
   */
  async closeSession(user, session, syncData = null) {
    if (syncData) {
      await this.syncSession(user, session, syncData)
    } else {
      await this.saveSession(session)
    }
    Logger.debug(`[PlaybackSessionManager] closeSession "${session.id}"`)
    SocketAuthority.adminEmitter('user_stream_update', user.toJSONForPublic(this.sessions))
    SocketAuthority.clientEmitter(session.userId, 'user_session_closed', session.id)
    return this.removeSession(session.id)
  }

  saveSession(session) {
    if (!session.timeListening) return // Do not save a session with no listening time

    if (session.lastSave) {
      return Database.updatePlaybackSession(session)
    } else {
      session.lastSave = Date.now()
      return Database.createPlaybackSession(session)
    }
  }

  /**
   *
   * @param {string} sessionId
   */
  async removeSession(sessionId) {
    const session = this.sessions.find((s) => s.id === sessionId)
    if (!session) return
    if (session.stream) {
      await session.stream.close()
    }
    this.sessions = this.sessions.filter((s) => s.id !== sessionId)
    Logger.debug(`[PlaybackSessionManager] Removed session "${sessionId}"`)
  }

  /**
   * Remove all stream folders in `/metadata/streams`
   */
  async removeOrphanStreams() {
    await fs.ensureDir(this.StreamsPath)
    try {
      const streamsInPath = await fs.readdir(this.StreamsPath)
      for (const streamId of streamsInPath) {
        if (/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/.test(streamId)) {
          // Ensure is uuidv4
          const session = this.sessions.find((se) => se.id === streamId)
          if (!session) {
            const streamPath = Path.join(this.StreamsPath, streamId)
            Logger.debug(`[PlaybackSessionManager] Removing orphan stream "${streamPath}"`)
            await fs.remove(streamPath)
          }
        }
      }
    } catch (error) {
      Logger.error(`[PlaybackSessionManager] cleanOrphanStreams failed`, error)
    }
  }

  /**
   * Close all open sessions that have not been updated in the last 36 hours
   */
  async closeStaleOpenSessions() {
    const updatedAtTimeCutoff = Date.now() - 1000 * 60 * 60 * 36
    const staleSessions = this.sessions.filter((session) => session.updatedAt < updatedAtTimeCutoff)
    for (const session of staleSessions) {
      const sessionLastUpdate = new Date(session.updatedAt)
      Logger.info(`[PlaybackSessionManager] Closing stale session "${session.displayTitle}" (${session.id}) last updated at ${sessionLastUpdate}`)
      await this.removeSession(session.id)
    }
  }
}
module.exports = PlaybackSessionManager
