const Logger = require('../Logger')

class SessionController {
  constructor() { }

  async findOne(req, res) {
    return res.json(req.session)
  }

  // POST: api/session/:id/sync
  sync(req, res) {
    this.playbackSessionManager.syncSessionRequest(req.user, req.session, req.body, res)
  }

  // POST: api/session/:id/close
  close(req, res) {
    this.playbackSessionManager.closeSessionRequest(req.user, req.session, req.body, res)
  }

  middleware(req, res, next) {
    var playbackSession = this.playbackSessionManager.getSession(req.params.id)
    if (!playbackSession) return res.sendStatus(404)

    if (playbackSession.userId !== req.user.id) {
      Logger.error(`[SessionController] User "${req.user.username}" attempting to access session belonging to another user "${req.params.id}"`)
      return res.sendStatus(404)
    }

    req.session = playbackSession
    next()
  }
}
module.exports = new SessionController()