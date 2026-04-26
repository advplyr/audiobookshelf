const { Request, Response, NextFunction } = require('express')
const Logger = require('../Logger')
const Database = require('../Database')
const AudibleLibrary = require('../providers/AudibleLibrary')

const ALLOWED_REGIONS = ['us', 'ca', 'uk', 'au', 'fr', 'de', 'jp', 'it', 'in', 'es']

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 */

class AudibleController {
  constructor() {}

  /**
   * GET /api/audible/accounts
   * Returns all Audible accounts for the requesting user.
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getAccounts(req, res) {
    const accounts = await Database.audibleAccountModel.findAll({
      where: { userId: req.user.id }
    })
    res.json({ accounts: accounts.map((a) => a.toClientJson()) })
  }

  /**
   * POST /api/audible/accounts
   * Connect a new Audible account.
   *
   * Body: { email, region, accessToken, refreshToken?, deviceSerial? }
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async createAccount(req, res) {
    const { email, region, accessToken, refreshToken, deviceSerial } = req.body

    if (!email || !accessToken) {
      return res.status(400).send('email and accessToken are required')
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).send('Invalid email format')
    }

    // Whitelist region
    const normalizedRegion = region || 'us'
    if (!ALLOWED_REGIONS.includes(normalizedRegion)) {
      return res.status(400).send(`Invalid region. Allowed: ${ALLOWED_REGIONS.join(', ')}`)
    }

    const account = Database.audibleAccountModel.build({
      userId: req.user.id,
      email,
      region: normalizedRegion,
      encryptedToken: '',
      isActive: true
    })

    account.setAccessToken(JSON.stringify({ accessToken, refreshToken: refreshToken || null, deviceSerial: deviceSerial || null }))

    try {
      await account.save()
    } catch (err) {
      Logger.error('[AudibleController] Failed to save new account', err.message)
      return res.status(500).send('Failed to save account')
    }

    Logger.info(`[AudibleController] Connected Audible account ${email} for user ${req.user.id}`)
    res.json({ account: account.toClientJson() })
  }

  /**
   * PATCH /api/audible/accounts/:id
   * Update libraryId and shelfPosition settings for an account.
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async updateAccount(req, res) {
    const account = req.audibleAccount
    const { libraryId, shelfPosition } = req.body

    if (libraryId !== undefined) account.libraryId = libraryId || null
    if (shelfPosition !== undefined) account.shelfPosition = Number(shelfPosition) || 0

    try {
      await account.save()
    } catch (err) {
      Logger.error('[AudibleController] Failed to update account settings', err.message)
      return res.status(500).send('Failed to save settings')
    }

    res.json({ account: account.toClientJson() })
  }

  /**
   * DELETE /api/audible/accounts/:id
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async deleteAccount(req, res) {
    const account = req.audibleAccount

    await Database.audibleBookModel.destroy({
      where: { audibleAccountId: account.id }
    })
    await account.destroy()

    Logger.info(`[AudibleController] Removed Audible account ${account.id}`)
    res.sendStatus(200)
  }

  /**
   * POST /api/audible/accounts/:id/sync
   * Fetch preorders from Audible and replace stored books atomically.
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async syncAccount(req, res) {
    const account = req.audibleAccount

    let tokenData
    try {
      tokenData = JSON.parse(account.getAccessToken() || '{}')
    } catch {
      return res.status(400).send('Invalid stored token — reconnect the account')
    }

    let { accessToken, refreshToken, deviceSerial } = tokenData

    if (!accessToken) {
      return res.status(400).send('No access token stored — reconnect the account')
    }

    // Helper: call fetchPreordersFromOrders with automatic token refresh on 401/403
    const fetchWithRefresh = async () => {
      try {
        return await AudibleLibrary.fetchPreordersFromOrders(accessToken, account.region)
      } catch (err) {
        if (err.message === 'UNAUTHORIZED' && refreshToken) {
          Logger.info(`[AudibleController] Access token expired for account ${account.id}, refreshing`)
          let refreshed
          try {
            refreshed = await AudibleLibrary.refreshAccessToken(refreshToken)
          } catch (refreshErr) {
            Logger.error(`[AudibleController] Refresh request threw for account ${account.id}`, refreshErr.message)
            throw new Error('SESSION_EXPIRED')
          }
          if (!refreshed?.accessToken) throw new Error('SESSION_EXPIRED')
          Logger.info(`[AudibleController] Token refreshed for account ${account.id}`)
          accessToken = refreshed.accessToken
          account.setAccessToken(JSON.stringify({ accessToken, refreshToken, deviceSerial }))
          try {
            await account.save()
          } catch (saveErr) {
            Logger.error('[AudibleController] Failed to persist refreshed token', saveErr.message)
          }
          return await AudibleLibrary.fetchPreordersFromOrders(accessToken, account.region)
        }
        throw err
      }
    }

    Logger.info(`[AudibleController] Syncing account ${account.id}`)
    let rawItems
    try {
      rawItems = await fetchWithRefresh()
    } catch (err) {
      if (err.message === 'SESSION_EXPIRED') return res.status(401).send('Session expired — reconnect the account')
      Logger.error('[AudibleController] Orders API sync failed', err.message)
      return res.status(err.message === 'UNAUTHORIZED' ? 401 : 500).send('Sync failed')
    }

    // Atomically replace all stored preorders in a single transaction.
    // lastSync is updated inside the transaction so it only reflects a complete sync.
    const transaction = await Database.sequelize.transaction()
    let synced = 0
    try {
      await Database.audibleBookModel.destroy({ where: { audibleAccountId: account.id }, transaction })

      const records = rawItems.map((raw) => ({ ...AudibleLibrary.mapItem(raw), audibleAccountId: account.id }))
      if (records.length) {
        await Database.audibleBookModel.bulkCreate(records, { transaction, ignoreDuplicates: true })
        synced = records.length
      }

      account.lastSync = new Date()
      await account.save({ transaction })
      await transaction.commit()
    } catch (err) {
      await transaction.rollback()
      Logger.error(`[AudibleController] Sync transaction failed for account ${account.id}`, err.message)
      return res.status(500).send('Sync failed — database error')
    }

    Logger.info(`[AudibleController] Synced ${synced} preorder(s) for account ${account.id}`)
    res.json({ synced })
  }

  /**
   * GET /api/audible/preorders
   * Return all preorder books for the requesting user across all their accounts.
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getPreorders(req, res) {
    const accounts = await Database.audibleAccountModel.findAll({
      where: { userId: req.user.id, isActive: true }
    })

    if (!accounts.length) {
      return res.json({ preorders: [] })
    }

    const accountIds = accounts.map((a) => a.id)
    const books = await Database.audibleBookModel.findAll({
      where: {
        audibleAccountId: accountIds,
        status: 'preorder'
      }
    })

    res.json({ preorders: books.map((b) => b.toClientJson()) })
  }

  /**
   * Middleware: load account by :id and verify the requesting user owns it.
   * Always returns 403 (not 404) when an account isn't found or isn't owned,
   * to prevent account ID enumeration.
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   * @param {NextFunction} next
   */
  async middleware(req, res, next) {
    if (!req.user) return res.sendStatus(401)

    if (req.params.id) {
      const account = await Database.audibleAccountModel.findByPk(req.params.id)
      // Return 403 for both "not found" and "not owned" — never leak existence via 404
      if (!account || account.userId !== req.user.id) {
        return res.sendStatus(403)
      }
      req.audibleAccount = account
    }
    next()
  }
}

module.exports = new AudibleController()
