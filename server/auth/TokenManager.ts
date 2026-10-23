import { Op } from 'sequelize'
import type { Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { randomBytes } from 'crypto'

import Database from '../Database'
import Logger from '../Logger'
import requestIp from '../libs/requestIp'
import jwtJs from '../libs/jsonwebtoken'
import { isRequestSecure } from '../utils/requestUtils'
import type User from '../models/User'
import type Session from '../models/Session'

// The vendored jsonwebtoken build is untyped JavaScript. This names the sign and verify calls already used here.
type JwtClaims = {
  userId?: string
  username?: string
  type?: string
  keyId?: string
  exp?: number
  jti?: string
  [claim: string]: unknown
}

type JwtApi = {
  sign(payload: object, secret: string | null | undefined, options?: { expiresIn?: number }): string
  verify(token: string, secret: string | null | undefined, options?: { ignoreExpiration?: boolean }): JwtClaims
}

const jwt = jwtJs as JwtApi

const clientIp = requestIp as { getClientIp(req: Request): string | null }

// Loose claims: legacy access tokens omit type and exp, and later readers use the original decoded object.
const bearerAccessTokenSchema = z.looseObject({
  userId: z.custom((value) => !!value),
  type: z.unknown().optional()
})

const apiKeyTokenSchema = z.looseObject({
  keyId: z.custom((value) => !!value)
})

const refreshTokenSchema = z.looseObject({
  type: z.literal('refresh'),
  userId: z.custom((value) => !!value)
})

type AuthDone = (err: unknown, user?: User | null) => void

type TokenUser = { id: string; username: string | null }

type RefreshResult = { accessToken: string | null; refreshToken: string | null; user: User } | { error: string }

function envInt(value: string | undefined): number {
  return parseInt(value ?? '')
}

function errorMessage(error: unknown): string {
  const message = (error as { message?: unknown }).message
  return typeof message === 'string' ? message : String(message)
}

function errorName(error: unknown): string | undefined {
  const name = (error as { name?: unknown }).name
  return typeof name === 'string' ? name : undefined
}

function cookieValue(req: Request, name: string): unknown {
  return (req.cookies as Record<string, unknown>)[name]
}

class TokenManager {
  /** JWT secret key */
  static TokenSecret: string | null | undefined = null

  declare RefreshTokenExpiry: number
  declare AccessTokenExpiry: number
  declare RefreshTokenGracePeriod: number

  constructor() {
    /** Refresh token expiry in seconds */
    this.RefreshTokenExpiry = envInt(process.env.REFRESH_TOKEN_EXPIRY) || 30 * 24 * 60 * 60 // 30 days
    /** Access token expiry in seconds */
    this.AccessTokenExpiry = envInt(process.env.ACCESS_TOKEN_EXPIRY) || 1 * 60 * 60 // 1 hour
    /** Grace period in seconds during which a rotated (old) refresh token is still accepted */
    this.RefreshTokenGracePeriod = envInt(process.env.REFRESH_TOKEN_GRACE_PERIOD) || 10 * 60 // 10 minutes

    if (envInt(process.env.REFRESH_TOKEN_EXPIRY) > 0) {
      Logger.info(`[TokenManager] Refresh token expiry set from ENV variable to ${this.RefreshTokenExpiry} seconds`)
    }
    if (envInt(process.env.ACCESS_TOKEN_EXPIRY) > 0) {
      Logger.info(`[TokenManager] Access token expiry set from ENV variable to ${this.AccessTokenExpiry} seconds`)
    }
    if (envInt(process.env.REFRESH_TOKEN_GRACE_PERIOD) > 0) {
      Logger.info(`[TokenManager] Refresh token grace period set from ENV variable to ${this.RefreshTokenGracePeriod} seconds`)
    }
  }

  get TokenSecret(): string | null | undefined {
    return TokenManager.TokenSecret
  }

  /**
   * Token secret is used to sign and verify JWTs
   * Set by ENV variable "JWT_SECRET_KEY" or generated and stored on server settings if not set
   */
  async initTokenSecret() {
    if (process.env.JWT_SECRET_KEY) {
      // Use user supplied token secret
      Logger.info('[TokenManager] JWT secret key set from ENV variable')
      TokenManager.TokenSecret = process.env.JWT_SECRET_KEY
    } else if (!Database.serverSettings!.tokenSecret) {
      // Generate new token secret and store it on server settings
      Logger.info('[TokenManager] JWT secret key not found, generating one')
      TokenManager.TokenSecret = randomBytes(256).toString('base64')
      Database.serverSettings!.tokenSecret = TokenManager.TokenSecret
      await Database.updateServerSettings()
    } else {
      // Use existing token secret from server settings
      TokenManager.TokenSecret = Database.serverSettings!.tokenSecret
    }
  }

  /**
   * Sets the refresh token cookie
   */
  setRefreshTokenCookie(req: Request, res: Response, refreshToken: string) {
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isRequestSecure(req),
      sameSite: 'lax',
      maxAge: this.RefreshTokenExpiry * 1000,
      path: '/'
    })
  }

  /**
   * Whether a decoded JWT payload may authenticate API/socket requests (not refresh-only credentials).
   */
  static isBearerAccessTokenPayload(decoded: object | null | undefined): decoded is JwtClaims {
    const parsed = bearerAccessTokenSchema.safeParse(decoded)
    if (!parsed.success || !decoded) return false
    const claims = decoded as JwtClaims
    if (claims.type === 'refresh') return false
    return true
  }

  /**
   * Function to validate a jwt token for a given user
   * Used to authenticate socket connections
   */
  static validateAccessToken(token: string): JwtClaims | null {
    try {
      // Expiration is handled by the caller so expired API keys can be deactivated
      return jwt.verify(token, TokenManager.TokenSecret, { ignoreExpiration: true })
    } catch {
      return null
    }
  }

  /**
   * Generate a JWT token for a given user
   * TODO: Old method with no expiration
   * @deprecated
   */
  static generateAccessToken(user: TokenUser): string {
    return jwt.sign({ userId: user.id, username: user.username }, TokenManager.TokenSecret)
  }

  /**
   * Function to generate a jwt token for a given user
   * TODO: Old method with no expiration
   * @deprecated
   */
  generateAccessToken(user: TokenUser): string {
    return TokenManager.generateAccessToken(user)
  }

  /**
   * Generate access token for a given user
   */
  generateTempAccessToken(user: TokenUser): string | null {
    const payload = {
      userId: user.id,
      username: user.username,
      jti: uuidv4(),
      type: 'access'
    }
    const options = {
      expiresIn: this.AccessTokenExpiry
    }
    try {
      return jwt.sign(payload, TokenManager.TokenSecret, options)
    } catch (error) {
      Logger.error(`[TokenManager] Error generating access token for user ${user.id}: ${errorMessage(error)}`)
      return null
    }
  }

  /**
   * Generate refresh token for a given user
   */
  generateRefreshToken(user: TokenUser): string | null {
    const payload = {
      userId: user.id,
      username: user.username,
      jti: uuidv4(),
      type: 'refresh'
    }
    const options = {
      expiresIn: this.RefreshTokenExpiry
    }
    try {
      return jwt.sign(payload, TokenManager.TokenSecret, options)
    } catch (error) {
      Logger.error(`[TokenManager] Error generating refresh token for user ${user.id}: ${errorMessage(error)}`)
      return null
    }
  }

  /**
   * Create tokens and session for a given user
   */
  async createTokensAndSession(user: TokenUser, req: Request) {
    const ipAddress = clientIp.getClientIp(req)
    const userAgent = req.headers['user-agent']
    const accessToken = this.generateTempAccessToken(user)
    const refreshToken = this.generateRefreshToken(user)

    // Calculate expiration time for the refresh token
    const expiresAt = new Date(Date.now() + this.RefreshTokenExpiry * 1000)

    const session = await Database.sessionModel.createSession(user.id, ipAddress, userAgent, refreshToken as string, expiresAt)

    return {
      accessToken,
      refreshToken,
      session
    }
  }

  /**
   * Rotate tokens for a given session
   */
  async rotateTokensForSession(session: Session, user: TokenUser, req: Request, res: Response, gracePeriod = true) {
    const previousRefreshToken = session.refreshToken
    const newAccessToken = this.generateTempAccessToken(user)
    let newRefreshToken = this.generateRefreshToken(user)
    const newExpiresAt = new Date(Date.now() + this.RefreshTokenExpiry * 1000)

    let lastRefreshToken = null
    let lastRefreshTokenExpiresAt = null
    if (gracePeriod) {
      // Set grace period of old refresh token in case of race condition in token rotation.
      // During this window a retry with the old refresh token returns the already-rotated
      // current token instead of failing, so a client that never received the rotation
      // response (e.g. dropped/suspended mobile request) can still recover the session.
      // Configurable via REFRESH_TOKEN_GRACE_PERIOD; may need to be longer if fetching the
      // user data takes longer due to large progress objects.
      lastRefreshToken = previousRefreshToken
      lastRefreshTokenExpiresAt = new Date(Date.now() + this.RefreshTokenGracePeriod * 1000)
    }

    // Only update if this session row still has the refresh token we read
    const [numUpdated] = await Database.sessionModel.update(
      {
        refreshToken: newRefreshToken as string,
        expiresAt: newExpiresAt,
        lastRefreshToken,
        lastRefreshTokenExpiresAt
      },
      {
        where: {
          id: session.id,
          refreshToken: previousRefreshToken
        }
      }
    )

    if (numUpdated === 0) {
      Logger.debug(`[TokenManager] Race condition in rotateTokensForSession for user ${user.id}, getting new token`)

      const updatedSession = await Database.sessionModel.findOne({ where: { id: session.id } })

      newRefreshToken = updatedSession!.refreshToken
      session.refreshToken = updatedSession!.refreshToken
      session.expiresAt = updatedSession!.expiresAt
      session.lastRefreshToken = updatedSession!.lastRefreshToken
      session.lastRefreshTokenExpiresAt = updatedSession!.lastRefreshTokenExpiresAt
    } else {
      session.refreshToken = newRefreshToken as string
      session.expiresAt = newExpiresAt
      session.lastRefreshToken = lastRefreshToken
      session.lastRefreshTokenExpiresAt = lastRefreshTokenExpiresAt
    }

    // Set new refresh token cookie
    this.setRefreshTokenCookie(req, res, newRefreshToken as string)

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    }
  }

  /**
   * Check if the jwt is valid
   */
  async jwtAuthCheck(jwt_payload: JwtClaims, done: AuthDone) {
    if (jwt_payload.type === 'api') {
      // Api key based authentication
      const parsedApiKey = apiKeyTokenSchema.safeParse(jwt_payload)
      if (!parsedApiKey.success) {
        done(null, null)
        return
      }

      const apiKey = await Database.apiKeyModel.getById(jwt_payload.keyId as string)

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

      if (!user?.isActive) {
        // deny login
        done(null, null)
        return
      }

      done(null, user)
    } else {
      // JWT based authentication — refresh tokens are only valid at POST /auth/refresh
      if (!TokenManager.isBearerAccessTokenPayload(jwt_payload)) {
        done(null, null)
        return
      }

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
   */
  async handleRefreshToken(refreshToken: string, req: Request, res: Response): Promise<RefreshResult> {
    try {
      // Verify the refresh token. Zod classifies the payload; the decoded object is what session lookup uses.
      const decoded = jwt.verify(refreshToken, TokenManager.TokenSecret)
      const parsedRefresh = refreshTokenSchema.safeParse(decoded)

      if (!parsedRefresh.success && decoded.type !== 'refresh') {
        Logger.error(`[TokenManager] Failed to refresh token. Invalid token type: ${String(decoded.type)}`)
        return {
          error: 'Invalid token type'
        }
      }

      if (decoded.type !== 'refresh') {
        Logger.error(`[TokenManager] Failed to refresh token. Invalid token type: ${String(decoded.type)}`)
        return {
          error: 'Invalid token type'
        }
      }

      const session = await Database.sessionModel.findOne({
        where: {
          [Op.or]: [{ refreshToken: refreshToken }, { lastRefreshToken: refreshToken }]
        }
      })

      if (!session) {
        Logger.error(`[TokenManager] Failed to refresh token. Session not found`)
        return {
          error: 'Invalid refresh token'
        }
      }

      let isGracePeriod = false
      if (session.refreshToken !== refreshToken) {
        // Token matched lastRefreshToken
        if (session.lastRefreshTokenExpiresAt && session.lastRefreshTokenExpiresAt > new Date()) {
          isGracePeriod = true
          Logger.debug(`[TokenManager] Grace period hit for user ${session.userId}`)
        } else {
          Logger.debug(`[TokenManager] Grace period expired for user ${session.userId}`)
          return {
            error: 'Invalid refresh token'
          }
        }
      } else {
        // Token matched current refreshToken
        // Check if session is expired in database
        if (session.expiresAt < new Date()) {
          Logger.info(`[TokenManager] Session expired in database, cleaning up`)
          await session.destroy()
          return {
            error: 'Refresh token expired'
          }
        }
      }

      const user = await Database.userModel.getUserById(decoded.userId)
      if (!user?.isActive) {
        Logger.error(`[TokenManager] Failed to refresh token. User not found or inactive for user id: ${decoded.userId}`)
        return {
          error: 'User not found or inactive'
        }
      }

      if (isGracePeriod) {
        // Return the already rotated refresh token store in the database,
        // and generate a new access token without changing the refresh token
        // again
        const accessToken = this.generateTempAccessToken(user)
        this.setRefreshTokenCookie(req, res, session.refreshToken)

        return {
          accessToken,
          refreshToken: session.refreshToken,
          user
        }
      }

      const newTokens = await this.rotateTokensForSession(session, user, req, res)
      return {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        user
      }
    } catch (error) {
      if (errorName(error) === 'TokenExpiredError') {
        Logger.info(`[TokenManager] Refresh token expired, cleaning up session`)

        // Clean up the expired session from database
        try {
          await Database.sessionModel.destroy({
            where: { refreshToken: refreshToken }
          })
          Logger.info(`[TokenManager] Expired session cleaned up`)
        } catch (cleanupError) {
          Logger.error(`[TokenManager] Error cleaning up expired session: ${errorMessage(cleanupError)}`)
        }

        return {
          error: 'Refresh token expired'
        }
      } else if (errorName(error) === 'JsonWebTokenError') {
        Logger.error(`[TokenManager] Invalid refresh token format: ${errorMessage(error)}`)
        return {
          error: 'Invalid refresh token'
        }
      } else {
        Logger.error(`[TokenManager] Refresh token error: ${errorMessage(error)}`)
        return {
          error: 'Invalid refresh token'
        }
      }
    }
  }

  /**
   * Invalidate all JWT sessions for a given user
   * If user is current user and refresh token is valid, rotate tokens for the current session
   */
  async invalidateJwtSessionsForUser(user: User, req: Request & { user: { id: string } }, res: Response) {
    const currentRefreshToken = cookieValue(req, 'refresh_token') || req.headers['x-refresh-token']
    if (req.user.id === user.id && currentRefreshToken) {
      // Current user is the same as the user to invalidate sessions for
      // So rotate token for current session
      const currentSession = await Database.sessionModel.findOne({
        where: {
          userId: user.id,
          [Op.or]: [{ refreshToken: currentRefreshToken }, { lastRefreshToken: currentRefreshToken }]
        }
      })
      if (currentSession) {
        const newTokens = await this.rotateTokensForSession(currentSession, user, req, res, false)

        // Invalidate all sessions for the user except the current one
        await Database.sessionModel.destroy({
          where: {
            id: {
              [Op.ne]: currentSession.id
            },
            userId: user.id
          }
        })

        return {
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken
        }
      } else {
        Logger.error(`[TokenManager] No session found to rotate tokens`)
      }
    }

    // Current user is not the same as the user to invalidate sessions for (or no refresh token)
    // So invalidate all sessions for the user
    await Database.sessionModel.destroy({ where: { userId: user.id } })
    return null
  }

  /**
   * Destroy all JWT sessions for the user that owns this refresh token
   */
  async invalidateAllSessionsForRefreshToken(refreshToken: string | undefined) {
    if (!refreshToken) return

    const session = await Database.sessionModel.findOne({
      where: {
        [Op.or]: [{ refreshToken: refreshToken }, { lastRefreshToken: refreshToken }]
      }
    })
    if (!session) return

    const numDeleted = await Database.sessionModel.destroy({ where: { userId: session.userId } })
    Logger.info(`[TokenManager] Invalidated all JWT sessions for user ${session.userId}, ${numDeleted} deleted`)
  }

  /**
   * Invalidate a refresh token - used for logout
   */
  async invalidateRefreshToken(refreshToken: string): Promise<boolean> {
    if (!refreshToken) {
      Logger.error(`[TokenManager] No refresh token provided to invalidate`)
      return false
    }

    try {
      const numDeleted = await Database.sessionModel.destroy({ where: { refreshToken: refreshToken } })
      Logger.info(`[TokenManager] Refresh token invalidated, ${numDeleted} sessions deleted`)
      return true
    } catch (error) {
      Logger.error(`[TokenManager] Error invalidating refresh token: ${errorMessage(error)}`)
      return false
    }
  }
}

export = TokenManager
