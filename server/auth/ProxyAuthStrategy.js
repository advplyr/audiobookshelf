const passport = require('passport')
const Database = require('../Database')
const Logger = require('../Logger')

/**
 * Custom strategy for proxy authentication
 * Reads username from configurable header set by proxy middleware
 */
class ProxyStrategy {
  constructor(verify) {
    this.name = 'proxy'
    this.verify = verify
  }

  authenticate(req, options) {
    const headerName = global.ServerSettings.authProxyHeaderName
    const ip = req.ip || req.connection?.remoteAddress || 'Unknown'
    const method = req.method
    const url = req.originalUrl || req.url

    // Log all proxy auth attempts for debugging
    Logger.debug(`[ProxyAuthStrategy] ${method} ${url} from IP ${ip}`)
    Logger.debug(`[ProxyAuthStrategy] Configured header name: ${headerName}`)

    // Log all headers for debugging (but mask sensitive ones)
    const headers = {}
    for (const [key, value] of Object.entries(req.headers)) {
      if (key.toLowerCase().includes('authorization') || key.toLowerCase().includes('cookie')) {
        headers[key] = '[MASKED]'
      } else {
        headers[key] = value
      }
    }
    Logger.debug(`[ProxyAuthStrategy] Request headers:`, headers)

    if (!headerName) {
      Logger.warn(`[ProxyAuthStrategy] Proxy header name not configured for ${method} ${url} from IP ${ip}`)
      return this.fail({ message: 'Proxy header name not configured' }, 500)
    }

    const username = req.get(headerName)
    Logger.debug(`[ProxyAuthStrategy] Header ${headerName} value: "${username}"`)

    if (!username) {
      Logger.warn(`[ProxyAuthStrategy] No ${headerName} header found for ${method} ${url} from IP ${ip}`)
      return this.fail({ message: `No ${headerName} header found` }, 401)
    }

    const verified = (err, user, info) => {
      if (err) {
        return this.error(err)
      }
      if (!user) {
        return this.fail(info, 401)
      }
      return this.success(user, info)
    }

    try {
      this.verify(req, username, verified)
    } catch (ex) {
      return this.error(ex)
    }
  }
}

/**
 * Proxy authentication strategy using configurable header
 */
class ProxyAuthStrategy {
  constructor() {
    this.name = 'proxy'
    this.strategy = null
  }

  /**
   * Get the passport strategy instance
   * @returns {ProxyStrategy}
   */
  getStrategy() {
    if (!this.strategy) {
      this.strategy = new ProxyStrategy(this.verifyUser.bind(this))
    }
    return this.strategy
  }

  /**
   * Initialize the strategy with passport
   */
  init() {
    passport.use(this.name, this.getStrategy())
  }

  /**
   * Remove the strategy from passport
   */
  unuse() {
    passport.unuse(this.name)
    this.strategy = null
  }

  /**
   * Verify user from proxy header
   * @param {import('express').Request} req
   * @param {string} username
   * @param {Function} done - Passport callback
   */
  async verifyUser(req, username, done) {
    try {
      // Normalize username (trim and lowercase, following existing pattern)
      const normalizedUsername = username.trim().toLowerCase()

      if (!normalizedUsername) {
        const headerName = global.ServerSettings.authProxyHeaderName
        this.logFailedLoginAttempt(req, username, `Empty username in ${headerName} header`)
        return done(null, false, { message: `Invalid username in ${headerName} header` })
      }

      // Look up user in database
      let user = await Database.userModel.getUserByUsername(normalizedUsername)

      if (user && !user.isActive) {
        this.logFailedLoginAttempt(req, normalizedUsername, 'User is not active')
        return done(null, false, { message: 'User account is disabled' })
      }

      if (!user) {
        this.logFailedLoginAttempt(req, normalizedUsername, 'User not found')
        return done(null, false, { message: 'User not found' })
      }

      // Update user's last seen
      user.lastSeen = new Date()
      await user.save()

      this.logSuccessfulLoginAttempt(req, user.username)
      return done(null, user)

    } catch (error) {
      Logger.error(`[ProxyAuthStrategy] Authentication error:`, error)
      return done(error)
    }
  }


  /**
   * Log failed login attempt
   * @param {import('express').Request} req
   * @param {string} username
   * @param {string} reason
   */
  logFailedLoginAttempt(req, username, reason) {
    const ip = req.ip || req.connection?.remoteAddress || 'Unknown'
    Logger.warn(`[ProxyAuthStrategy] Failed login attempt for "${username}" from IP ${ip}: ${reason}`)
  }

  /**
   * Log successful login attempt
   * @param {import('express').Request} req
   * @param {string} username
   */
  logSuccessfulLoginAttempt(req, username) {
    const ip = req.ip || req.connection?.remoteAddress || 'Unknown'
    Logger.info(`[ProxyAuthStrategy] Successful proxy login for "${username}" from IP ${ip}`)
  }
}

module.exports = ProxyAuthStrategy