const Logger = require('../Logger')
const { toNumber } = require('../utils/index')

class SessionController {
  constructor() { }

  async findOne(req, res) {
    return res.json(req.session)
  }

  async getAllWithUserData(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[SessionController] getAllWithUserData: Non-admin user requested all session data ${req.user.id}/"${req.user.username}"`)
      return res.sendStatus(404)
    }

    let listeningSessions = []
    if (req.query.user) {
      listeningSessions = await this.getUserListeningSessionsHelper(req.query.user)
    } else {
      listeningSessions = await this.getAllSessionsWithUserData()
    }

    const itemsPerPage = toNumber(req.query.itemsPerPage, 10) || 10
    const page = toNumber(req.query.page, 0)

    const start = page * itemsPerPage
    const sessions = listeningSessions.slice(start, start + itemsPerPage)

    const payload = {
      total: listeningSessions.length,
      numPages: Math.ceil(listeningSessions.length / itemsPerPage),
      page,
      itemsPerPage,
      sessions
    }

    if (req.query.user) {
      payload.userFilter = req.query.user
    }

    res.json(payload)
  }

  getOpenSessions(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[SessionController] getOpenSessions: Non-admin user requested open session data ${req.user.id}/"${req.user.username}"`)
      return res.sendStatus(404)
    }

    const openSessions = this.playbackSessionManager.sessions.map(se => {
      const user = this.db.users.find(u => u.id === se.userId) || null
      return {
        ...se.toJSON(),
        user: user ? { id: user.id, username: user.username } : null
      }
    })

    res.json({
      sessions: openSessions
    })
  }

  getOpenSession(req, res) {
    var libraryItem = this.db.getLibraryItem(req.session.libraryItemId)
    var sessionForClient = req.session.toJSONForClient(libraryItem)
    res.json(sessionForClient)
  }

  // POST: api/session/:id/sync
  sync(req, res) {
    this.playbackSessionManager.syncSessionRequest(req.user, req.session, req.body, res)
  }

  // POST: api/session/:id/close
  close(req, res) {
    let syncData = req.body
    if (syncData && !Object.keys(syncData).length) syncData = null
    this.playbackSessionManager.closeSessionRequest(req.user, req.session, syncData, res)
  }

  // DELETE: api/session/:id
  async delete(req, res) {
    // if session is open then remove it
    const openSession = this.playbackSessionManager.getSession(req.session.id)
    if (openSession) {
      await this.playbackSessionManager.removeSession(req.session.id)
    }

    await this.db.removeEntity('session', req.session.id)
    res.sendStatus(200)
  }

  // POST: api/session/local
  syncLocal(req, res) {
    this.playbackSessionManager.syncLocalSessionRequest(req.user, req.body, res)
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

    req.session = playbackSession
    next()
  }

  async middleware(req, res, next) {
    const playbackSession = await this.db.getPlaybackSession(req.params.id)
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

    req.session = playbackSession
    next()
  }
}
module.exports = new SessionController()