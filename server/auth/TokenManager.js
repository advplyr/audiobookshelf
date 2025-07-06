const { Op } = require('sequelize')

const Database = require('../Database')
const Logger = require('../Logger')

const requestIp = require('../libs/requestIp')
const jwt = require('../libs/jsonwebtoken')

class TokenManager {
  constructor() {
    this.RefreshTokenExpiry = parseInt(process.env.REFRESH_TOKEN_EXPIRY) || 7 * 24 * 60 * 60 // 7 days
    this.AccessTokenExpiry = parseInt(process.env.ACCESS_TOKEN_EXPIRY) || 12 * 60 * 60 // 12 hours

    if (parseInt(process.env.REFRESH_TOKEN_EXPIRY) > 0) {
      Logger.info(`[TokenManager] Refresh token expiry set from ENV variable to ${this.RefreshTokenExpiry} seconds`)
    }
    if (parseInt(process.env.ACCESS_TOKEN_EXPIRY) > 0) {
      Logger.info(`[TokenManager] Access token expiry set from ENV variable to ${this.AccessTokenExpiry} seconds`)
    }
  }

  /**
   * Generate a token which is used to encrypt/protect the jwts.
   */
  async initTokenSecret() {
    if (process.env.TOKEN_SECRET) {
      // User can supply their own token secret
      Database.serverSettings.tokenSecret = process.env.TOKEN_SECRET
    } else {
      Database.serverSettings.tokenSecret = require('crypto').randomBytes(256).toString('base64')
    }
    await Database.updateServerSettings()

    // TODO: Old method of non-expiring tokens
    // New token secret creation added in v2.1.0 so generate new API tokens for each user
    const users = await Database.userModel.findAll({
      attributes: ['id', 'username', 'token']
    })
    if (users.length) {
      for (const user of users) {
        user.token = this.generateAccessToken(user)
        await user.save({ hooks: false })
      }
    }
  }

