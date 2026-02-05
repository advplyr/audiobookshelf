const { Request, Response, NextFunction } = require('express')
const passport = require('passport')
const JwtStrategy = require('passport-jwt').Strategy
const ExtractJwt = require('passport-jwt').ExtractJwt

const Database = require('./Database')
const Logger = require('./Logger')
const TokenManager = require('./auth/TokenManager')
const LocalAuthStrategy = require('./auth/LocalAuthStrategy')
const OidcAuthStrategy = require('./auth/OidcAuthStrategy')

const RateLimiterFactory = require('./utils/rateLimiterFactory')
const { escapeRegExp } = require('./utils')

/**
 * @class Class for handling all the authentication related functionality.
 */
class Auth {
  constructor() {
    const escapedRouterBasePath = escapeRegExp(global.RouterBasePath)
    this.ignorePatterns = [new RegExp(`^(${escapedRouterBasePath}/api)?/items/[^/]+/cover$`), new RegExp(`^(${escapedRouterBasePath}/api)?/authors/[^/]+/image$`)]

    /** @type {import('express-rate-limit').RateLimitRequestHandler} */
    this.authRateLimiter = RateLimiterFactory.getAuthRateLimiter()

    this.tokenManager = new TokenManager()
    this.localAuthStrategy = new LocalAuthStrategy()
    this.oidcAuthStrategy = new OidcAuthStrategy()
  }

  /**
   * Checks if the request should not be authenticated.
   * @param {Request} req
   * @returns {boolean}
   */
  authNotNeeded(req) {
    return req.method === 'GET' && this.ignorePatterns.some((pattern) => pattern.test(req.path))
  }

  /**
   * Middleware to register passport in express-session
   *
   * @param {function} middleware
   */
  ifAuthNeeded(middleware) {
    return (req, res, next) => {
      if (this.authNotNeeded(req)) {
        return next()
      }
      middleware(req, res, next)
    }
  }

  /**
   * middleware to use in express to only allow authenticated users.
   *
   * @param {Request} req
   * @param {Response} res
   * @param {NextFunction} next
   */
  isAuthenticated(req, res, next) {
    return passport.authenticate('jwt', { session: false })(req, res, next)
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
    return this.tokenManager.generateAccessToken(user)
  }

  /**
   * Invalidate all JWT sessions for a given user
   * If user is current user and refresh token is valid, rotate tokens for the current session
   *
   * @param {import('./models/User')} user
   * @param {Request} req
   * @param {Response} res
   * @returns {Promise<string>} accessToken only if user is current user and refresh token is valid
   */
  async invalidateJwtSessionsForUser(user, req, res) {
    return this.tokenManager.invalidateJwtSessionsForUser(user, req, res)
  }

  /**
   * Return the login info payload for a user
   *
   * @param {import('./models/User')} user
   * @returns {Promise<Object>} jsonPayload
   */
  async getUserLoginResponsePayload(user) {
    const libraryIds = await Database.libraryModel.getAllLibraryIds()
    return {
      user: user.toOldJSONForBrowser(),
      userDefaultLibraryId: user.getDefaultLibraryId(libraryIds),
      serverSettings: Database.serverSettings.toJSONForBrowser(),
      ereaderDevices: Database.emailSettings.getEReaderDevices(user),
      Source: global.Source
    }
  }

  // #region Passport strategies
  /**
   * Inializes all passportjs strategies and other passportjs ralated initialization.
   * Note: OIDC no longer uses passport - only local auth and JWT use it.
   */
  async initPassportJs() {
    // Check if we should load the local strategy (username + password login)
    if (global.ServerSettings.authActiveAuthMethods.includes('local')) {
      this.localAuthStrategy.init()
    }

    // OIDC no longer needs passport initialization - it handles tokens directly

    // Load the JwtStrategy (always) -> for bearer token auth
    passport.use(
      new JwtStrategy(
        {
          jwtFromRequest: ExtractJwt.fromExtractors([ExtractJwt.fromAuthHeaderAsBearerToken(), ExtractJwt.fromUrlQueryParameter('token')]),
          secretOrKey: TokenManager.TokenSecret,
          // Handle expiration manaully in order to disable api keys that are expired
          ignoreExpiration: true
        },
        this.tokenManager.jwtAuthCheck.bind(this)
      )
    )

    // define how to seralize a user (to be put into the session)
    passport.serializeUser(function (user, cb) {
      process.nextTick(function () {
        // only store id to session
        return cb(
          null,
          JSON.stringify({
            id: user.id
          })
        )
      })
    })

    // define how to deseralize a user (use the ID to get it from the database)
    passport.deserializeUser(
      function (user, cb) {
        process.nextTick(
          async function () {
            const parsedUserInfo = JSON.parse(user)
            // load the user by ID that is stored in the session
            const dbUser = await Database.userModel.getUserById(parsedUserInfo.id)
            return cb(null, dbUser)
          }.bind(this)
        )
      }.bind(this)
    )
  }
  // #endregion

