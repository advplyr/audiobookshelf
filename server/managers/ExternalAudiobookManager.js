const axios = require('axios')
const uuidv4 = require('uuid').v4
const Logger = require('../Logger')
const Database = require('../Database')
const TaskManager = require('./TaskManager')
const BookFinder = require('../finders/BookFinder')

/** Max number of results returned for the global search box */
const SearchResultLimit = 5
/** Timeout for the request sent to the external service */
const RequestTimeout = 15000
/** A task that was not updated by the external service within this time is set as failed */
const TaskTimeout = 30 * 60 * 1000

class ExternalAudiobookManager {
  constructor() {
    /** @type {Map<string, { token: string, timeout: NodeJS.Timeout }>} taskId => callback info */
    this.pendingTasks = new Map()
  }

  /** @returns {import('../objects/settings/ServerSettings')} */
  get settings() {
    return Database.serverSettings
  }

  /** @returns {number} */
  get searchResultLimit() {
    return SearchResultLimit
  }

  /** @returns {boolean} */
  get isEnabled() {
    return !!this.settings?.externalSearchEnabled && !!this.settings?.externalSearchUrl
  }

  /**
   * Search external audiobook metadata using BookFinder.
   * Fuzzy searches are disabled to keep the global search box responsive.
   *
   * @param {string} query
   * @param {number} [limit]
   * @returns {Promise<Object[]>} raw BookFinder results with an added id and provider
   */
  async search(query, limit = SearchResultLimit) {
    if (!query || !this.isEnabled) return []

    const provider = this.settings.externalSearchProvider || 'audible'
    Logger.debug(`[ExternalAudiobookManager] Searching external audiobooks for "${query}" using provider "${provider}"`)

    const results = await BookFinder.search(null, provider, query, '', null, null, { maxFuzzySearches: 0 }).catch((error) => {
      Logger.error(`[ExternalAudiobookManager] BookFinder search failed for "${query}"`, error)
      return []
    })
    if (!Array.isArray(results)) return []

    return results.slice(0, limit).map((book, index) => {
      return {
        ...book,
        id: book.asin || book.id || `${provider}-${index}`,
        provider
      }
    })
  }

  /**
   * Auth config for the request sent to the external service
   *
   * @returns {{ headers: Object, auth: { username: string, password: string }|undefined }}
   */
  getRequestAuthConfig() {
    const headers = { 'Content-Type': 'application/json' }
    if (this.settings.externalSearchAuthType === 'bearer' && this.settings.externalSearchToken) {
      headers.Authorization = `Bearer ${this.settings.externalSearchToken}`
    } else if (this.settings.externalSearchAuthType === 'basic' && this.settings.externalSearchUsername) {
      return {
        headers,
        auth: {
          username: this.settings.externalSearchUsername,
          password: this.settings.externalSearchPassword || ''
        }
      }
    }
    return { headers, auth: undefined }
  }

  /**
   * Create a task for the user and send the request to the external service.
   * The task is only emitted to the user that started the search.
   *
   * @param {Object} book all data returned by BookFinder for the selected result
   * @param {import('../models/User')} user
   * @param {{ id: string, name: string }} library
   * @param {string} serverAddress URL of this Audiobookshelf instance
   * @returns {Promise<import('../objects/Task')>}
   */
  async requestAudiobook(book, user, library, serverAddress) {
    const taskTitleString = {
      text: 'External audiobook search',
      key: 'MessageTaskExternalSearch'
    }
    const taskDescriptionString = {
      text: `Requesting "${book.title}" from external service`,
      key: 'MessageTaskExternalSearchDescription',
      subs: [book.title]
    }
    const taskData = {
      libraryId: library.id,
      title: book.title
    }
    const task = TaskManager.createAndAddTask('external-audiobook-search', taskTitleString, taskDescriptionString, true, taskData, user.id)

    const callbackToken = uuidv4()
    const timeout = setTimeout(() => this.failTaskOnTimeout(task.id), TaskTimeout)
    if (timeout.unref) timeout.unref()
    this.pendingTasks.set(task.id, { token: callbackToken, timeout })

    const payload = {
      taskId: task.id,
      callbackUrl: `${serverAddress}/public/external-search-tasks/${task.id}`,
      callbackToken,
      serverAddress,
      user: {
        id: user.id,
        username: user.username || null
      },
      library: {
        id: library.id,
        name: library.name
      },
      book
    }

    const { headers, auth } = this.getRequestAuthConfig()
    try {
      await axios.post(this.settings.externalSearchUrl, payload, {
        headers,
        auth,
        timeout: RequestTimeout
      })
      Logger.info(`[ExternalAudiobookManager] Requested "${book.title}" from external service (task ${task.id})`)
    } catch (error) {
      Logger.error(`[ExternalAudiobookManager] Request to external service failed for "${book.title}"`, error)
      this.clearPendingTask(task.id)
      task.setFailed({
        text: 'External service could not be reached',
        key: 'MessageTaskExternalSearchServiceUnreachable'
      })
      TaskManager.taskFinished(task)
    }

    return task
  }

  /**
   * Set a task as failed when the external service did not send any update in time
   *
   * @param {string} taskId
   */
  failTaskOnTimeout(taskId) {
    const task = TaskManager.tasks.find((t) => t.id === taskId)
    this.clearPendingTask(taskId)
    if (!task) return

    Logger.warn(`[ExternalAudiobookManager] Task ${taskId} timed out waiting for the external service`)
    task.setFailed({
      text: 'External service did not respond in time',
      key: 'MessageTaskExternalSearchTimeout'
    })
    TaskManager.taskFinished(task)
  }

  /**
   * Check the callback token sent by the external service
   *
   * @param {string} taskId
   * @param {string} token
   * @returns {boolean}
   */
  isValidCallbackToken(taskId, token) {
    const pendingTask = this.pendingTasks.get(taskId)
    return !!token && pendingTask?.token === token
  }

  /**
   * Remove pending task info and stop its timeout
   *
   * @param {string} taskId
   */
  clearPendingTask(taskId) {
    const pendingTask = this.pendingTasks.get(taskId)
    if (!pendingTask) return
    clearTimeout(pendingTask.timeout)
    this.pendingTasks.delete(taskId)
  }
}

module.exports = new ExternalAudiobookManager()
