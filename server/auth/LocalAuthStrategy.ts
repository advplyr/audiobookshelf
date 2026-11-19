import type { Request } from 'express'
import passport from 'passport'
import LocalStrategy from '../libs/passportLocal'
import Database from '../Database'
import Logger from '../Logger'
import bcryptJs from '../libs/bcryptjs'
import requestIp from '../libs/requestIp'
import type User from '../models/User'

type VerifyDone = (err: unknown, user?: User | null) => void
type LocalStrategyInstance = InstanceType<typeof LocalStrategy>

// The vendored bcrypt build is untyped JavaScript.
type BcryptApi = {
  compare(password: string, hash: string): Promise<boolean>
  hash(password: string, rounds: number, callback: (err: Error | null, hash?: string) => void): void
}

const bcrypt = bcryptJs as BcryptApi

type PasswordChangeResult = { error: string } | { success: true }

/**
 * Local authentication strategy using username/password
 */
class LocalAuthStrategy {
  name: string
  declare strategy: LocalStrategyInstance | null

  constructor() {
    this.name = 'local'
    this.strategy = null
  }

  /**
   * Get the passport strategy instance
   */
  getStrategy(): LocalStrategyInstance {
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
   */
  async verifyCredentials(req: Request, username: string, password: string, done: VerifyDone) {
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
   */
  logFailedLoginAttempt(req: Request, username: string | null, message: string) {
    if (!req || !username || !message) return
    Logger.error(`[LocalAuth] Failed login attempt for username "${username}" from ip ${requestIp.getClientIp(req)} (${message})`)
  }

  /**
   * Hash a password with bcrypt
   */
  hashPassword(password: string): Promise<string | null | undefined> {
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
   */
  comparePassword(password: string, user: User): boolean | Promise<boolean> {
    if (user.type === 'root' && !password && !user.pash) return true
    if (!password || !user.pash) return false
    return bcrypt.compare(password, user.pash)
  }

  /**
   * Change user password
   */
  async changePassword(user: User, password: string, newPassword: string): Promise<PasswordChangeResult> {
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

    let pw: string | null | undefined = ''
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

export = LocalAuthStrategy
