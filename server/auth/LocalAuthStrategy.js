const passport = require('passport')
const LocalStrategy = require('../libs/passportLocal')
const Database = require('../Database')
const Logger = require('../Logger')

const bcrypt = require('../libs/bcryptjs')
const requestIp = require('../libs/requestIp')

/**
 * Local authentication strategy using username/password
 */
class LocalAuthStrategy {
  constructor() {
    this.name = 'local'
    this.strategy = null
  }

  /**
   * Get the passport strategy instance
   * @returns {LocalStrategy}
   */
  getStrategy() {
    if (!this.strategy) {
      this.strategy = new LocalStrategy({ passReqToCallback: true }, this.verifyCredentials.bind(this))
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
   * Verify user credentials
   * @param {import('express').Request} req
   * @param {string} username
   * @param {string} password
   * @param {Function} done - Passport callback
   */
  async verifyCredentials(req, username, password, done) {
    // Load the user given it's username
    const user = await Database.userModel.getUserByUsername(username.toLowerCase())

    if (!user?.isActive) {
      if (user) {
        this.logFailedLoginAttempt(req, user.username, 'User is not active')
      } else {
        this.logFailedLoginAttempt(req, username, 'User not found')
      }
      done(null, null)
      return
    }

    // Check passwordless root user
    if (user.type === 'root' && !user.pash) {
      if (password) {
        // deny login
        this.logFailedLoginAttempt(req, user.username, 'Root user has no password set')
        done(null, null)
        return
      }
      // approve login
      Logger.info(`[LocalAuth] User "${user.username}" logged in from ip ${requestIp.getClientIp(req)}`)

      done(null, user)
      return
    } else if (!user.pash) {
      this.logFailedLoginAttempt(req, user.username, 'User has no password set. Might have been created with OpenID')
      done(null, null)
      return
    }

    // Check password match
    const compare = await bcrypt.compare(password, user.pash)
    if (compare) {
      // approve login
      Logger.info(`[LocalAuth] User "${user.username}" logged in from ip ${requestIp.getClientIp(req)}`)

      done(null, user)
      return
    }

    // deny login
    this.logFailedLoginAttempt(req, user.username, 'Invalid password')
    done(null, null)
  }

  /**
   * Log failed login attempts
   * @param {import('express').Request} req
   * @param {string} username
   * @param {string} message
   */
  logFailedLoginAttempt(req, username, message) {
    if (!req || !username || !message) return
    Logger.error(`[LocalAuth] Failed login attempt for username "${username}" from ip ${requestIp.getClientIp(req)} (${message})`)
  }

  /**
   * Hash a password with bcrypt
   * @param {string} password
   * @returns {Promise<string>} hash
   */
  hashPassword(password) {
    return new Promise((resolve) => {
      bcrypt.hash(password, 8, (err, hash) => {
        if (err) {
          resolve(null)
        } else {
          resolve(hash)
        }
      })
    })
  }

  /**
   * Compare password with user's hashed password
   * @param {string} password
   * @param {import('../models/User')} user
   * @returns {Promise<boolean>}
   */
  comparePassword(password, user) {
    if (user.type === 'root' && !password && !user.pash) return true
    if (!password || !user.pash) return false
    return bcrypt.compare(password, user.pash)
  }

  /**
   * Change user password
   * @param {import('../models/User')} user
   * @param {string} password
   * @param {string} newPassword
   */
  async changePassword(user, password, newPassword) {
    // Only root can have an empty password
    if (user.type !== 'root' && !newPassword) {
      return {
        error: 'Invalid new password - Only root can have an empty password'
      }
    }

    // Check password match
    const compare = await this.comparePassword(password, user)
    if (!compare) {
      return {
        error: 'Invalid password'
      }
    }

    let pw = ''
    if (newPassword) {
      pw = await this.hashPassword(newPassword)
      if (!pw) {
        return {
          error: 'Hash failed'
        }
      }
    }

    try {
      await user.update({ pash: pw })
      Logger.info(`[LocalAuth] User "${user.username}" changed password`)
      return {
        success: true
      }
    } catch (error) {
      Logger.error(`[LocalAuth] User "${user.username}" failed to change password`, error)
      return {
        error: 'Unknown error'
      }
    }
  }
}

module.exports = LocalAuthStrategy
