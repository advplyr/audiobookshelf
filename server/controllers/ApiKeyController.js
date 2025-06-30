const { Request, Response, NextFunction } = require('express')
const uuidv4 = require('uuid').v4
const Logger = require('../Logger')
const Database = require('../Database')

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 */

class ApiKeyController {
  constructor() {}

  /**
   * GET: /api/api-keys
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getAll(req, res) {
    const apiKeys = await Database.apiKeyModel.findAll()

    return res.json({
      apiKeys: apiKeys.map((a) => a.toJSON())
    })
  }

  /**
   * POST: /api/api-keys
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async create(req, res) {
    if (!req.body.name || typeof req.body.name !== 'string') {
      Logger.warn(`[ApiKeyController] create: Invalid name: ${req.body.name}`)
      return res.sendStatus(400)
    }
    if (req.body.expiresIn && (typeof req.body.expiresIn !== 'number' || req.body.expiresIn <= 0)) {
      Logger.warn(`[ApiKeyController] create: Invalid expiresIn: ${req.body.expiresIn}`)
      return res.sendStatus(400)
    }

    const keyId = uuidv4() // Generate key id ahead of time to use in JWT

    const permissions = Database.apiKeyModel.mergePermissionsWithDefault(req.body.permissions)
    const apiKey = await Database.apiKeyModel.generateApiKey(keyId, req.body.name, req.body.expiresIn)

    if (!apiKey) {
      Logger.error(`[ApiKeyController] create: Error generating API key`)
      return res.sendStatus(500)
    }

    // Calculate expiration time for the api key
    const expiresAt = req.body.expiresIn ? new Date(Date.now() + req.body.expiresIn * 1000) : null

    const apiKeyInstance = await Database.apiKeyModel.create({
      id: keyId,
      name: req.body.name,
      expiresAt,
      permissions,
      userId: req.user.id,
      isActive: !!req.body.isActive
    })

    Logger.info(`[ApiKeyController] Created API key "${apiKeyInstance.name}"`)
    return res.json({
      apiKey: {
        apiKey, // Actual key only shown to user on creation
        ...apiKeyInstance.toJSON()
      }
    })
  }

  /**
   * PATCH: /api/api-keys/:id
   * Only isActive and permissions can be updated because name and expiresIn are in the JWT
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async update(req, res) {
    const apiKey = await Database.apiKeyModel.findByPk(req.params.id)
    if (!apiKey) {
      return res.sendStatus(404)
    }

    if (req.body.isActive !== undefined) {
      if (typeof req.body.isActive !== 'boolean') {
        return res.sendStatus(400)
      }

      apiKey.isActive = req.body.isActive
    }

    if (req.body.permissions && Object.keys(req.body.permissions).length > 0) {
      const permissions = Database.apiKeyModel.mergePermissionsWithDefault(req.body.permissions)
      apiKey.permissions = permissions
    }

    await apiKey.save()

    Logger.info(`[ApiKeyController] Updated API key "${apiKey.name}"`)

    return res.json({
      apiKey: apiKey.toJSON()
    })
  }

  /**
   * DELETE: /api/api-keys/:id
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async delete(req, res) {
    const apiKey = await Database.apiKeyModel.findByPk(req.params.id)
    if (!apiKey) {
      return res.sendStatus(404)
    }

    await apiKey.destroy()
    Logger.info(`[ApiKeyController] Deleted API key "${apiKey.name}"`)

    return res.sendStatus(200)
  }

  /**
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   * @param {NextFunction} next
   */
  middleware(req, res, next) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[ApiKeyController] Non-admin user "${req.user.username}" attempting to access api keys`)
      return res.sendStatus(403)
    }

    next()
  }
}

module.exports = new ApiKeyController()
