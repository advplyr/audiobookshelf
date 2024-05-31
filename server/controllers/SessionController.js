const Logger = require('../Logger')
const Database = require('../Database')
const { toNumber, isUUID } = require('../utils/index')

class SessionController {
  constructor() { }

  async findOne(req, res) {
    return res.json(req.playbackSession)
  }

  /**
   * GET: /api/sessions
   * @this import('../routers/ApiRouter')
   * 
   * @param {import('express').Request} req 
   * @param {import('express').Response} res 
   */
  async getAllWithUserData(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[SessionController] getAllWithUserData: Non-admin user requested all session data ${req.user.id}/"${req.user.username}"`)
      return res.sendStatus(404)
    }
    // Validate "user" query
    let userId = req.query.user
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

    let where = null
    const include = [
      {
        model: Database.models.device
      }
    ]

    if (userId) {
      where = {
        userId
      }
    } else {
      include.push({
        model: Database.userModel,
        attributes: ['id', 'username']
      })
    }

    const { rows, count } = await Database.playbackSessionModel.findAndCountAll({
      where,
      include,
      order: [
        [orderKey, orderDesc]
      ],
      limit: itemsPerPage,
      offset: itemsPerPage * page
    })

    // Map playback sessions to old playback sessions
    const sessions = rows.map(session => {
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

    const payload = {
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

  async getOpenSessions(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[SessionController] getOpenSessions: Non-admin user requested open session data ${req.user.id}/"${req.user.username}"`)
      return res.sendStatus(404)
    }

    const minifiedUserObjects = await Database.userModel.getMinifiedUserObjects()
    const openSessions = this.playbackSessionManager.sessions.map(se => {
      return {
        ...se.toJSON(),
        user: minifiedUserObjects.find(u => u.id === se.userId) || null
      }
    })

    res.json({
      sessions: openSessions
    })
  }

  async getOpenSession(req, res) {
    const libraryItem = await Database.libraryItemModel.getOldById(req.playbackSession.libraryItemId)
    const sessionForClient = req.playbackSession.toJSONForClient(libraryItem)
    res.json(sessionForClient)
  }

  // POST: api/session/:id/sync
  sync(req, res) {
    this.playbackSessionManager.syncSessionRequest(req.user, req.playbackSession, req.body, res)
  }

  // POST: api/session/:id/close
  close(req, res) {
    let syncData = req.body
    if (syncData && !Object.keys(syncData).length) syncData = null
    this.playbackSessionManager.closeSessionRequest(req.user, req.playbackSession, syncData, res)
  }

  // DELETE: api/session/:id
  async delete(req, res) {
    // if session is open then remove it
    const openSession = this.playbackSessionManager.getSession(req.playbackSession.id)
    if (openSession) {
      await this.playbackSessionManager.removeSession(req.playbackSession.id)
    }

    await Database.removePlaybackSession(req.playbackSession.id)
    res.sendStatus(200)
  }

  /**
   * POST: /api/sessions/batch/delete
   * @this import('../routers/ApiRouter')
   * 
   * @typedef batchDeleteReqBody
   * @property {string[]} sessions
   * 
   * @param {import('express').Request<{}, {}, batchDeleteReqBody, {}>} req 
   * @param {import('express').Response} res 
   */
  async batchDelete(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[SessionController] Non-admin user attempted to batch delete sessions "${req.user.username}"`)
      return res.sendStatus(403)
    }
    // Validate session ids
    if (!req.body.sessions?.length || !Array.isArray(req.body.sessions) || req.body.sessions.some(s => !isUUID(s))) {
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

  // POST: api/session/local
  syncLocal(req, res) {
    this.playbackSessionManager.syncLocalSessionRequest(req, res)
  }

  // POST: api/session/local-all
  syncLocalSessions(req, res) {
    this.playbackSessionManager.syncLocalSessionsRequest(req, res)
  }

  openSessionMiddleware(req, res, next) {
    var playbackSession = this.playbackSessionManager.getSession(req.params.id)
    if (!playbackSession) return res.sendStatus(404)

    if (playbackSession.userId !== req.user.id) {
      Logger.error(`[SessionController] User "${req.user.username}" attempting to access session belonging to another user "${req.params.id}"`)
      return res.sendStatus(404)
    }

    req.playbackSession = playbackSession
    next()
  }

  async middleware(req, res, next) {
    const playbackSession = await Database.getPlaybackSession(req.params.id)
    if (!playbackSession) {
      Logger.error(`[SessionController] Unable to find playback session with id=${req.params.id}`)
      return res.sendStatus(404)
    }

    if (req.method == 'DELETE' && !req.user.canDelete) {
      Logger.warn(`[SessionController] User attempted to delete without permission`, req.user)
      return res.sendStatus(403)
    } else if ((req.method == 'PATCH' || req.method == 'POST') && !req.user.canUpdate) {
      Logger.warn('[SessionController] User attempted to update without permission', req.user.username)
      return res.sendStatus(403)
    }

    req.playbackSession = playbackSession
    next()
  }
}
module.exports = new SessionController()