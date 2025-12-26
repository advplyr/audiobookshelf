const passport = require('passport')
const Database = require('../Database')
const Logger = require('../Logger')

/**
 * Proxy authentication strategy using configurable header
 * Reads username from header set by proxy middleware
 */
class ProxyAuthStrategy {
  constructor() {
    this.name = 'proxy'
  }

  /**
   * Passport authenticate method
   * @param {import('express').Request} req
   * @param {Object} options
   */
  authenticate(req, options) {
    const headerName = global.ServerSettings.authProxyHeaderName

    if (!headerName) {
      Logger.warn(`[ProxyAuthStrategy] Proxy header name not configured`)
      return this.fail({ message: 'Proxy header name not configured' }, 500)
    }

    const username = req.get(headerName)

    if (!username) {
      Logger.warn(`[ProxyAuthStrategy] No ${headerName} header found`)
      return this.fail({ message: `No ${headerName} header found` }, 401)
    }

    let clientIp = req.ip || req.socket?.remoteAddress || 'Unknown'
    // Clean up IPv6-mapped IPv4 addresses (::ffff:192.168.1.1 -> 192.168.1.1)
    if (clientIp.startsWith('::ffff:')) {
      clientIp = clientIp.substring(7)
    }

    this.verifyUser(username)
      .then(user => {
        Logger.debug(`[ProxyAuthStrategy] Successful proxy login for "${user.username}" from IP ${clientIp}`)
        return this.success(user)
      })
      .catch(error => {
        Logger.warn(`[ProxyAuthStrategy] Failed login attempt for "${username}" from IP ${clientIp}: ${error.message}`)
        return this.fail({ message: error.message }, 401)
      })
  }

  /**
   * Initialize the strategy with passport
   */
  init() {
    passport.use(this.name, this)
  }

  /**
   * Remove the strategy from passport
   */
  unuse() {
    passport.unuse(this.name)
  }

  /**
   * Verify user from proxy header
   * @param {string} username
   * @returns {Promise<Object>} User object
   */
  async verifyUser(username) {
    const normalizedUsername = username.trim().toLowerCase()

    if (!normalizedUsername) {
      throw new Error('Empty username')
    }

    const user = await Database.userModel.getUserByUsername(normalizedUsername)

    if (!user) {
      throw new Error('User not found')
    }

    if (!user.isActive) {
      throw new Error('User account is disabled')
    }

    // Update user's last seen
    user.lastSeen = new Date()
    await user.save()

    return user
  }
}

module.exports = ProxyAuthStrategy