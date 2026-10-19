import type { NextFunction, Request, Response, Router } from 'express'
import passport from 'passport'
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt'

import Database from './Database'
import Logger from './Logger'
import TokenManager from './auth/TokenManager'
import LocalAuthStrategy from './auth/LocalAuthStrategy'
import OidcAuthStrategy from './auth/OidcAuthStrategy'

import RateLimiterFactory from './utils/rateLimiterFactory'
import utils from './utils'
import type ServerSettings from './objects/settings/ServerSettings'
import type User from './models/User'

declare global {
  var Source: string | undefined
}

const { escapeRegExp } = utils

type SettingsJson = ReturnType<ServerSettings['toJSON']>
type LoginUser = ReturnType<User['toOldJSONForBrowser']> & {
  refreshToken?: string | null
  accessToken?: string | null
}
type LoginResponse = {
  user: LoginUser
  userDefaultLibraryId: string | null
  serverSettings: ReturnType<ServerSettings['toJSONForBrowser']>
  ereaderDevices: ReturnType<NonNullable<typeof Database.emailSettings>['getEReaderDevices']>
  Source: string | undefined
}
type OpenIdSession = {
  code_verifier?: unknown
  mobile?: unknown
  sso_redirect_uri?: string
}
type SessionRequest = Request & {
  session: Record<string, OpenIdSession | undefined>
  logIn: (user: User & { openid_id_token?: string }, callback: (err: unknown) => void) => void
}
type LogoutRequest = Request & {
  logout: (callback: (err: unknown) => void) => void
}
type AuthErrorResponse = {
  req?: { _header: string }
  body?: unknown
}

function settingsJson(): SettingsJson {
  return global.ServerSettings as SettingsJson
}

function cookieValue(req: Request, name: string): unknown {
  return (req.cookies as Record<string, unknown>)[name]
}

function queryValue(req: Request, name: string): unknown {
  return req.query[name]
}

function templateValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint' || value == null) {
    return String(value)
  }
  if (typeof value === 'symbol') {
    return value.toString()
  }
  if (typeof value === 'object') {
    const toString = (value as { toString?: unknown }).toString
    if (typeof toString === 'function') {
      const converted: unknown = toString.call(value)
      if (typeof converted === 'string' || typeof converted === 'number' || typeof converted === 'boolean' || typeof converted === 'bigint' || converted == null) {
        return String(converted)
      }
    }
  }
  return Object.prototype.toString.call(value)
}

function readResponse(error: unknown): AuthErrorResponse | undefined {
  if (typeof error !== 'object' || error === null || !('response' in error)) return undefined
  const response = error.response
  if (typeof response !== 'object' || response === null) return undefined
  return response
}

/**
 * Class for handling all the authentication related functionality.
 */
class Auth {
  ignorePatterns: RegExp[]
  authRateLimiter: ReturnType<typeof RateLimiterFactory.getAuthRateLimiter>
  tokenManager: TokenManager
  localAuthStrategy: LocalAuthStrategy
  oidcAuthStrategy: OidcAuthStrategy

  constructor() {
    const escapedRouterBasePath = escapeRegExp(global.RouterBasePath)
    this.ignorePatterns = [new RegExp(`^(${escapedRouterBasePath}/api)?/items/[^/]+/cover$`), new RegExp(`^(${escapedRouterBasePath}/api)?/authors/[^/]+/image$`)]

    this.authRateLimiter = RateLimiterFactory.getAuthRateLimiter()

    this.tokenManager = new TokenManager()
    this.localAuthStrategy = new LocalAuthStrategy()
    this.oidcAuthStrategy = new OidcAuthStrategy()
  }

  /**
   * Checks if the request should not be authenticated.
   */
  authNotNeeded(req: Request): boolean {
    return req.method === 'GET' && this.ignorePatterns.some((pattern) => pattern.test(req.path))
  }

