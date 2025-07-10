const { rateLimit, RateLimitRequestHandler } = require('express-rate-limit')
const Logger = require('../Logger')

/**
 * Factory for creating authentication rate limiters
 */
class RateLimiterFactory {
  constructor() {
    this.authRateLimiter = null
  }

  /**
   * Get the authentication rate limiter
   * @returns {RateLimitRequestHandler}
   */
  getAuthRateLimiter() {
    if (this.authRateLimiter) {
      return this.authRateLimiter
    }

    let windowMs = 10 * 60 * 1000 // 10 minutes default
    if (parseInt(process.env.RATE_LIMIT_AUTH_WINDOW) > 0) {
      windowMs = parseInt(process.env.RATE_LIMIT_AUTH_WINDOW)
    }

    let max = 40 // 40 attempts default
    if (parseInt(process.env.RATE_LIMIT_AUTH_MAX) > 0) {
      max = parseInt(process.env.RATE_LIMIT_AUTH_MAX)
    }

    let message = 'Too many requests, please try again later.'
    if (process.env.RATE_LIMIT_AUTH_MESSAGE) {
      message = process.env.RATE_LIMIT_AUTH_MESSAGE
    }

    this.authRateLimiter = rateLimit({
      windowMs,
      max,
      message,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        const userAgent = req.get('User-Agent') || 'Unknown'
        const endpoint = req.path
        const method = req.method

        Logger.warn(`[RateLimiter] Rate limit exceeded - IP: ${req.ip}, Endpoint: ${method} ${endpoint}, User-Agent: ${userAgent}`)

        res.status(429).json({
          error: 'Too many authentication attempts, please try again later.'
        })
      }
    })

    Logger.debug(`[RateLimiterFactory] Created auth rate limiter: ${max} attempts per ${windowMs / 1000 / 60} minutes`)

    return this.authRateLimiter
  }
}

module.exports = new RateLimiterFactory()