  /**
   * Sets the refresh token cookie
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {string} refreshToken
   */
  setRefreshTokenCookie(req, res, refreshToken) {
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: req.secure || req.get('x-forwarded-proto') === 'https',
      sameSite: 'lax',
      maxAge: this.RefreshTokenExpiry * 1000,
      path: '/'
    })
  }

  /**
   * Function to validate a jwt token for a given user
   * Used to authenticate socket connections
   * TODO: Support API keys for web socket connections
   *
   * @param {string} token
   * @returns {Object} tokens data
   */
  static validateAccessToken(token) {
    try {
      return jwt.verify(token, global.ServerSettings.tokenSecret)
    } catch (err) {
      return null
    }
  }

  /**
   * Function to generate a jwt token for a given user
   * TODO: Old method with no expiration
   * @deprecated
   *
   * @param {{ id:string, username:string }} user
   * @returns {string}
   */
  generateAccessToken(user) {
    return jwt.sign({ userId: user.id, username: user.username }, global.ServerSettings.tokenSecret)
  }

  /**
   * Generate access token for a given user
   *
   * @param {{ id:string, username:string }} user
   * @returns {string}
   */
  generateTempAccessToken(user) {
    const payload = {
      userId: user.id,
      username: user.username,
      type: 'access'
    }
    const options = {
      expiresIn: this.AccessTokenExpiry
    }
    try {
      return jwt.sign(payload, global.ServerSettings.tokenSecret, options)
    } catch (error) {
      Logger.error(`[TokenManager] Error generating access token for user ${user.id}: ${error}`)
      return null
    }
  }

  /**
   * Generate refresh token for a given user
   *
   * @param {{ id:string, username:string }} user
   * @returns {string}
   */
  generateRefreshToken(user) {
    const payload = {
      userId: user.id,
      username: user.username,
      type: 'refresh'
    }
    const options = {
      expiresIn: this.RefreshTokenExpiry
    }
    try {
      return jwt.sign(payload, global.ServerSettings.tokenSecret, options)
    } catch (error) {
      Logger.error(`[TokenManager] Error generating refresh token for user ${user.id}: ${error}`)
      return null
    }
  }

  /**
   * Create tokens and session for a given user
   *
   * @param {{ id:string, username:string }} user
   * @param {import('express').Request} req
   * @returns {Promise<{ accessToken:string, refreshToken:string, session:import('../models/Session') }>}
   */
  async createTokensAndSession(user, req) {
    const ipAddress = requestIp.getClientIp(req)
    const userAgent = req.headers['user-agent']
    const accessToken = this.generateTempAccessToken(user)
    const refreshToken = this.generateRefreshToken(user)

    // Calculate expiration time for the refresh token
    const expiresAt = new Date(Date.now() + this.RefreshTokenExpiry * 1000)

    const session = await Database.sessionModel.createSession(user.id, ipAddress, userAgent, refreshToken, expiresAt)

    return {
      accessToken,
      refreshToken,
      session
    }
  }

  /**
   * Rotate tokens for a given session
   *
   * @param {import('../models/Session')} session
   * @param {import('../models/User')} user
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @returns {Promise<{ accessToken:string, refreshToken:string }>}
   */
  async rotateTokensForSession(session, user, req, res) {
    // Generate new tokens
    const newAccessToken = this.generateTempAccessToken(user)
    const newRefreshToken = this.generateRefreshToken(user)

    // Calculate new expiration time
    const newExpiresAt = new Date(Date.now() + this.RefreshTokenExpiry * 1000)

    // Update the session with the new refresh token and expiration
    session.refreshToken = newRefreshToken
    session.expiresAt = newExpiresAt
    await session.save()

    // Set new refresh token cookie
    this.setRefreshTokenCookie(req, res, newRefreshToken)

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    }
  }

  /**
   * Check if the jwt is valid
   *
   * @param {Object} jwt_payload
   * @param {Function} done - passportjs callback
   */
  async jwtAuthCheck(jwt_payload, done) {
    if (jwt_payload.type === 'api') {
      // Api key based authentication
      const apiKey = await Database.apiKeyModel.getById(jwt_payload.keyId)

      if (!apiKey?.isActive) {
        done(null, null)
        return
      }

      // Check if the api key is expired and deactivate it
      if (jwt_payload.exp && jwt_payload.exp < Date.now() / 1000) {
        done(null, null)

        apiKey.isActive = false
        await apiKey.save()
        Logger.info(`[TokenManager] API key ${apiKey.id} is expired - deactivated`)
        return
      }

      const user = await Database.userModel.getUserById(apiKey.userId)
      done(null, user)
    } else {
      // JWT based authentication

      // Check if the jwt is expired
      if (jwt_payload.exp && jwt_payload.exp < Date.now() / 1000) {
        done(null, null)
        return
      }

      // load user by id from the jwt token
      const user = await Database.userModel.getUserByIdOrOldId(jwt_payload.userId)

      if (!user?.isActive) {
        // deny login
        done(null, null)
        return
      }

      // TODO: Temporary flag to report old tokens to users
      // May be a better place for this but here means we dont have to decode the token again
      if (!jwt_payload.exp && !user.isOldToken) {
        Logger.debug(`[TokenManager] User ${user.username} is using an access token without an expiration`)
        user.isOldToken = true
      } else if (jwt_payload.exp && user.isOldToken !== undefined) {
        delete user.isOldToken
      }

      // approve login
      done(null, user)
    }
  }

  /**
   * Handle refresh token
   *
   * @param {string} refreshToken
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @returns {Promise<{ accessToken?:string, refreshToken?:string, user?:import('../models/User'), error?:string }>}
   */
  async handleRefreshToken(refreshToken, req, res) {
    try {
      // Verify the refresh token
      const decoded = jwt.verify(refreshToken, global.ServerSettings.tokenSecret)

      if (decoded.type !== 'refresh') {
        Logger.error(`[TokenManager] Failed to refresh token. Invalid token type: ${decoded.type}`)
        return {
          error: 'Invalid token type'
        }
      }

      const session = await Database.sessionModel.findOne({
        where: { refreshToken: refreshToken }
      })

      if (!session) {
        Logger.error(`[TokenManager] Failed to refresh token. Session not found for refresh token: ${refreshToken}`)
        return {
          error: 'Invalid refresh token'
        }
      }

      // Check if session is expired in database
      if (session.expiresAt < new Date()) {
        Logger.info(`[TokenManager] Session expired in database, cleaning up`)
        await session.destroy()
        return {
          error: 'Refresh token expired'
        }
      }

      const user = await Database.userModel.getUserById(decoded.userId)
      if (!user?.isActive) {
        Logger.error(`[TokenManager] Failed to refresh token. User not found or inactive for user id: ${decoded.userId}`)
        return {
          error: 'User not found or inactive'
        }
      }

      const newTokens = await this.rotateTokensForSession(session, user, req, res)
      return {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        user
      }
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        Logger.info(`[TokenManager] Refresh token expired, cleaning up session`)

        // Clean up the expired session from database
        try {
          await Database.sessionModel.destroy({
            where: { refreshToken: refreshToken }
          })
          Logger.info(`[TokenManager] Expired session cleaned up`)
        } catch (cleanupError) {
          Logger.error(`[TokenManager] Error cleaning up expired session: ${cleanupError.message}`)
        }

        return {
          error: 'Refresh token expired'
        }
      } else if (error.name === 'JsonWebTokenError') {
        Logger.error(`[TokenManager] Invalid refresh token format: ${error.message}`)
        return {
          error: 'Invalid refresh token'
        }
      } else {
        Logger.error(`[TokenManager] Refresh token error: ${error.message}`)
        return {
          error: 'Invalid refresh token'
        }
      }
    }
  }

  /**
   * Invalidate all JWT sessions for a given user
   * If user is current user and refresh token is valid, rotate tokens for the current session
   *
   * @param {import('../models/User')} user
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @returns {Promise<string>} accessToken only if user is current user and refresh token is valid
   */
  async invalidateJwtSessionsForUser(user, req, res) {
    const currentRefreshToken = req.cookies.refresh_token
    if (req.user.id === user.id && currentRefreshToken) {
      // Current user is the same as the user to invalidate sessions for
      // So rotate token for current session
      const currentSession = await Database.sessionModel.findOne({ where: { refreshToken: currentRefreshToken } })
      if (currentSession) {
        const newTokens = await this.rotateTokensForSession(currentSession, user, req, res)

        // Invalidate all sessions for the user except the current one
        await Database.sessionModel.destroy({
          where: {
            id: {
              [Op.ne]: currentSession.id
            },
            userId: user.id
          }
        })

        return newTokens.accessToken
      } else {
        Logger.error(`[TokenManager] No session found to rotate tokens for refresh token ${currentRefreshToken}`)
      }
    }

    // Current user is not the same as the user to invalidate sessions for (or no refresh token)
    // So invalidate all sessions for the user
    await Database.sessionModel.destroy({ where: { userId: user.id } })
    return null
  }
}

module.exports = TokenManager