  /**
   * Middleware to register passport in express-session
   */
  ifAuthNeeded(middleware: (req: Request, res: Response, next: NextFunction) => void) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (this.authNotNeeded(req)) {
        return next()
      }
      middleware(req, res, next)
    }
  }

  /**
   * middleware to use in express to only allow authenticated users.
   */
  isAuthenticated(this: void, req: Request, res: Response, next: NextFunction) {
    return passport.authenticate('jwt', { session: false })(req, res, next)
  }

  /**
   * Function to generate a jwt token for a given user
   * TODO: Old method with no expiration
   * @deprecated
   */
  generateAccessToken(user: { id: string; username: string | null }) {
    return this.tokenManager.generateAccessToken(user)
  }

  /**
   * Invalidate all JWT sessions for a given user
   * If user is current user and refresh token is valid, rotate tokens for the current session
   */
  async invalidateJwtSessionsForUser(user: User, req: Request & { user: { id: string } }, res: Response) {
    return this.tokenManager.invalidateJwtSessionsForUser(user, req, res)
  }

  /**
   * Return the login info payload for a user
   */
  async getUserLoginResponsePayload(user: User): Promise<LoginResponse> {
    const libraryIds = await Database.libraryModel.getAllLibraryIds()
    return {
      user: user.toOldJSONForBrowser(),
      userDefaultLibraryId: user.getDefaultLibraryId(libraryIds),
      serverSettings: Database.serverSettings!.toJSONForBrowser(),
      ereaderDevices: Database.emailSettings!.getEReaderDevices(user),
      Source: global.Source
    }
  }

  // #region Passport strategies
  /**
   * Inializes all passportjs strategies and other passportjs ralated initialization.
   */
  initPassportJs() {
    const settings = settingsJson()
    // Check if we should load the local strategy (username + password login)
    if (settings.authActiveAuthMethods.includes('local')) {
      this.localAuthStrategy.init()
    }

    // Check if we should load the openid strategy
    if (settings.authActiveAuthMethods.includes('openid')) {
      this.oidcAuthStrategy.init()
    }

    // Load the JwtStrategy (always) -> for bearer token auth
    passport.use(
      new JwtStrategy(
        {
          jwtFromRequest: ExtractJwt.fromExtractors([ExtractJwt.fromAuthHeaderAsBearerToken(), ExtractJwt.fromUrlQueryParameter('token')]),
          secretOrKey: TokenManager.TokenSecret,
          // Handle expiration manaully in order to disable api keys that are expired
          ignoreExpiration: true
        },
        (payload, done) => this.tokenManager.jwtAuthCheck(payload as Parameters<TokenManager['jwtAuthCheck']>[0], done)
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
      function (serialized, cb) {
        process.nextTick(
          async function () {
            const parsedUserInfo = JSON.parse(serialized) as { id?: string }
            // load the user by ID that is stored in the session
            const dbUser = await Database.userModel.getUserById(parsedUserInfo.id)
            return cb(null, dbUser)
          }
        )
      }
    )
  }
  // #endregion

  /**
   * Unuse strategy
   */
  unuseAuthStrategy(name: string) {
    if (name === 'openid') {
      this.oidcAuthStrategy.unuse()
    } else if (name === 'local') {
      this.localAuthStrategy.unuse()
    } else {
      Logger.error('[Auth] Invalid auth strategy ' + name)
    }
  }

  /**
   * Use strategy
   */
  useAuthStrategy(name: string) {
    if (name === 'openid') {
      this.oidcAuthStrategy.init()
    } else if (name === 'local') {
      this.localAuthStrategy.init()
    } else {
      Logger.error('[Auth] Invalid auth strategy ' + name)
    }
  }

  /**
   * Returns if the given auth method is API based.
   */
  isAuthMethodAPIBased(authMethod: unknown) {
    return authMethod === 'api' || authMethod === 'openid-mobile'
  }

  /**
   * Stores the client's choice of login callback method in temporary cookies.
   *
   * The `authMethod` parameter specifies the authentication strategy and can have the following values:
   * - 'local': Standard authentication,
   * - 'api': Authentication for API use
   * - 'openid': OpenID authentication directly over web
   * - 'openid-mobile': OpenID authentication, but done via an mobile device
   */
  paramsToCookies(req: Request, res: Response, authMethod = 'local'): { error: string } | null {
    // Cookie max age in milliseconds
    const TEN_MINUTES = 10 * 60 * 1000
    const callback = queryValue(req, 'redirect_uri') || queryValue(req, 'callback')

    // Additional handling for non-API based authMethod
    if (!this.isAuthMethodAPIBased(authMethod)) {
      const state = queryValue(req, 'state')
      // Store 'auth_state' if present in the request
      if (state) {
        res.cookie('auth_state', state as string, { maxAge: TEN_MINUTES, httpOnly: true })
      }

      // Validate and store the callback URL
      if (!callback) {
        res.status(400).send({ message: 'No callback parameter' })
        return { error: 'No callback parameter' }
      }

      // Security: Validate callback URL is same-origin only
      if (!this.oidcAuthStrategy.isValidWebCallbackUrl(callback, req)) {
        Logger.warn(`[Auth] Rejected invalid callback URL: ${templateValue(callback)}`)
        res.status(400).send({ message: 'Invalid callback URL - must be same-origin' })
        return { error: 'Invalid callback URL - must be same-origin' }
      }

      res.cookie('auth_cb', callback as string, { maxAge: TEN_MINUTES, httpOnly: true })
    }

    // Store the authentication method for long
    Logger.debug(`[Auth] paramsToCookies: setting auth_method cookie to ${authMethod}`)
    res.cookie('auth_method', authMethod, { maxAge: 1000 * 60 * 60 * 24 * 365 * 10, httpOnly: true })
    return null
  }

  /**
   * Informs the client in the right mode about a successfull login and the token
   * (clients choise is restored from cookies).
   */
  async handleLoginSuccessBasedOnCookie(req: Request, res: Response) {
    // Handle token generation and get userResponse object
    // For API based auth (e.g. mobile), we will return the refresh token in the response
    const authMethod = cookieValue(req, 'auth_method')
    const isApiBased = this.isAuthMethodAPIBased(authMethod)
    Logger.debug(`[Auth] handleLoginSuccessBasedOnCookie: isApiBased: ${isApiBased}, auth_method: ${templateValue(authMethod)}`)
    const userResponse = await this.handleLoginSuccess(req as Request & { user: User }, res, isApiBased)

    if (isApiBased) {
      // REST request - send data
      res.json(userResponse)
    } else {
      const callbackUrl = cookieValue(req, 'auth_cb')
      // UI request -> check if we have a callback url
      if (callbackUrl) {
        const state = cookieValue(req, 'auth_state')
        const stateQuery = state ? `&state=${templateValue(state)}` : ''
        // UI request -> redirect to auth_cb url and send the jwt token as parameter
        // TODO: Temporarily continue sending the old token as setToken
        res.redirect(302, `${templateValue(callbackUrl)}?setToken=${templateValue(userResponse.user.token)}&accessToken=${templateValue(userResponse.user.accessToken)}${stateQuery}`)
      } else {
        Logger.error('[Auth] No callback or already expired')
        res.redirect(`/login?error=${encodeURIComponent('No callback or already expired')}&autoLaunch=0`)
      }
    }
  }

  /**
   * After login success from local or oidc
   * req.user is set by passport.authenticate
   *
   * attaches the access token to the user in the response
   * if returnTokens is true, also attaches the refresh token to the user in the response
   *
   * if returnTokens is false, sets the refresh token cookie
   */
  async handleLoginSuccess(req: Request & { user: User }, res: Response, returnTokens = false) {
    // Create tokens and session
    const { accessToken, refreshToken } = await this.tokenManager.createTokensAndSession(req.user, req)

    const userResponse = await this.getUserLoginResponsePayload(req.user)

    userResponse.user.refreshToken = returnTokens ? refreshToken : null
    userResponse.user.accessToken = accessToken

    Logger.debug(`[Auth] handleLoginSuccess: returnTokens: ${returnTokens}, isRefreshTokenInResponse: ${!!userResponse.user.refreshToken}`)

    if (!returnTokens) {
      this.tokenManager.setRefreshTokenCookie(req, res, refreshToken as string)
    }

    return userResponse
  }

  // #region Auth routes
  /**
   * Creates all (express) routes required for authentication.
   */
  initAuthRoutes(router: Router) {
    // Local strategy login route (takes username and password)
    router.post('/login', this.authRateLimiter, passport.authenticate('local'), (req, res) => {
      void (async () => {
        // Check if mobile app wants refresh token in response
        const returnTokens = req.headers['x-return-tokens'] === 'true'

        const userResponse = await this.handleLoginSuccess(req as Request & { user: User }, res, returnTokens)
        res.json(userResponse)
      })()
    })

    // Refresh token route
    router.post('/auth/refresh', this.authRateLimiter, (req, res) => {
      void (async () => {
      let refreshToken = cookieValue(req, 'refresh_token') as string | undefined

      // If x-refresh-token header is present, use it instead of the cookie
      // and return the refresh token in the response
      let shouldReturnRefreshToken = false
      const headerRefreshToken = req.headers['x-refresh-token']
      if (headerRefreshToken) {
        refreshToken = headerRefreshToken as string
        shouldReturnRefreshToken = true
      }

      if (!refreshToken) {
        Logger.error(`[Auth] Failed to refresh token. No refresh token provided`)
        return res.status(401).json({ error: 'No refresh token provided' })
      }

      Logger.debug(`[Auth] refreshing token. shouldReturnRefreshToken: ${shouldReturnRefreshToken}`)

      const refreshResponse = await this.tokenManager.handleRefreshToken(refreshToken, req, res)
      if ('error' in refreshResponse) {
        return res.status(401).json({ error: refreshResponse.error })
      }

      const userResponse = await this.getUserLoginResponsePayload(refreshResponse.user)

      userResponse.user.accessToken = refreshResponse.accessToken
      userResponse.user.refreshToken = shouldReturnRefreshToken ? refreshResponse.refreshToken : null
      res.json(userResponse)
      })()
    })

    // openid strategy login route (this redirects to the configured openid login provider)
    router.get('/auth/openid', this.authRateLimiter, (req, res) => {
      const authorizationUrlResponse = this.oidcAuthStrategy.getAuthorizationUrl(req)

      if ('error' in authorizationUrlResponse) {
        return res.status(authorizationUrlResponse.status).send(authorizationUrlResponse.error)
      }

      // Check if paramsToCookies sent a response (e.g., due to invalid callback URL)
      const cookieResult = this.paramsToCookies(req, res, authorizationUrlResponse.isMobileFlow ? 'openid-mobile' : 'openid')
      if (cookieResult && cookieResult.error) {
        return // Response already sent by paramsToCookies
      }

      res.redirect(authorizationUrlResponse.authorizationUrl)
    })

    // This will be the oauth2 callback route for mobile clients
    // It will redirect to an app-link like audiobookshelf://oauth
    router.get('/auth/openid/mobile-redirect', this.authRateLimiter, (req, res) => this.oidcAuthStrategy.handleMobileRedirect(req, res))

    // openid strategy callback route (this receives the token from the configured openid login provider)
    router.get(
      '/auth/openid/callback',
      this.authRateLimiter,
      (req, res, next) => {
        const sessionKey = this.oidcAuthStrategy.getStrategy()._key
        const sessionRequest = req as SessionRequest

        if (!sessionRequest.session[sessionKey]) {
          // Mobile clients send code_verifier and expect a status, not the web login page
          const isMobile = cookieValue(req, 'auth_method') === 'openid-mobile' || !!queryValue(req, 'code_verifier')
          Logger.error('[Auth] /auth/openid/callback route: No session')
          if (isMobile) {
            return res.status(400).send('No session')
          }
          return res.redirect(`/login?error=${encodeURIComponent('No sign-in session')}&autoLaunch=0`)
        }

        // If the client sends us a code_verifier, we will tell passport to use this to send this in the token request
        // The code_verifier will be validated by the oauth2 provider by comparing it to the code_challenge in the first request
        // Crucial for API/Mobile clients
        const codeVerifier = queryValue(req, 'code_verifier')
        if (codeVerifier) {
          sessionRequest.session[sessionKey].code_verifier = codeVerifier
        }

        function handleAuthError(isMobile: boolean, errorCode: number, errorMessage: string, logMessage: unknown, response?: AuthErrorResponse) {
          Logger.error(JSON.stringify(logMessage, null, 2))
          if (response) {
            // Depending on the error, it can also have a body
            // We also log the request header the passport plugin sents for the URL
            const header = response.req ? response.req._header.replace(/Authorization: [^\r\n]*/i, 'Authorization: REDACTED') : undefined
            Logger.debug(header + '\n' + JSON.stringify(response.body, null, 2))
          }

          if (isMobile) {
            return res.status(errorCode).send(errorMessage)
          } else {
            return res.redirect(`/login?error=${encodeURIComponent(errorMessage)}&autoLaunch=0`)
          }
        }

        function passportCallback(request: SessionRequest, response: Response, nextFn: NextFunction) {
          return (err: unknown, user: unknown, info: unknown) => {
            const isMobile = request.session[sessionKey]?.mobile === true
            if (err) {
              return handleAuthError(isMobile, 500, 'Error in callback', `[Auth] Error in openid callback - ${templateValue(err)}`, readResponse(err))
            }

            if (!user) {
              // Info usually contains the error message from the SSO provider
              return handleAuthError(isMobile, 401, 'Unauthorized', `[Auth] No data in openid callback - ${templateValue(info)}`, readResponse(info))
            }

            const authUser = user as User & { openid_id_token?: string }
            request.logIn(authUser, (loginError) => {
              if (loginError) {
                return handleAuthError(isMobile, 500, 'Error during login', `[Auth] Error in openid callback: ${templateValue(loginError)}`)
              }

              // The id_token does not provide access to the user, but is used to identify the user to the SSO provider
              //   instead it containts a JWT with userinfo like user email, username, etc.
              //   the client will get to know it anyway in the logout url according to the oauth2 spec
              //   so it is safe to send it to the client, but we use strict settings
              response.cookie('openid_id_token', authUser.openid_id_token as string, { maxAge: 1000 * 60 * 60 * 24 * 365 * 10, httpOnly: true, secure: true, sameSite: 'strict' })
              nextFn()
            })
          }
        }

        // While not required by the standard, the passport plugin re-sends the original redirect_uri in the token request
        // We need to set it correctly, as some SSO providers (e.g. keycloak) check that parameter when it is provided
        // We set it here again because the passport param can change between requests
        const redirectUri = sessionRequest.session[sessionKey].sso_redirect_uri
        return passport.authenticate('openid-client', { redirect_uri: redirectUri }, passportCallback(sessionRequest, res, next))(req, res, next)
      },
      // on a successfull login: read the cookies and react like the client requested (callback or json)
      (req, res) => {
        void this.handleLoginSuccessBasedOnCookie(req, res)
      }
    )

    /**
     * Helper route used to auto-populate the openid URLs in config/authentication
     * Takes an issuer URL as a query param and requests the config data at "/.well-known/openid-configuration"
     *
     * @example /auth/openid/config?issuer=http://192.168.1.66:9000/application/o/audiobookshelf/
     */
    router.get('/auth/openid/config', this.authRateLimiter, this.isAuthenticated, (req, res) => {
      void (async () => {
        const authUser = (req as Request & { user: User }).user
        if (!authUser.isAdminOrUp) {
          Logger.error(`[Auth] Non-admin user "${authUser.username}" attempted to get issuer config`)
          return res.sendStatus(403)
        }

        const issuer = queryValue(req, 'issuer')
        if (!issuer || typeof issuer !== 'string') {
          return res.status(400).send("Invalid request. Query param 'issuer' is required")
        }

        const openIdIssuerConfig = await this.oidcAuthStrategy.getIssuerConfig(issuer)
        if ('error' in openIdIssuerConfig) {
          return res.status(openIdIssuerConfig.status).send(openIdIssuerConfig.error)
        }

        res.json(openIdIssuerConfig)
      })()
    })

    /**
     * Logout route
     * Use ?allDevices=1 to destroy every session for this user instead of just the current one
     */
    router.post('/logout', (req, res) => {
      void (async () => {
        // Refresh token be alternatively be sent in the header
        const refreshToken = (cookieValue(req, 'refresh_token') || req.headers['x-refresh-token']) as string | undefined
        const allDevices = queryValue(req, 'allDevices') === '1'

        // Clear refresh token cookie
        res.clearCookie('refresh_token', {
          path: '/'
        })

        if (allDevices) {
          await this.tokenManager.invalidateAllSessionsForRefreshToken(refreshToken)
        } else if (refreshToken) {
          await this.tokenManager.invalidateRefreshToken(refreshToken)
        } else {
          Logger.info(`[Auth] logout: No refresh token on request`)
        }

        ;(req as LogoutRequest).logout((err) => {
          if (err) {
            res.sendStatus(500)
          } else {
            const authMethod = cookieValue(req, 'auth_method')

            res.clearCookie('auth_method')

            let logoutUrl = null

            if (authMethod === 'openid' || authMethod === 'openid-mobile') {
              logoutUrl = this.oidcAuthStrategy.getEndSessionUrl(req, cookieValue(req, 'openid_id_token') as string | undefined, authMethod)
              res.clearCookie('openid_id_token')
            }

            // Tell the user agent (browser) to redirect to the authentification provider's logout URL
            // (or redirect_url: null if we don't have one)
            res.send({ redirect_url: logoutUrl })
          }
        })
      })()
    })
  }
  // #endregion
}

export = Auth
