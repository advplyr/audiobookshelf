const { rateLimit, RateLimitRequestHandler } = require('express-rate-limit')
const Logger = require('../Logger')

/**
 * Factory for creating authentication rate limiters
 */
class RateLimiterFactory {
  static DEFAULT_WINDOW_MS = 10 * 60 * 1000 // 10 minutes
  static DEFAULT_MAX = 40 // 40 attempts
  static LOCAL_LOGIN_KEY = 'local-login'
  static UNKNOWN_USER_KEY = 'unknown-user'

  constructor() {
    this.authRateLimiter = null
    this.passwordChangeRateLimiter = null
    this.disabledLimiter = null
  }

  /**
   * Shared window, max, and message. Null when rate limiting is disabled.
   * @returns {{ windowMs: number, max: number, message: string } | null}
   */
  getLimiterConfig() {
    // Disable by setting max to 0
    if (process.env.RATE_LIMIT_AUTH_MAX === '0') {
      return null
    }

    let windowMs = RateLimiterFactory.DEFAULT_WINDOW_MS
    if (parseInt(process.env.RATE_LIMIT_AUTH_WINDOW) > 0) {
      windowMs = parseInt(process.env.RATE_LIMIT_AUTH_WINDOW)
    }

    let max = RateLimiterFactory.DEFAULT_MAX
    if (parseInt(process.env.RATE_LIMIT_AUTH_MAX) > 0) {
      max = parseInt(process.env.RATE_LIMIT_AUTH_MAX)
    }

    let message = 'Too many authentication requests'
    if (process.env.RATE_LIMIT_AUTH_MESSAGE) {
      message = process.env.RATE_LIMIT_AUTH_MESSAGE
    }

    return { windowMs, max, message }
  }

  /**
   * Log non-default limiter settings once per process.
   * @param {{ windowMs: number, max: number }} config
   */
  logCustomLimiterConfig(config) {
    if (this.loggedCustomConfig) return
    this.loggedCustomConfig = true

    if (config.windowMs !== RateLimiterFactory.DEFAULT_WINDOW_MS) {
      Logger.info(`[RateLimiterFactory] Authentication rate limiting window set to ${config.windowMs}ms by ENV variable`)
    }
    if (config.max !== RateLimiterFactory.DEFAULT_MAX) {
      Logger.info(`[RateLimiterFactory] Authentication rate limiting max set to ${config.max} by ENV variable`)
    }
  }

  /**
   * @returns {RateLimitRequestHandler}
   */
  getDisabledLimiter() {
    if (!this.disabledLimiter) {
      this.disabledLimiter = (req, res, next) => next()
    }
    return this.disabledLimiter
  }

  /**
   * @param {{ windowMs: number, max: number, message: string }} config
   * @param {(req: import('express').Request) => string} keyGenerator
   * @returns {RateLimitRequestHandler}
   */
  createLimiter(config, keyGenerator) {
    return rateLimit({
      windowMs: config.windowMs,
      max: config.max,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator,
      skipSuccessfulRequests: true,
      handler: (req, res) => {
        const userAgent = req.get('User-Agent') || 'Unknown'
        const endpoint = req.path
        const method = req.method
        const userId = req.user?.id
        const userLabel = userId ? `, User: ${userId}` : ''

        Logger.warn(`[RateLimiter] Rate limit exceeded - Endpoint: ${method} ${endpoint}${userLabel}, User-Agent: ${userAgent}`)

        res.status(429).json({
          error: config.message
        })
      }
    })
  }

  /**
   * Get the authentication rate limiter
   * @returns {RateLimitRequestHandler}
   */
  getAuthRateLimiter() {
    if (this.authRateLimiter) {
      return this.authRateLimiter
    }

    const config = this.getLimiterConfig()
    if (!config) {
      Logger.info(`[RateLimiterFactory] Authentication rate limiting disabled by ENV variable`)
      this.authRateLimiter = this.getDisabledLimiter()
      return this.authRateLimiter
    }

    this.logCustomLimiterConfig(config)

    // One process-wide bucket of failed local logins. Do not key on client IP headers.
    this.authRateLimiter = this.createLimiter(config, () => RateLimiterFactory.LOCAL_LOGIN_KEY)

    Logger.debug(`[RateLimiterFactory] Created auth rate limiter: ${config.max} failed attempts per ${config.windowMs / 1000 / 60} minutes`)

    return this.authRateLimiter
  }

  /**
   * Failed current-password checks on PATCH /me/password, keyed by the authenticated user.
   * @returns {RateLimitRequestHandler}
   */
  getPasswordChangeRateLimiter() {
    if (this.passwordChangeRateLimiter) {
      return this.passwordChangeRateLimiter
    }

    const config = this.getLimiterConfig()
    if (!config) {
      this.passwordChangeRateLimiter = this.getDisabledLimiter()
      return this.passwordChangeRateLimiter
    }

    this.logCustomLimiterConfig(config)

    this.passwordChangeRateLimiter = this.createLimiter(config, (req) => {
      const userId = req.user?.id
      return userId ? String(userId) : RateLimiterFactory.UNKNOWN_USER_KEY
    })

    Logger.debug(`[RateLimiterFactory] Created password change rate limiter: ${config.max} failed attempts per ${config.windowMs / 1000 / 60} minutes`)

    return this.passwordChangeRateLimiter
  }
}

module.exports = new RateLimiterFactory()