  /**
   * Unuse strategy
   *
   * @param {string} name
   */
  unuseAuthStrategy(name) {
    if (name === 'openid') {
      this.oidcAuthStrategy.reload()
    } else if (name === 'local') {
      this.localAuthStrategy.unuse()
    } else {
      Logger.error('[Auth] Invalid auth strategy ' + name)
    }
  }

  /**
   * Use strategy
   *
   * @param {string} name
   */
  useAuthStrategy(name) {
    if (name === 'openid') {
      this.oidcAuthStrategy.reload()
    } else if (name === 'local') {
      this.localAuthStrategy.init()
    } else {
      Logger.error('[Auth] Invalid auth strategy ' + name)
    }
  }

  /**
   * Returns if the given auth method is API based.
   *
   * @param {string} authMethod
   * @returns {boolean}
   */
  isAuthMethodAPIBased(authMethod) {
    return ['api', 'openid-mobile'].includes(authMethod)
  }

  /**
   * After login success from local auth
   * req.user is set by passport.authenticate
   *
   * attaches the access token to the user in the response
   * if returnTokens is true, also attaches the refresh token to the user in the response
   *
   * if returnTokens is false, sets the refresh token cookie
   *
   * @param {Request} req
   * @param {Response} res
   * @param {boolean} returnTokens
   */
  async handleLoginSuccess(req, res, returnTokens = false) {
    // Create tokens and session
    const { accessToken, refreshToken } = await this.tokenManager.createTokensAndSession(req.user, req)

    const userResponse = await this.getUserLoginResponsePayload(req.user)

    userResponse.user.refreshToken = returnTokens ? refreshToken : null
    userResponse.user.accessToken = accessToken

    Logger.debug(`[Auth] handleLoginSuccess: returnTokens: ${returnTokens}, isRefreshTokenInResponse: ${!!userResponse.user.refreshToken}`)

    if (!returnTokens) {
      this.tokenManager.setRefreshTokenCookie(req, res, refreshToken)
    }

    return userResponse
  }

