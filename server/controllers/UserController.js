const Logger = require('../Logger')
const User = require('../objects/user/User')

const { getId, toNumber } = require('../utils/index')

class UserController {
  constructor() { }

  findAll(req, res) {
    if (!req.user.isAdminOrUp) return res.sendStatus(403)
    const hideRootToken = !req.user.isRoot
    var users = this.db.users.map(u => this.userJsonWithItemProgressDetails(u, hideRootToken))
    res.json(users)
  }

  findOne(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error('User other than admin attempting to get user', req.user)
      return res.sendStatus(403)
    }

    var user = this.db.users.find(u => u.id === req.params.id)
    if (!user) {
      return res.sendStatus(404)
    }

    res.json(this.userJsonWithItemProgressDetails(user, !req.user.isRoot))
  }

  async create(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.warn('Non-admin user attempted to create user', req.user)
      return res.sendStatus(403)
    }
    var account = req.body

    var username = account.username
    var usernameExists = this.db.users.find(u => u.username.toLowerCase() === username.toLowerCase())
    if (usernameExists) {
      return res.status(500).send('Username already taken')
    }

    account.id = getId('usr')
    account.pash = await this.auth.hashPass(account.password)
    delete account.password
    account.token = await this.auth.generateAccessToken({ userId: account.id, username })
    account.createdAt = Date.now()
    var newUser = new User(account)
    var success = await this.db.insertEntity('user', newUser)
    if (success) {
      this.clientEmitter(req.user.id, 'user_added', newUser)
      res.json({
        user: newUser.toJSONForBrowser()
      })
    } else {
      return res.status(500).send('Failed to save new user')
    }
  }

  async update(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error('[UserController] User other than admin attempting to update user', req.user)
      return res.sendStatus(403)
    }

    var user = this.db.users.find(u => u.id === req.params.id)
    if (!user) {
      return res.sendStatus(404)
    }

    if (user.type === 'root' && !req.user.isRoot) {
      Logger.error(`[UserController] Admin user attempted to update root user`, req.user.username)
      return res.sendStatus(403)
    }

    var account = req.body
    var shouldUpdateToken = false

    if (account.username !== undefined && account.username !== user.username) {
      var usernameExists = this.db.users.find(u => u.username.toLowerCase() === account.username.toLowerCase())
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

    var hasUpdated = user.update(account)
    if (hasUpdated) {
      if (shouldUpdateToken) {
        user.token = await this.auth.generateAccessToken({ userId: user.id, username: user.username })
        Logger.info(`[UserController] User ${user.username} was generated a new api token`)
      }
      await this.db.updateEntity('user', user)
    }

    this.clientEmitter(req.user.id, 'user_updated', user.toJSONForBrowser())
    res.json({
      success: true,
      user: user.toJSONForBrowser()
    })
  }

  async delete(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error('User other than admin attempting to delete user', req.user)
      return res.sendStatus(403)
    }
    if (req.params.id === 'root') {
      return res.sendStatus(500)
    }
    if (req.user.id === req.params.id) {
      Logger.error('Attempting to delete themselves...')
      return res.sendStatus(500)
    }
    var user = this.db.users.find(u => u.id === req.params.id)
    if (!user) {
      Logger.error('User not found')
      return res.json({
        error: 'User not found'
      })
    }

    // delete user collections
    var userCollections = this.db.collections.filter(c => c.userId === user.id)
    var collectionsToRemove = userCollections.map(uc => uc.id)
    for (let i = 0; i < collectionsToRemove.length; i++) {
      await this.db.removeEntity('collection', collectionsToRemove[i])
    }

    // Todo: check if user is logged in and cancel streams

    var userJson = user.toJSONForBrowser()
    await this.db.removeEntity('user', user.id)
    this.clientEmitter(req.user.id, 'user_removed', userJson)
    res.json({
      success: true
    })
  }

  // GET: api/users/:id/listening-sessions
  async getListeningSessions(req, res) {
    if (!req.user.isAdminOrUp && req.user.id !== req.params.id) {
      return res.sendStatus(403)
    }

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
    if (!req.user.isAdminOrUp && req.user.id !== req.params.id) {
      return res.sendStatus(403)
    }
    var listeningStats = await this.getUserListeningStatsHelpers(req.params.id)
    res.json(listeningStats)
  }
}
module.exports = new UserController()