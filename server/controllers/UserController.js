const { Request, Response, NextFunction } = require('express')
const uuidv4 = require('uuid').v4
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')

const { toNumber } = require('../utils/index')

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 *
 * @typedef RequestEntityObject
 * @property {import('../models/User')} reqUser
 *
 * @typedef {RequestWithUser & RequestEntityObject} UserControllerRequest
 */

class UserController {
  constructor() {}

  /**
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async findAll(req, res) {
    if (!req.user.isAdminOrUp) return res.sendStatus(403)
    const hideRootToken = !req.user.isRoot

    const includes = (req.query.include || '').split(',').map((i) => i.trim())

    // Minimal toJSONForBrowser does not include mediaProgress and bookmarks
    const allUsers = await Database.userModel.findAll()
    const users = allUsers.map((u) => u.toOldJSONForBrowser(hideRootToken, true))

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

  /**
   * GET: /api/users/:id
   * Get a single user toJSONForBrowser
   * Media progress items include: `displayTitle`, `displaySubtitle` (for podcasts), `coverPath` and `mediaUpdatedAt`
   *
   * @param {UserControllerRequest} req
   * @param {Response} res
   */
  async findOne(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`Non-admin user "${req.user.username}" attempted to get user`)
      return res.sendStatus(403)
    }

    // Get user media progress with associated mediaItem
    const mediaProgresses = await Database.mediaProgressModel.findAll({
      where: {
        userId: req.reqUser.id
      },
      include: [
        {
          model: Database.bookModel,
          attributes: ['id', 'title', 'coverPath', 'updatedAt']
        },
        {
          model: Database.podcastEpisodeModel,
          attributes: ['id', 'title'],
          include: {
            model: Database.podcastModel,
            attributes: ['id', 'title', 'coverPath', 'updatedAt']
          }
        }
      ]
    })

    const oldMediaProgresses = mediaProgresses.map((mp) => {
      const oldMediaProgress = mp.getOldMediaProgress()
      oldMediaProgress.displayTitle = mp.mediaItem?.title
      if (mp.mediaItem?.podcast) {
        oldMediaProgress.displaySubtitle = mp.mediaItem.podcast?.title
        oldMediaProgress.coverPath = mp.mediaItem.podcast?.coverPath
        oldMediaProgress.mediaUpdatedAt = mp.mediaItem.podcast?.updatedAt
      } else if (mp.mediaItem) {
        oldMediaProgress.coverPath = mp.mediaItem.coverPath
        oldMediaProgress.mediaUpdatedAt = mp.mediaItem.updatedAt
      }
      return oldMediaProgress
    })

    const userJson = req.reqUser.toOldJSONForBrowser(!req.user.isRoot)

    userJson.mediaProgress = oldMediaProgresses

    res.json(userJson)
  }

  /**
   * POST: /api/users
   * Create a new user
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async create(req, res) {
    if (!req.body.username || !req.body.password || typeof req.body.username !== 'string' || typeof req.body.password !== 'string') {
      return res.status(400).send('Username and password are required')
    }
    if (req.body.type && !Database.userModel.accountTypes.includes(req.body.type)) {
      return res.status(400).send('Invalid account type')
    }

    const usernameExists = await Database.userModel.checkUserExistsWithUsername(req.body.username)
    if (usernameExists) {
      return res.status(400).send('Username already taken')
    }

    const userId = uuidv4()
    const pash = await this.auth.localAuthStrategy.hashPassword(req.body.password)
    const token = this.auth.generateAccessToken({ id: userId, username: req.body.username })
    const userType = req.body.type || 'user'

    // librariesAccessible and itemTagsSelected can be on req.body or req.body.permissions
    // Old model stored them outside of permissions, new model stores them inside permissions
    let reqLibrariesAccessible = req.body.librariesAccessible || req.body.permissions?.librariesAccessible
    if (reqLibrariesAccessible && (!Array.isArray(reqLibrariesAccessible) || reqLibrariesAccessible.some((libId) => typeof libId !== 'string'))) {
      Logger.warn(`[UserController] create: Invalid librariesAccessible value: ${reqLibrariesAccessible}`)
      reqLibrariesAccessible = null
    }
    let reqItemTagsSelected = req.body.itemTagsSelected || req.body.permissions?.itemTagsSelected
    if (reqItemTagsSelected && (!Array.isArray(reqItemTagsSelected) || reqItemTagsSelected.some((tagId) => typeof tagId !== 'string'))) {
      Logger.warn(`[UserController] create: Invalid itemTagsSelected value: ${reqItemTagsSelected}`)
      reqItemTagsSelected = null
    }
    if (req.body.permissions?.itemTagsSelected || req.body.permissions?.librariesAccessible) {
      delete req.body.permissions.itemTagsSelected
      delete req.body.permissions.librariesAccessible
    }

    // Map permissions
    const permissions = Database.userModel.getDefaultPermissionsForUserType(userType)
    if (req.body.permissions && typeof req.body.permissions === 'object') {
      for (const key in req.body.permissions) {
        if (permissions[key] !== undefined) {
          if (typeof req.body.permissions[key] !== 'boolean') {
            Logger.warn(`[UserController] create: Invalid permission value for key ${key}. Should be boolean`)
          } else {
            permissions[key] = req.body.permissions[key]
          }
        } else {
          Logger.warn(`[UserController] create: Invalid permission key: ${key}`)
        }
      }
    }

    permissions.itemTagsSelected = reqItemTagsSelected || []
    permissions.librariesAccessible = reqLibrariesAccessible || []

    const newUser = {
      id: userId,
      type: userType,
      username: req.body.username,
      email: typeof req.body.email === 'string' ? req.body.email : null,
      pash,
      token,
      isActive: !!req.body.isActive,
      permissions,
      bookmarks: [],
      extraData: {
        seriesHideFromContinueListening: []
      }
    }

    const user = await Database.userModel.create(newUser)
    if (user) {
      SocketAuthority.adminEmitter('user_added', user.toOldJSONForBrowser())
      res.json({
        user: user.toOldJSONForBrowser()
      })
    } else {
      return res.status(500).send('Failed to save new user')
    }
  }

  /**
   * PATCH: /api/users/:id
   * Update user
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {UserControllerRequest} req
   * @param {Response} res
   */
  async update(req, res) {
    const user = req.reqUser

    if (user.isRoot && !req.user.isRoot) {
      Logger.error(`[UserController] Admin user "${req.user.username}" attempted to update root user`)
      return res.sendStatus(403)
    } else if (user.isRoot) {
      // Root user cannot update type
      delete req.body.type
    }

    const updatePayload = req.body

    // Validate payload
    const keysThatCannotBeUpdated = ['id', 'pash', 'token', 'extraData', 'bookmarks']
    for (const key of keysThatCannotBeUpdated) {
      if (updatePayload[key] !== undefined) {
        return res.status(400).send(`Key "${key}" cannot be updated`)
      }
    }
    if (updatePayload.email && typeof updatePayload.email !== 'string') {
      return res.status(400).send('Invalid email')
    }
    if (updatePayload.username && typeof updatePayload.username !== 'string') {
      return res.status(400).send('Invalid username')
    }
    if (updatePayload.type && !Database.userModel.accountTypes.includes(updatePayload.type)) {
      return res.status(400).send('Invalid account type')
    }
    if (updatePayload.permissions && typeof updatePayload.permissions !== 'object') {
      return res.status(400).send('Invalid permissions')
    }

    let hasUpdates = false
    let shouldUpdateToken = false
    let shouldInvalidateJwtSessions = false
    // When changing username create a new API token
    if (updatePayload.username && updatePayload.username !== user.username) {
      const usernameExists = await Database.userModel.checkUserExistsWithUsername(updatePayload.username)
      if (usernameExists) {
        return res.status(400).send('Username already taken')
      }
      user.username = updatePayload.username
      shouldUpdateToken = true
      shouldInvalidateJwtSessions = true
      hasUpdates = true
    }

    // Updating password
    if (updatePayload.password) {
      user.pash = await this.auth.localAuthStrategy.hashPassword(updatePayload.password)
      hasUpdates = true
    }

    let hasPermissionsUpdates = false
    let updateLibrariesAccessible = updatePayload.librariesAccessible || updatePayload.permissions?.librariesAccessible
    if (updateLibrariesAccessible && (!Array.isArray(updateLibrariesAccessible) || updateLibrariesAccessible.some((libId) => typeof libId !== 'string'))) {
      Logger.warn(`[UserController] update: Invalid librariesAccessible value: ${updateLibrariesAccessible}`)
      updateLibrariesAccessible = null
    }
    let updateItemTagsSelected = updatePayload.itemTagsSelected || updatePayload.permissions?.itemTagsSelected
    if (updateItemTagsSelected && (!Array.isArray(updateItemTagsSelected) || updateItemTagsSelected.some((tagId) => typeof tagId !== 'string'))) {
      Logger.warn(`[UserController] update: Invalid itemTagsSelected value: ${updateItemTagsSelected}`)
      updateItemTagsSelected = null
    }
    if (updatePayload.permissions?.itemTagsSelected || updatePayload.permissions?.librariesAccessible) {
      delete updatePayload.permissions.itemTagsSelected
      delete updatePayload.permissions.librariesAccessible
    }
    if (updatePayload.permissions && typeof updatePayload.permissions === 'object') {
      const permissions = {
        ...user.permissions
      }
      const defaultPermissions = Database.userModel.getDefaultPermissionsForUserType(updatePayload.type || user.type || 'user')
      for (const key in updatePayload.permissions) {
        // Check that the key is a valid permission key or is included in the default permissions
        if (permissions[key] !== undefined || defaultPermissions[key] !== undefined) {
          if (typeof updatePayload.permissions[key] !== 'boolean') {
            Logger.warn(`[UserController] update: Invalid permission value for key ${key}. Should be boolean`)
          } else if (permissions[key] !== updatePayload.permissions[key]) {
            permissions[key] = updatePayload.permissions[key]
            hasPermissionsUpdates = true
          }
        } else {
          Logger.warn(`[UserController] update: Invalid permission key: ${key}`)
        }
      }

      if (updateItemTagsSelected && updateItemTagsSelected.join(',') !== user.permissions.itemTagsSelected.join(',')) {
        permissions.itemTagsSelected = updateItemTagsSelected
        hasPermissionsUpdates = true
      }
      if (updateLibrariesAccessible && updateLibrariesAccessible.join(',') !== user.permissions.librariesAccessible.join(',')) {
        permissions.librariesAccessible = updateLibrariesAccessible
        hasPermissionsUpdates = true
      }
      updatePayload.permissions = permissions
    }

    // Permissions were updated
    if (hasPermissionsUpdates) {
      user.permissions = updatePayload.permissions
      user.changed('permissions', true)
      hasUpdates = true
    }

    if (updatePayload.email && updatePayload.email !== user.email) {
      user.email = updatePayload.email
      hasUpdates = true
    }
    if (updatePayload.type && updatePayload.type !== user.type) {
      user.type = updatePayload.type
      hasUpdates = true
    }
    if (updatePayload.isActive !== undefined && !!updatePayload.isActive !== user.isActive) {
      user.isActive = updatePayload.isActive
      hasUpdates = true
    }
    if (updatePayload.lastSeen && typeof updatePayload.lastSeen === 'number') {
      user.lastSeen = updatePayload.lastSeen
      hasUpdates = true
    }

    if (hasUpdates) {
      if (shouldUpdateToken) {
        user.token = this.auth.generateAccessToken(user)
        Logger.info(`[UserController] User ${user.username} has generated a new api token`)
      }

      // Handle JWT session invalidation for username changes
      if (shouldInvalidateJwtSessions) {
        const newAccessToken = await this.auth.invalidateJwtSessionsForUser(user, req, res)
        if (newAccessToken) {
          user.accessToken = newAccessToken
          // Refresh tokens are only returned for mobile clients
          // Mobile apps currently do not use this API endpoint so always set to null
          user.refreshToken = null
          Logger.info(`[UserController] Invalidated JWT sessions for user ${user.username} and rotated tokens for current session`)
        } else {
          Logger.info(`[UserController] Invalidated JWT sessions for user ${user.username}`)
        }
      }

      await user.save()
      SocketAuthority.clientEmitter(req.user.id, 'user_updated', user.toOldJSONForBrowser())
    }

    res.json({
      success: true,
      user: user.toOldJSONForBrowser()
    })
  }

  /**
   * DELETE: /api/users/:id
   * Delete a user
   *
   * @param {UserControllerRequest} req
   * @param {Response} res
   */
  async delete(req, res) {
    if (req.params.id === 'root') {
      Logger.error('[UserController] Attempt to delete root user. Root user cannot be deleted')
      return res.sendStatus(400)
    }
    if (req.user.id === req.params.id) {
      Logger.error(`[UserController] User ${req.user.username} is attempting to delete self`)
      return res.sendStatus(400)
    }
    const user = req.reqUser

    // Todo: check if user is logged in and cancel streams

    // Remove user playlists
    const userPlaylists = await Database.playlistModel.findAll({
      where: {
        userId: user.id
      }
    })
    for (const playlist of userPlaylists) {
      await playlist.destroy()
    }

    // Set PlaybackSessions userId to null
    const [sessionsUpdated] = await Database.playbackSessionModel.update(
      {
        userId: null
      },
      {
        where: {
          userId: user.id
        }
      }
    )
    Logger.info(`[UserController] Updated ${sessionsUpdated} playback sessions to remove user id`)

    const userJson = user.toOldJSONForBrowser()
    await user.destroy()
    SocketAuthority.adminEmitter('user_removed', userJson)
    res.json({
      success: true
    })
  }

  /**
   * PATCH: /api/users/:id/openid-unlink
   *
   * @param {UserControllerRequest} req
   * @param {Response} res
   */
  async unlinkFromOpenID(req, res) {
    Logger.debug(`[UserController] Unlinking user "${req.reqUser.username}" from OpenID with sub "${req.reqUser.authOpenIDSub}"`)

    if (!req.reqUser.authOpenIDSub) {
      return res.sendStatus(200)
    }

    req.reqUser.extraData.authOpenIDSub = null
    req.reqUser.changed('extraData', true)
    await req.reqUser.save()
    SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.reqUser.toOldJSONForBrowser())
    res.sendStatus(200)
  }

  /**
   * GET: /api/users/:id/listening-sessions
   *
   * @param {UserControllerRequest} req
   * @param {Response} res
   */
  async getListeningSessions(req, res) {
    var listeningSessions = await this.getUserListeningSessionsHelper(req.params.id)

    const itemsPerPage = toNumber(req.query.itemsPerPage, 10) || 10
    const page = toNumber(req.query.page, 0)

    const start = page * itemsPerPage
    // Map user to sessions to match the format of the sessions endpoint
    const sessions = listeningSessions.slice(start, start + itemsPerPage).map((session) => {
      return {
        ...session,
        user: {
          id: req.reqUser.id,
          username: req.reqUser.username
        }
      }
    })

    const payload = {
      total: listeningSessions.length,
      numPages: Math.ceil(listeningSessions.length / itemsPerPage),
      page,
      itemsPerPage,
      sessions
    }

    res.json(payload)
  }

  /**
   * GET: /api/users/:id/listening-stats
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {UserControllerRequest} req
   * @param {Response} res
   */
  async getListeningStats(req, res) {
    var listeningStats = await this.getUserListeningStatsHelpers(req.params.id)
    res.json(listeningStats)
  }

  /**
   * GET: /api/users/online
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getOnlineUsers(req, res) {
    if (!req.user.isAdminOrUp) {
      return res.sendStatus(403)
    }

    res.json({
      usersOnline: SocketAuthority.getUsersOnline(),
      openSessions: this.playbackSessionManager.sessions
    })
  }

  /**
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   * @param {NextFunction} next
   */
  async middleware(req, res, next) {
    if (!req.user.isAdminOrUp && req.user.id !== req.params.id) {
      return res.sendStatus(403)
    } else if ((req.method == 'PATCH' || req.method == 'POST' || req.method == 'DELETE') && !req.user.isAdminOrUp) {
      return res.sendStatus(403)
    }

    if (req.params.id) {
      req.reqUser = await Database.userModel.getUserById(req.params.id)
      if (!req.reqUser) {
        return res.sendStatus(404)
      }
    }

    next()
  }
}
module.exports = new UserController()
