const { Request, Response, NextFunction } = require('express')
const Logger = require('../Logger')
const Database = require('../Database')
const SocketAuthority = require('../SocketAuthority')

/**
 * Fork addition: per-user wishlist. Every route is scoped to req.user; users never
 * see each other's lists. Socket events (wishlist_item_*) go only to the owner.
 *
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 */

const STATUSES = ['wanted', 'acquired']

/**
 * Pick allowed fields from the body. Returns null if any value is the wrong type.
 *
 * @param {object} body
 * @returns {object|null}
 */
function pickEditable(body) {
  const values = {}
  for (const key of Database.wishlistItemModel.editableFields) {
    if (body[key] === undefined) continue
    if (body[key] !== null && typeof body[key] !== 'string') return null
    values[key] = body[key] === null ? null : body[key].trim()
  }
  if (values.status !== undefined && !STATUSES.includes(values.status)) return null
  // Links are rendered by clients; only allow http(s) so javascript: etc. can't slip in
  for (const key of ['url', 'coverUrl']) {
    if (values[key] && !/^https?:\/\//i.test(values[key])) return null
  }
  return values
}

class WishlistController {
  constructor() {}

  /**
   * GET: /api/wishlist
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getAll(req, res) {
    const items = await Database.wishlistItemModel.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']]
    })
    res.json({ wishlist: items.map((i) => i.toJSONForClient()) })
  }

  /**
   * POST: /api/wishlist
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async create(req, res) {
    const values = pickEditable(req.body || {})
    if (!values || !values.title) {
      Logger.warn(`[WishlistController] create: Invalid body`, req.body)
      return res.sendStatus(400)
    }
    const item = await Database.wishlistItemModel.create({ ...values, userId: req.user.id })
    const json = item.toJSONForClient()
    SocketAuthority.clientEmitter(req.user.id, 'wishlist_item_added', json)
    res.json(json)
  }

  /**
   * PATCH: /api/wishlist/:id
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async update(req, res) {
    const values = pickEditable(req.body || {})
    if (!values || values.title === '' || values.title === null) {
      Logger.warn(`[WishlistController] update: Invalid body`, req.body)
      return res.sendStatus(400)
    }
    await req.wishlistItem.update(values)
    const json = req.wishlistItem.toJSONForClient()
    SocketAuthority.clientEmitter(req.user.id, 'wishlist_item_updated', json)
    res.json(json)
  }

  /**
   * DELETE: /api/wishlist/:id
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async delete(req, res) {
    const id = req.wishlistItem.id
    await req.wishlistItem.destroy()
    SocketAuthority.clientEmitter(req.user.id, 'wishlist_item_removed', { id })
    res.sendStatus(200)
  }

  /**
   * Load the item for :id routes, scoped to the requesting user (404 otherwise).
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   * @param {NextFunction} next
   */
  async middleware(req, res, next) {
    if (req.params.id) {
      const item = await Database.wishlistItemModel.findOne({ where: { id: req.params.id, userId: req.user.id } })
      if (!item) return res.sendStatus(404)
      req.wishlistItem = item
    }
    next()
  }
}

module.exports = new WishlistController()