  // #region Auth routes
  /**
   * Creates all (express) routes required for authentication.
   *
   * @param {import('express').Router} router
   */
  async initAuthRoutes(router) {
    // Local strategy login route (takes username and password)
    router.post('/login', this.authRateLimiter, passport.authenticate('local'), async (req, res) => {
      // Clear auth_method cookie so a stale 'openid' value doesn't affect logout
      res.clearCookie('auth_method')

      // Check if mobile app wants refresh token in response
      const returnTokens = req.headers['x-return-tokens'] === 'true'

      const userResponse = await this.handleLoginSuccess(req, res, returnTokens)
      res.json(userResponse)
    })

    // Refresh token route
    router.post('/auth/refresh', this.authRateLimiter, async (req, res) => {
      let refreshToken = req.cookies.refresh_token

      // If x-refresh-token header is present, use it instead of the cookie
      // and return the refresh token in the response
      let shouldReturnRefreshToken = false
      if (req.headers['x-refresh-token']) {
        refreshToken = req.headers['x-refresh-token']
        shouldReturnRefreshToken = true
      }

      if (!refreshToken) {
        Logger.error(`[Auth] Failed to refresh token. No refresh token provided`)
        return res.status(401).json({ error: 'No refresh token provided' })
      }

      Logger.debug(`[Auth] refreshing token. shouldReturnRefreshToken: ${shouldReturnRefreshToken}`)

      const refreshResponse = await this.tokenManager.handleRefreshToken(refreshToken, req, res)
      if (refreshResponse.error) {
        return res.status(401).json({ error: refreshResponse.error })
      }

      const userResponse = await this.getUserLoginResponsePayload(refreshResponse.user)

      userResponse.user.accessToken = refreshResponse.accessToken
      userResponse.user.refreshToken = shouldReturnRefreshToken ? refreshResponse.refreshToken : null
      res.json(userResponse)
    })

    // openid strategy login route (this redirects to the configured openid login provider)
    router.get('/auth/openid', this.authRateLimiter, (req, res) => {
      // Validate callback URL for web flow
      const callback = req.query.redirect_uri || req.query.callback
      const isMobileFlow = req.query.response_type === 'code' || req.query.redirect_uri || req.query.code_challenge

      if (!isMobileFlow) {
        if (!callback) {
          return res.status(400).send({ message: 'No callback parameter' })
        }
        if (!this.oidcAuthStrategy.isValidWebCallbackUrl(callback, req)) {
          Logger.warn(`[Auth] Rejected invalid callback URL: ${callback}`)
          return res.status(400).send({ message: 'Invalid callback URL - must be same-origin' })
        }
      }

      const authorizationUrlResponse = this.oidcAuthStrategy.getAuthorizationUrl(req, isMobileFlow, callback)

      if (authorizationUrlResponse.error) {
        return res.status(authorizationUrlResponse.status).send(authorizationUrlResponse.error)
      }

      res.redirect(authorizationUrlResponse.authorizationUrl)
    })

    // This will be the oauth2 callback route for mobile clients
    // It will redirect to an app-link like audiobookshelf://oauth
    router.get('/auth/openid/mobile-redirect', this.authRateLimiter, (req, res) => this.oidcAuthStrategy.handleMobileRedirect(req, res))

    // openid strategy callback route - now uses direct token exchange (no passport)
    router.get('/auth/openid/callback', this.authRateLimiter, async (req, res) => {
      const isMobile = !!req.session.oidc?.isMobile
      // Extract session data before cleanup (needed for redirect on success)
      const callbackUrl = req.session.oidc?.callbackUrl

      try {
        const user = await this.oidcAuthStrategy.handleCallback(req)

        // req.login still works (passport initialized for JWT/local)
        await new Promise((resolve, reject) => {
          req.login(user, (err) => (err ? reject(err) : resolve()))
        })

        // Create tokens and session, storing oidcIdToken in DB
        const returnTokens = isMobile
        const { accessToken, refreshToken } = await this.tokenManager.createTokensAndSession(user, req, user.openid_id_token)

        const userResponse = await this.getUserLoginResponsePayload(user)
        userResponse.user.accessToken = accessToken
        userResponse.user.refreshToken = returnTokens ? refreshToken : null

        // Set auth_method cookie
        const authMethod = isMobile ? 'openid-mobile' : 'openid'
        res.cookie('auth_method', authMethod, {
          maxAge: 1000 * 60 * 60 * 24 * 365 * 10,
          httpOnly: true,
          secure: req.secure || req.get('x-forwarded-proto') === 'https',
          sameSite: 'lax'
        })

        if (!returnTokens) {
          this.tokenManager.setRefreshTokenCookie(req, res, refreshToken)
        }

        if (isMobile) {
          res.json(userResponse)
        } else {
          if (callbackUrl) {
            // TODO: Temporarily continue sending the old token as setToken
            res.redirect(302, `${callbackUrl}?setToken=${userResponse.user.token}&accessToken=${accessToken}`)
          } else {
            res.status(400).send('No callback URL')
          }
        }
      } catch (error) {
        Logger.error(`[Auth] OIDC callback error: ${error.message}\n${error.stack}`)
        if (isMobile) {
          res.status(error.statusCode || 500).json({ error: error.message })
        } else {
          res.redirect(`${global.RouterBasePath}/login?error=${encodeURIComponent(error.message)}&autoLaunch=0`)
        }
      } finally {
        // Clean up OIDC session data to prevent replay (on both success and error paths)
        delete req.session.oidc
      }
    })

    /**
     * @deprecated Use POST /api/auth-settings/openid/discover instead. This route will be removed in a future version.
     * Helper route used to auto-populate the openid URLs in config/authentication
     * Takes an issuer URL as a query param and requests the config data at "/.well-known/openid-configuration"
     *
     * @example /auth/openid/config?issuer=http://192.168.1.66:9000/application/o/audiobookshelf/
     */
    router.get('/auth/openid/config', this.authRateLimiter, this.isAuthenticated, async (req, res) => {
      if (!req.user.isAdminOrUp) {
        Logger.error(`[Auth] Non-admin user "${req.user.username}" attempted to get issuer config`)
        return res.sendStatus(403)
      }

      if (!req.query.issuer || typeof req.query.issuer !== 'string') {
        return res.status(400).send("Invalid request. Query param 'issuer' is required")
      }

      const openIdIssuerConfig = await this.oidcAuthStrategy.getIssuerConfig(req.query.issuer)
      if (openIdIssuerConfig.error) {
        return res.status(openIdIssuerConfig.status).send(openIdIssuerConfig.error)
      }

      res.json(openIdIssuerConfig)
    })

    // Logout route
    router.post('/logout', async (req, res) => {
      // Refresh token can alternatively be sent in the header
      const refreshToken = req.cookies.refresh_token || req.headers['x-refresh-token']

      // Clear refresh token cookie
      res.clearCookie('refresh_token', {
        path: '/'
      })

      // Get oidcIdToken from DB session before invalidating (for OIDC logout)
      let oidcIdToken = null
      if (refreshToken) {
        const session = await this.tokenManager.getSessionByRefreshToken(refreshToken)
        if (session) {
          oidcIdToken = session.oidcIdToken
        }
        await this.tokenManager.invalidateRefreshToken(refreshToken)
      } else {
        Logger.info(`[Auth] logout: No refresh token on request`)
      }

      req.logout((err) => {
        if (err) {
          res.sendStatus(500)
        } else {
          const authMethod = req.cookies.auth_method

          res.clearCookie('auth_method')

          let logoutUrl = null

          if (authMethod === 'openid' || authMethod === 'openid-mobile') {
            logoutUrl = this.oidcAuthStrategy.getEndSessionUrl(req, oidcIdToken, authMethod)
          }

          // Tell the user agent (browser) to redirect to the authentification provider's logout URL
          // (or redirect_url: null if we don't have one)
          res.send({ redirect_url: logoutUrl })
        }
      })
    })
  }
  // #endregion
}

module.exports = Auth
