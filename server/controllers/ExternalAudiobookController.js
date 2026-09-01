const { Request, Response } = require('express')
const Logger = require('../Logger')
const Database = require('../Database')
const ExternalAudiobookManager = require('../managers/ExternalAudiobookManager')
const TaskManager = require('../managers/TaskManager')
const { getQueryParamAsString, isObject, ValidationError } = require('../utils')
const { getRequestOrigin } = require('../utils/requestUtils')

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 */

const AuthTypes = ['none', 'bearer', 'basic']

class ExternalAudiobookController {
  constructor() {}

  /**
   * GET: /api/external-audiobooks/search
   * Search external audiobooks using BookFinder
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async search(req, res) {
    if (!ExternalAudiobookManager.isEnabled) {
      return res.json([])
    }

    let searchQuery = null
    try {
      searchQuery = getQueryParamAsString(req.query, 'q', '')
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).send(error.message)
      }
      throw error
    }
    if (!searchQuery) {
      return res.json([])
    }

    const limit = Math.min(Number(req.query.limit) || ExternalAudiobookManager.searchResultLimit, ExternalAudiobookManager.searchResultLimit)
    const results = await ExternalAudiobookManager.search(searchQuery, limit)
    return res.json(results)
  }

  /**
   * POST: /api/external-audiobooks/request
   * Send the selected external audiobook to the configured external service
   * Body: { book, libraryId }
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async requestAudiobook(req, res) {
    if (!ExternalAudiobookManager.isEnabled) {
      return res.status(400).send('External audiobook search is not enabled')
    }

    const { book, libraryId } = req.body || {}
    if (!isObject(book) || !book.title) {
      return res.status(400).send('Invalid request body: book with title is required')
    }
    if (!libraryId) {
      return res.status(400).send('Invalid request body: libraryId is required')
    }
    if (!req.user.checkCanAccessLibrary(libraryId)) {
      Logger.warn(`[ExternalAudiobookController] User "${req.user.username}" attempted to search external audiobooks for library "${libraryId}" without access`)
      return res.sendStatus(403)
    }

    const library = await Database.libraryModel.findByPk(libraryId)
    if (!library) {
      return res.sendStatus(404)
    }

    const serverAddress = Database.serverSettings.externalSearchServerAddress || `${getRequestOrigin(req).origin}${global.RouterBasePath || ''}`

    const task = await ExternalAudiobookManager.requestAudiobook(book, req.user, { id: library.id, name: library.name }, serverAddress)
    return res.json(task.toJSON())
  }

  /**
   * PATCH: /public/external-search-tasks/:id
   * Update a task from the external service. Authenticated with the per task
   * callback token that was sent to the external service.
   *
   * Body: { status?: 'running'|'finished'|'failed', description?, descriptionKey?, descriptionSubs?,
   *         error?, errorKey?, errorSubs?, data? }
   *
   * @param {Request} req
   * @param {Response} res
   */
  updateTask(req, res) {
    const token = (req.get('authorization') || '').replace(/^Bearer /i, '')
    if (!ExternalAudiobookManager.isValidCallbackToken(req.params.id, token)) {
      Logger.warn(`[ExternalAudiobookController] Invalid callback token for task ${req.params.id}`)
      return res.sendStatus(401)
    }

    const task = TaskManager.tasks.find((t) => t.id === req.params.id)
    if (!task) {
      ExternalAudiobookManager.clearPendingTask(req.params.id)
      return res.sendStatus(404)
    }

    const { status = 'running', description, descriptionKey, descriptionSubs, error, errorKey, errorSubs, data } = req.body || {}
    if (!['running', 'finished', 'failed'].includes(status)) {
      return res.status(400).send('Invalid request body: status must be running, finished or failed')
    }
    if (status === 'failed' && !error && !errorKey) {
      return res.status(400).send('Invalid request body: error or errorKey is required')
    }

    if (isObject(data)) {
      task.data = { ...task.data, ...data }
    }

    const descriptionString = description || descriptionKey ? { text: description || null, key: descriptionKey || null, subs: descriptionSubs || null } : null

    Logger.info(`[ExternalAudiobookController] Updating task ${task.id} with status "${status}"`)

    if (status === 'failed') {
      if (descriptionString) task.setDescription(descriptionString)
      task.setFailed({ text: error || null, key: errorKey || null, subs: errorSubs || null })
      ExternalAudiobookManager.clearPendingTask(task.id)
      TaskManager.taskFinished(task)
    } else if (status === 'finished') {
      task.setFinished(descriptionString)
      ExternalAudiobookManager.clearPendingTask(task.id)
      TaskManager.taskFinished(task)
    } else {
      if (descriptionString) task.setDescription(descriptionString)
      TaskManager.taskUpdated(task)
    }

    return res.json(task.toJSON())
  }

  /**
   * GET: /api/external-services (admin only)
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  getSettings(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[ExternalAudiobookController] Non-admin user "${req.user.username}" attempted to get external service settings`)
      return res.sendStatus(403)
    }
    return res.json(Database.serverSettings.externalSearchSettings)
  }

  /**
   * PATCH: /api/external-services (admin only)
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async updateSettings(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[ExternalAudiobookController] Non-admin user "${req.user.username}" attempted to update external service settings`)
      return res.sendStatus(403)
    }
    const settingsUpdate = req.body
    if (!isObject(settingsUpdate)) {
      return res.status(400).send('Invalid settings update object')
    }
    if (settingsUpdate.externalSearchAuthType !== undefined && !AuthTypes.includes(settingsUpdate.externalSearchAuthType)) {
      return res.status(400).send(`Invalid externalSearchAuthType. Must be one of ${AuthTypes.join(', ')}`)
    }
    if (settingsUpdate.externalSearchEnabled && !(settingsUpdate.externalSearchUrl ?? Database.serverSettings.externalSearchUrl)) {
      return res.status(400).send('externalSearchUrl is required to enable the external audiobook search')
    }
    for (const key of ['externalSearchUrl', 'externalSearchServerAddress']) {
      if (!settingsUpdate[key]) continue
      if (!isValidHttpUrl(settingsUpdate[key])) {
        return res.status(400).send(`Invalid ${key}`)
      }
    }

    const currentSettings = Database.serverSettings.externalSearchSettings
    let hasUpdates = false
    for (const key in currentSettings) {
      if (settingsUpdate[key] === undefined) continue
      const updatedValue = key === 'externalSearchEnabled' ? !!settingsUpdate[key] : settingsUpdate[key] || null
      if (Database.serverSettings[key] !== updatedValue) {
        Database.serverSettings[key] = updatedValue
        hasUpdates = true
      }
    }

    if (hasUpdates) {
      await Database.updateServerSettings()
      Logger.info(`[ExternalAudiobookController] External service settings updated by "${req.user.username}"`)
    }

    return res.json(Database.serverSettings.externalSearchSettings)
  }
}

/**
 * @param {string} url
 * @returns {boolean}
 */
function isValidHttpUrl(url) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

module.exports = new ExternalAudiobookController()
