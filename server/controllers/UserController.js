const uuidv4 = require("uuid").v4
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')

const User = require('../objects/user/User')

const { toNumber } = require('../utils/index')

class UserController {
  constructor() { }

  async findAll(req, res) {
    if (!req.user.isAdminOrUp) return res.sendStatus(403)
    const hideRootToken = !req.user.isRoot

    const includes = (req.query.include || '').split(',').map(i => i.trim())

    // Minimal toJSONForBrowser does not include mediaProgress and bookmarks
    const allUsers = await Database.models.user.getOldUsers()
    const users = allUsers.map(u => u.toJSONForBrowser(hideRootToken, true))

    if (includes.includes('latestSession')) {
      for (const user of users) {
        const userSessions = await Database.getPlaybackSessions({ userId: user.id })
        user.latestSession = userSessions.sort((a, b) => b.updatedAt - a.updatedAt).shift() || null
      }
    }

    res.json({
      users
    })
  }

  async findOne(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error('User other than admin attempting to get user', req.user)
      return res.sendStatus(403)
    }

    res.json(this.userJsonWithItemProgressDetails(req.reqUser, !req.user.isRoot))
  }

  async create(req, res) {
    const account = req.body
    const username = account.username

    const usernameExists = await Database.models.user.getUserByUsername(username)
    if (usernameExists) {
      return res.status(500).send('Username already taken')
    }

    account.id = uuidv4()
    account.pash = await this.auth.hashPass(account.password)
    delete account.password
    account.token = await this.auth.generateAccessToken({ userId: account.id, username })
    account.createdAt = Date.now()
    const newUser = new User(account)

    const success = await Database.createUser(newUser)
    if (success) {
      SocketAuthority.adminEmitter('user_added', newUser.toJSONForBrowser())
      res.json({
        user: newUser.toJSONForBrowser()
      })
    } else {
      return res.status(500).send('Failed to save new user')
    }
  }

  async update(req, res) {
    const user = req.reqUser

    if (user.type === 'root' && !req.user.isRoot) {
      Logger.error(`[UserController] Admin user attempted to update root user`, req.user.username)
      return res.sendStatus(403)
    }

    var account = req.body
    var shouldUpdateToken = false

    if (account.username !== undefined && account.username !== user.username) {
      const usernameExists = await Database.models.user.getUserByUsername(account.username)
      if (usernameExists) {
        return res.status(500).send('Username already taken')
      }
      shouldUpdateToken = true
    }

    // Updating password
    if (account.password) {
      account.pash = await this.auth.hashPass(account.password)
      delete account.password
    }

    if (user.update(account)) {
      if (shouldUpdateToken) {
        user.token = await this.auth.generateAccessToken({ userId: user.id, username: user.username })
        Logger.info(`[UserController] User ${user.username} was generated a new api token`)
      }
      await Database.updateUser(user)
      SocketAuthority.clientEmitter(req.user.id, 'user_updated', user.toJSONForBrowser())
    }

    res.json({
      success: true,
      user: user.toJSONForBrowser()
    })
  }

  async delete(req, res) {
    if (req.params.id === 'root') {
      Logger.error('[UserController] Attempt to delete root user. Root user cannot be deleted')
      return res.sendStatus(500)
    }
    if (req.user.id === req.params.id) {
      Logger.error(`[UserController] ${req.user.username} is attempting to delete themselves... why? WHY?`)
      return res.sendStatus(500)
    }
    const user = req.reqUser

    // Todo: check if user is logged in and cancel streams

    // Remove user playlists
    const userPlaylists = await Database.models.playlist.findAll({
      where: {
        userId: user.id
      }
    })
    for (const playlist of userPlaylists) {
      await playlist.destroy()
    }

    const userJson = user.toJSONForBrowser()
    await Database.removeUser(user.id)
    SocketAuthority.adminEmitter('user_removed', userJson)
    res.json({
      success: true
    })
  }

  // GET: api/users/:id/listening-sessions
  async getListeningSessions(req, res) {
    var listeningSessions = await this.getUserListeningSessionsHelper(req.params.id)

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

    res.json(payload)
  }

  // GET: api/users/:id/listening-stats
  async getListeningStats(req, res) {
    var listeningStats = await this.getUserListeningStatsHelpers(req.params.id)
    res.json(listeningStats)
  }

  // POST: api/users/online (admin)
  async getOnlineUsers(req, res) {
    if (!req.user.isAdminOrUp) {
      return res.sendStatus(403)
    }

    res.json({
      usersOnline: SocketAuthority.getUsersOnline(),
      openSessions: this.playbackSessionManager.sessions
    })
  }

  async middleware(req, res, next) {
    if (!req.user.isAdminOrUp && req.user.id !== req.params.id) {
      return res.sendStatus(403)
    } else if ((req.method == 'PATCH' || req.method == 'POST' || req.method == 'DELETE') && !req.user.isAdminOrUp) {
      return res.sendStatus(403)
    }

    if (req.params.id) {
      req.reqUser = await Database.models.user.getUserById(req.params.id)
      if (!req.reqUser) {
        return res.sendStatus(404)
      }
    }

    next()
  }
}
module.exports = new UserController()