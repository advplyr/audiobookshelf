import Path from 'path'
import type { Request, Response, NextFunction } from 'express'
import type User from '../models/User'
import type PlaybackSessionManager from '../managers/PlaybackSessionManager'
import type PlaybackSession from '../objects/PlaybackSession'
import Logger from '../Logger'
import Database from '../Database'
import { toNumber, isUUID } from '../utils/index'
import { getAudioMimeTypeFromExtname, encodeUriPath } from '../utils/fileUtils'
import { PlayMethod } from '../utils/constants'

import ShareManager from '../managers/ShareManager'

type RequestWithUser<Body = unknown> = Request<Record<string, string>, unknown, Body> & { user: User }
type RequestWithSession<Body = unknown> = RequestWithUser<Body> & { playbackSession: PlaybackSession }
type SessionListRequest = Request<Record<string, string>, unknown, unknown, { user?: string; sort?: string; desc?: string; itemsPerPage?: string; page?: string }> & { user: User }
type SessionContext = { playbackSessionManager: PlaybackSessionManager }

class SessionController {
  constructor() {}

  /**
   * GET: /api/sessions
   */
  async getAllWithUserData(req: SessionListRequest, res: Response) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[SessionController] getAllWithUserData: Non-admin user "${req.user.username}" requested all session data`)
      return res.sendStatus(404)
    }
    // Validate "user" query
    let userId: string | null | undefined = req.query.user
    if (userId && !isUUID(userId)) {
      Logger.warn(`[SessionController] Invalid "user" query string "${userId}"`)
      userId = null
    }
    // Validate "sort" query
    const validSortOrders = ['displayTitle', 'duration', 'playMethod', 'startTime', 'currentTime', 'timeListening', 'updatedAt', 'createdAt']
    let orderKey = req.query.sort || 'updatedAt'
    if (!validSortOrders.includes(orderKey)) {
      Logger.warn(`[SessionController] Invalid "sort" query string "${orderKey}" (Must be one of "${validSortOrders.join('|')}")`)
      orderKey = 'updatedAt'
    }
    let orderDesc = req.query.desc === '1' ? 'DESC' : 'ASC'
    // Validate "itemsPerPage" and "page" query
    let itemsPerPage = toNumber(req.query.itemsPerPage, 10) || 10
    if (itemsPerPage < 1) {
      Logger.warn(`[SessionController] Invalid "itemsPerPage" query string "${itemsPerPage}"`)
      itemsPerPage = 10
    }
    let page = toNumber(req.query.page, 0)
    if (page < 0) {
      Logger.warn(`[SessionController] Invalid "page" query string "${page}"`)
      page = 0
    }

    let where: { userId: string } | null = null

    if (userId) {
      where = {
        userId
      }
    }

    const { rows, count } = await Database.playbackSessionModel.findAndCountAll({
      where: where!,
      include: [
        {
          model: Database.deviceModel
        },
        {
          model: Database.userModel,
          attributes: ['id', 'username']
        }
      ],
      order: [[orderKey, orderDesc]],
      limit: itemsPerPage,
      offset: itemsPerPage * page
    })

    // Map playback sessions to old playback sessions
    const sessions = rows.map((session) => {
      const oldPlaybackSession = Database.playbackSessionModel.getOldPlaybackSession(session)
      if (session.user) {
        return {
          ...oldPlaybackSession,
          user: {
            id: session.user.id,
            username: session.user.username
          }
        }
      } else {
        return oldPlaybackSession.toJSON()
      }
    })

    const payload: { total: number; numPages: number; page: number; itemsPerPage: number; sessions: typeof sessions; userId?: string } = {
      total: count,
      numPages: Math.ceil(count / itemsPerPage),
      page,
      itemsPerPage,
      sessions
    }
    if (userId) {
      payload.userId = userId
    }

    res.json(payload)
  }

  /**
   * GET: /api/sessions/open
   */
  async getOpenSessions(this: SessionContext, req: RequestWithUser, res: Response) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[SessionController] getOpenSessions: Non-admin user "${req.user.username}" requested open session data`)
      return res.sendStatus(404)
    }

    const minifiedUserObjects = await Database.userModel.getMinifiedUserObjects()
    const openSessions = this.playbackSessionManager.sessions.map((se) => {
      return {
        ...se.toJSON(),
        user: minifiedUserObjects.find((u) => u.id === se.userId) || null
      }
    })

    const shareSessions = ShareManager.openSharePlaybackSessions.map((se) => se.toJSON())

    res.json({
      sessions: openSessions,
      shareSessions
    })
  }

  /**
   * GET: /api/session/:id
   */
  async getOpenSession(req: RequestWithSession, res: Response) {
    const libraryItem = await Database.libraryItemModel.getExpandedById(req.playbackSession.libraryItemId)
    const sessionForClient = req.playbackSession.toJSONForClient(libraryItem)
    res.json(sessionForClient)
  }

  /**
   * POST: /api/session/:id/sync
   */
  sync(this: SessionContext, req: RequestWithSession<Parameters<PlaybackSessionManager['syncSessionRequest']>[2]>, res: Response) {
    void this.playbackSessionManager.syncSessionRequest(req.user, req.playbackSession, req.body, res)
  }

  /**
   * POST: /api/session/:id/close
   */
  close(this: SessionContext, req: RequestWithSession<Parameters<PlaybackSessionManager['closeSessionRequest']>[2]>, res: Response) {
    let syncData = req.body
    if (syncData && !Object.keys(syncData).length) syncData = null
    void this.playbackSessionManager.closeSessionRequest(req.user, req.playbackSession, syncData, res)
  }

  /**
   * DELETE: /api/session/:id
   */
  async delete(this: SessionContext, req: RequestWithSession, res: Response) {
    // if session is open then remove it
    const openSession = this.playbackSessionManager.getSession(req.playbackSession.id!)
    if (openSession) {
      await this.playbackSessionManager.removeSession(req.playbackSession.id)
    }

    await Database.removePlaybackSession(req.playbackSession.id!)
    res.sendStatus(200)
  }

  /**
   * POST: /api/sessions/batch/delete
   */
  async batchDelete(this: SessionContext, req: RequestWithUser<{ sessions?: string[] }>, res: Response) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[SessionController] Non-admin user "${req.user.username}" attempted to batch delete sessions`)
      return res.sendStatus(403)
    }
    // Validate session ids
    if (!req.body.sessions?.length || !Array.isArray(req.body.sessions) || req.body.sessions.some((s) => !isUUID(s))) {
      Logger.error(`[SessionController] Invalid request body. "sessions" array is required`, req.body)
      return res.status(400).send('Invalid request body. "sessions" array of session id strings is required.')
    }

    // Check if any of these sessions are open and close it
    for (const sessionId of req.body.sessions) {
      const openSession = this.playbackSessionManager.getSession(sessionId)
      if (openSession) {
        await this.playbackSessionManager.removeSession(sessionId)
      }
    }

    try {
      const sessionsRemoved = await Database.playbackSessionModel.destroy({
        where: {
          id: req.body.sessions
        }
      })
      Logger.info(`[SessionController] ${sessionsRemoved} playback sessions removed by "${req.user.username}"`)
      res.sendStatus(200)
    } catch (error) {
      Logger.error(`[SessionController] Failed to remove playback sessions`, error)
      res.status(500).send('Failed to remove sessions')
    }
  }

  /**
   * POST: /api/session/local
   */
  syncLocal(this: SessionContext, req: Parameters<PlaybackSessionManager['syncLocalSessionRequest']>[0], res: Response) {
    void this.playbackSessionManager.syncLocalSessionRequest(req, res)
  }

  /**
   * POST: /api/session/local-all
   */
  syncLocalSessions(this: SessionContext, req: Parameters<PlaybackSessionManager['syncLocalSessionsRequest']>[0], res: Response) {
    void this.playbackSessionManager.syncLocalSessionsRequest(req, res)
  }

  /**
   * GET: /public/session/:id/track/:index
   * While a session is open, this endpoint can be used to stream the audio track
   */
  async getTrack(this: SessionContext, req: Request, res: Response) {
    const audioTrackIndex = toNumber(req.params.index, null)
    if (audioTrackIndex === null) {
      Logger.error(`[SessionController] Invalid audio track index "${req.params.index}"`)
      return res.sendStatus(400)
    }

    const playbackSession = this.playbackSessionManager.getSession(req.params.id)
    if (!playbackSession) {
      Logger.error(`[SessionController] Unable to find playback session with id=${req.params.id}`)
      return res.sendStatus(404)
    }

    let audioTrack = playbackSession.audioTracks.find((t) => toNumber(t.index, 1) === audioTrackIndex)

    // Support clients passing 0 or 1 for podcast episode audio track index (handles old episodes pre-v2.21.0 having null index)
    if (!audioTrack && playbackSession.mediaType === 'podcast' && audioTrackIndex === 0) {
      audioTrack = playbackSession.audioTracks[0]
    }
    if (!audioTrack) {
      Logger.error(`[SessionController] Unable to find audio track with index=${audioTrackIndex}`)
      return res.sendStatus(404)
    }

    // Redirect transcode requests to the HLS router
    // Handles bug introduced in android v0.10.0-beta where transcode requests are made to this endpoint
    if (playbackSession.playMethod === PlayMethod.TRANSCODE && audioTrack.contentUrl) {
      Logger.debug(`[SessionController] Redirecting transcode request to "${audioTrack.contentUrl}"`)
      return res.redirect(audioTrack.contentUrl)
    }

    if (!audioTrack.metadata?.path) {
      Logger.error(`[SessionController] Invalid audio track "${audioTrack.index}" for session "${req.params.id}"`)
      return res.sendStatus(500)
    }

    const user = await Database.userModel.getUserById(playbackSession.userId)
    Logger.debug(`[SessionController] Serving audio track ${audioTrack.index} for session "${req.params.id}" belonging to user "${user!.username}"`)

    if (global.XAccel) {
      const encodedURI = encodeUriPath(global.XAccel + audioTrack.metadata.path)
      Logger.debug(`Use X-Accel to serve static file ${encodedURI}`)
      return res.status(204).header({ 'X-Accel-Redirect': encodedURI }).send()
    }

    // Express does not set the correct mimetype for m4b files so use our defined mimetypes if available
    const audioMimeType = getAudioMimeTypeFromExtname(Path.extname(audioTrack.metadata.path))
    if (audioMimeType) {
      res.setHeader('Content-Type', audioMimeType)
    }
    res.sendFile(audioTrack.metadata.path)
  }

  openSessionMiddleware(this: SessionContext, req: RequestWithUser & { playbackSession?: PlaybackSession }, res: Response, next: NextFunction) {
    var playbackSession = this.playbackSessionManager.getSession(req.params.id)
    if (!playbackSession) return res.sendStatus(404)

    if (playbackSession.userId !== req.user.id && !req.user.isAdminOrUp) {
      Logger.error(`[SessionController] Non-admin user "${req.user.username}" attempting to access session belonging to another user "${req.params.id}"`)
      return res.sendStatus(403)
    }

    req.playbackSession = playbackSession
    next()
  }

  async middleware(req: RequestWithUser & { playbackSession?: PlaybackSession }, res: Response, next: NextFunction) {
    const playbackSession = await Database.getPlaybackSession(req.params.id)
    if (!playbackSession) {
      Logger.error(`[SessionController] Unable to find playback session with id=${req.params.id}`)
      return res.sendStatus(404)
    }

    if (req.method == 'DELETE' && !req.user.canDelete) {
      Logger.warn(`[SessionController] User "${req.user.username}" attempted to delete without permission`)
      return res.sendStatus(403)
    } else if ((req.method == 'PATCH' || req.method == 'POST') && !req.user.canUpdate) {
      Logger.warn(`[SessionController] User "${req.user.username}" attempted to update without permission`)
      return res.sendStatus(403)
    }

    req.playbackSession = playbackSession
    next()
  }
}
export = new SessionController()
