const errors = {
  audiobookdb_search_only: [400, 'AudiobookDB is available for manual book search only.'],
  audiobookdb_key_required: [503, 'Set AUDIOBOOKDB_API_KEY on the server using a key from your AudiobookDB account.'],
  audiobookdb_auth: [502, 'AudiobookDB rejected the server API key. Check AUDIOBOOKDB_API_KEY.'],
  audiobookdb_timeout: [504, 'The AudiobookDB search took too long. Please try again.'],
  audiobookdb_rate_limited: [429, 'AudiobookDB request or account quota limit reached.'],
  audiobookdb_unavailable: [503, 'AudiobookDB is unavailable. Please try again later.']
}

class AudiobookDBError extends Error {
  constructor(code) {
    const [status, message] = errors[code]
    super(message)
    this.name = 'AudiobookDBError'
    this.code = code
    this.status = status
  }

  /** Classify an unexpected upstream HTTP or transport failure. */
  static fromResponse(response, code) {
    if (response?.status === 401 || response?.status === 403) return new AudiobookDBError('audiobookdb_auth')
    if (response?.status === 429) {
      const error = new AudiobookDBError('audiobookdb_rate_limited')
      const header = response.headers?.['retry-after']
      if (typeof header === 'string' && header.trim()) {
        const value = header.trim()
        if (/^\d+(\.\d+)?$/.test(value)) error.retryAfter = Math.ceil(Number(value))
        else if (!/^[+-]?[\d.]+$/.test(value)) {
          const date = Date.parse(value)
          if (Number.isFinite(date)) error.retryAfter = Math.max(0, Math.ceil((date - Date.now()) / 1000))
        }
      }
      return error
    }
    if (!response) return new AudiobookDBError(code === 'ECONNABORTED' || code === 'ETIMEDOUT' ? 'audiobookdb_timeout' : 'audiobookdb_unavailable')
    return new AudiobookDBError('audiobookdb_unavailable')
  }

  /**
   * Serialize to the provider HTTP contract: `{ error, code, retryAfter }`
   * plus a `Retry-After` header when present.
   *
   * @param {object} res - Express response
   * @returns {object}
   */
  sendResponse(res) {
    if (this.retryAfter !== undefined) res.set('Retry-After', String(this.retryAfter))
    return res.status(this.status).json({ error: this.message, code: this.code, ...(this.retryAfter !== undefined ? { retryAfter: this.retryAfter } : {}) })
  }
}

module.exports = AudiobookDBError
