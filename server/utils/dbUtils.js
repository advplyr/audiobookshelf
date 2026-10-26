const Logger = require('../Logger')

/**
 * Retry a database operation when a SQLITE_BUSY / SequelizeTimeoutError occurs.
 * Most lock contention is transient (e.g. a concurrent ffmpeg write), so a
 * short exponential backoff is enough to let the lock clear.
 *
 * @template T
 * @param {() => Promise<T>} fn - Async function wrapping the DB operation to retry
 * @param {object} [options]
 * @param {number} [options.retries=3] - Maximum number of attempts (first try + retries)
 * @param {number} [options.baseDelayMs=200] - Initial delay in ms; doubles each attempt
 * @param {string} [options.context=''] - Label shown in log messages
 * @returns {Promise<T>}
 */
async function withRetry(fn, { retries = 3, baseDelayMs = 200, context = '' } = {}) {
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (error) {
      const isBusy = error.name === 'SequelizeTimeoutError' || error.original?.code === 'SQLITE_BUSY' || error.parent?.code === 'SQLITE_BUSY'
      if (!isBusy || attempt >= retries) {
        throw error
      }
      attempt++
      const delay = baseDelayMs * Math.pow(2, attempt - 1)
      Logger.warn(`[dbUtils] SQLITE_BUSY${context ? ' in ' + context : ''} — retry ${attempt}/${retries} after ${delay}ms`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}

module.exports = { withRetry }
