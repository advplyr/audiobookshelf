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
      userId: req.user.id
    })

    return res.json({
      id: apiKeyInstance.id,
      name: apiKeyInstance.name,
      apiKey,
      expiresAt: apiKeyInstance.expiresAt,
      permissions: apiKeyInstance.permissions
    })
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
