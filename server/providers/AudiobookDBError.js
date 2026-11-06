class AudiobookDBError extends Error {
  constructor(code, retryAfter) {
    const messages = {
      audiobookdb_key_required: 'AudiobookDB requires an account API key. Verify your email, open your AudiobookDB profile editor (API Key), generate a key, then set AUDIOBOOKDB_API_KEY on the server.',
      audiobookdb_auth: 'AudiobookDB rejected the server API key. Check the key in AudiobookDB account settings (API Key) and update AUDIOBOOKDB_API_KEY on the server.',
      audiobookdb_rate_limited: 'AudiobookDB request or account quota limit reached.',
      audiobookdb_unavailable: 'AudiobookDB is unavailable. Please try again later.'
    }
    const validRetryAfter = Number.isFinite(retryAfter) && retryAfter >= 0
    super(messages[code] + (code === 'audiobookdb_rate_limited' ? (validRetryAfter ? ` Try again in ${retryAfter} seconds.` : ' Please try again later or check your AudiobookDB account quota.') : ''))
    this.name = 'AudiobookDBError'
    this.code = code
    this.status = code === 'audiobookdb_auth' ? 502 : code === 'audiobookdb_rate_limited' ? 429 : 503
    if (validRetryAfter) this.retryAfter = retryAfter
  }

  static fromResponse(response) {
    if (response?.status === 401 || response?.status === 403) return new AudiobookDBError('audiobookdb_auth')
    if (response?.status !== 429) return new AudiobookDBError('audiobookdb_unavailable')
    const header = response.headers?.['retry-after']
    let retryAfter
    if (typeof header === 'string' && header.trim()) {
      const value = header.trim()
      if (/^\d+(\.\d+)?$/.test(value)) retryAfter = Math.ceil(Number(value))
      else if (!/^[+-]?[\d.]+$/.test(value)) {
        const date = Date.parse(value)
        if (Number.isFinite(date)) retryAfter = Math.max(0, Math.ceil((date - Date.now()) / 1000))
      }
    }
    return new AudiobookDBError('audiobookdb_rate_limited', retryAfter)
  }

  sendResponse(res) {
    if (this.retryAfter !== undefined) res.set('Retry-After', String(this.retryAfter))
    return res.status(this.status).json({ error: this.message, code: this.code, ...(this.retryAfter !== undefined ? { retryAfter: this.retryAfter } : {}) })
  }
}

module.exports = AudiobookDBError
