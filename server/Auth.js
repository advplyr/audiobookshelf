const axios = require('axios')
const passport = require('passport')
const { Op } = require('sequelize')
const { Request, Response, NextFunction } = require('express')
const bcrypt = require('./libs/bcryptjs')
const jwt = require('./libs/jsonwebtoken')
const requestIp = require('./libs/requestIp')
const LocalStrategy = require('./libs/passportLocal')
const JwtStrategy = require('passport-jwt').Strategy
const ExtractJwt = require('passport-jwt').ExtractJwt
const OpenIDClient = require('openid-client')
const Database = require('./Database')
const Logger = require('./Logger')
const { escapeRegExp } = require('./utils')

/**
 * @class Class for handling all the authentication related functionality.
 */
class Auth {
  constructor() {
    // Map of openId sessions indexed by oauth2 state-variable
    this.openIdAuthSession = new Map()
    const escapedRouterBasePath = escapeRegExp(global.RouterBasePath)
    this.ignorePatterns = [new RegExp(`^(${escapedRouterBasePath}/api)?/items/[^/]+/cover$`), new RegExp(`^(${escapedRouterBasePath}/api)?/authors/[^/]+/image$`)]

    this.RefreshTokenExpiry = parseInt(process.env.REFRESH_TOKEN_EXPIRY) || 7 * 24 * 60 * 60 // 7 days
    this.AccessTokenExpiry = parseInt(process.env.ACCESS_TOKEN_EXPIRY) || 12 * 60 * 60 // 12 hours
  }

  /**
   * Checks if the request should not be authenticated.
   * @param {Request} req
   * @returns {boolean}
   * @private
   */
  authNotNeeded(req) {
    return req.method === 'GET' && this.ignorePatterns.some((pattern) => pattern.test(req.path))
  }

  ifAuthNeeded(middleware) {
    return (req, res, next) => {
      if (this.authNotNeeded(req)) {
        return next()
      }
      middleware(req, res, next)
    }
  }

  /**
   * Inializes all passportjs strategies and other passportjs ralated initialization.
   */
  async initPassportJs() {
    // Check if we should load the local strategy (username + password login)
    if (global.ServerSettings.authActiveAuthMethods.includes('local')) {
      this.initAuthStrategyPassword()
    }

    // Check if we should load the openid strategy
    if (global.ServerSettings.authActiveAuthMethods.includes('openid')) {
      this.initAuthStrategyOpenID()
    }

    // Load the JwtStrategy (always) -> for bearer token auth
    passport.use(
      new JwtStrategy(
        {
          jwtFromRequest: ExtractJwt.fromExtractors([ExtractJwt.fromAuthHeaderAsBearerToken(), ExtractJwt.fromUrlQueryParameter('token')]),
          secretOrKey: Database.serverSettings.tokenSecret,
          // Handle expiration manaully in order to disable api keys that are expired
          ignoreExpiration: true
        },
        this.jwtAuthCheck.bind(this)
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

  /**
   * Passport use LocalStrategy
   */
  initAuthStrategyPassword() {
    passport.use(new LocalStrategy({ passReqToCallback: true }, this.localAuthCheckUserPw.bind(this)))
  }

  /**
   * Passport use OpenIDClient.Strategy
   */
  initAuthStrategyOpenID() {
    if (!Database.serverSettings.isOpenIDAuthSettingsValid) {
      Logger.error(`[Auth] Cannot init openid auth strategy - invalid settings`)
      return
    }

    // Custom req timeout see: https://github.com/panva/node-openid-client/blob/main/docs/README.md#customizing
    OpenIDClient.custom.setHttpOptionsDefaults({ timeout: 10000 })

    const openIdIssuerClient = new OpenIDClient.Issuer({
      issuer: global.ServerSettings.authOpenIDIssuerURL,
      authorization_endpoint: global.ServerSettings.authOpenIDAuthorizationURL,
      token_endpoint: global.ServerSettings.authOpenIDTokenURL,
      userinfo_endpoint: global.ServerSettings.authOpenIDUserInfoURL,
      jwks_uri: global.ServerSettings.authOpenIDJwksURL,
      end_session_endpoint: global.ServerSettings.authOpenIDLogoutURL
    }).Client
    const openIdClient = new openIdIssuerClient({
      client_id: global.ServerSettings.authOpenIDClientID,
      client_secret: global.ServerSettings.authOpenIDClientSecret,
      id_token_signed_response_alg: global.ServerSettings.authOpenIDTokenSigningAlgorithm
    })
    passport.use(
      'openid-client',
      new OpenIDClient.Strategy(
        {
          client: openIdClient,
          params: {
            redirect_uri: `${global.ServerSettings.authOpenIDSubfolderForRedirectURLs}/auth/openid/callback`,
            scope: 'openid profile email'
          }
        },
        async (tokenset, userinfo, done) => {
          try {
            Logger.debug(`[Auth] openid callback userinfo=`, JSON.stringify(userinfo, null, 2))

            if (!userinfo.sub) {
              throw new Error('Invalid userinfo, no sub')
            }

            if (!this.validateGroupClaim(userinfo)) {
              throw new Error(`Group claim ${Database.serverSettings.authOpenIDGroupClaim} not found or empty in userinfo`)
            }

            let user = await this.findOrCreateUser(userinfo)

            if (!user?.isActive) {
              throw new Error('User not active or not found')
            }

            await this.setUserGroup(user, userinfo)
            await this.updateUserPermissions(user, userinfo)

            // We also have to save the id_token for later (used for logout) because we cannot set cookies here
            user.openid_id_token = tokenset.id_token

            return done(null, user)
          } catch (error) {
            Logger.error(`[Auth] openid callback error: ${error?.message}\n${error?.stack}`)

            return done(null, null, 'Unauthorized')
          }
        }
      )
    )
  }

  /**
   * Finds an existing user by OpenID subject identifier, or by email/username based on server settings,
   * or creates a new user if configured to do so.
   *
   * @returns {Promise<import('./models/User')|null>}
   */
  async findOrCreateUser(userinfo) {
    let user = await Database.userModel.getUserByOpenIDSub(userinfo.sub)

    // Matched by sub
    if (user) {
      Logger.debug(`[Auth] openid: User found by sub`)
      return user
    }

    // Match existing user by email
    if (Database.serverSettings.authOpenIDMatchExistingBy === 'email') {
      if (userinfo.email) {
        // Only disallow when email_verified explicitly set to false (allow both if not set or true)
        if (userinfo.email_verified === false) {
          Logger.warn(`[Auth] openid: User not found and email "${userinfo.email}" is not verified`)
          return null
        } else {
          Logger.info(`[Auth] openid: User not found, checking existing with email "${userinfo.email}"`)
          user = await Database.userModel.getUserByEmail(userinfo.email)

          if (user?.authOpenIDSub) {
            Logger.warn(`[Auth] openid: User found with email "${userinfo.email}" but is already matched with sub "${user.authOpenIDSub}"`)
            return null // User is linked to a different OpenID subject; do not proceed.
          }
        }
      } else {
        Logger.warn(`[Auth] openid: User not found and no email in userinfo`)
        // We deny login, because if the admin whishes to match email, it makes sense to require it
        return null
      }
    }
    // Match existing user by username
    else if (Database.serverSettings.authOpenIDMatchExistingBy === 'username') {
      let username

      if (userinfo.preferred_username) {
        Logger.info(`[Auth] openid: User not found, checking existing with userinfo.preferred_username "${userinfo.preferred_username}"`)
        username = userinfo.preferred_username
      } else if (userinfo.username) {
        Logger.info(`[Auth] openid: User not found, checking existing with userinfo.username "${userinfo.username}"`)
        username = userinfo.username
      } else {
        Logger.warn(`[Auth] openid: User not found and neither preferred_username nor username in userinfo`)
        return null
      }

      user = await Database.userModel.getUserByUsername(username)

      if (user?.authOpenIDSub) {
        Logger.warn(`[Auth] openid: User found with username "${username}" but is already matched with sub "${user.authOpenIDSub}"`)
        return null // User is linked to a different OpenID subject; do not proceed.
      }
    }

    // Found existing user via email or username
    if (user) {
      if (!user.isActive) {
        Logger.warn(`[Auth] openid: User found but is not active`)
        return null
      }

      // Update user with OpenID sub
      if (!user.extraData) user.extraData = {}
      user.extraData.authOpenIDSub = userinfo.sub
      user.changed('extraData', true)
      await user.save()

      Logger.debug(`[Auth] openid: User found by email/username`)
      return user
    }

    // If no existing user was matched, auto-register if configured
    if (Database.serverSettings.authOpenIDAutoRegister) {
      Logger.info(`[Auth] openid: Auto-registering user with sub "${userinfo.sub}"`, userinfo)
      user = await Database.userModel.createUserFromOpenIdUserInfo(userinfo, this)
      return user
    }

    Logger.warn(`[Auth] openid: User not found and auto-register is disabled`)
    return null
  }

  /**
   * Validates the presence and content of the group claim in userinfo.
   */
  validateGroupClaim(userinfo) {
    const groupClaimName = Database.serverSettings.authOpenIDGroupClaim
    if (!groupClaimName)
      // Allow no group claim when configured like this
      return true

    // If configured it must exist in userinfo
    if (!userinfo[groupClaimName]) {
      return false
    }
    return true
  }

  /**
   * Sets the user group based on group claim in userinfo.
   *
   * @param {import('./models/User')} user
   * @param {Object} userinfo
   */
  async setUserGroup(user, userinfo) {
    const groupClaimName = Database.serverSettings.authOpenIDGroupClaim
    if (!groupClaimName)
      // No group claim configured, don't set anything
      return

    if (!userinfo[groupClaimName]) throw new Error(`Group claim ${groupClaimName} not found in userinfo`)

    const groupsList = userinfo[groupClaimName].map((group) => group.toLowerCase())
    const rolesInOrderOfPriority = ['admin', 'user', 'guest']

    let userType = rolesInOrderOfPriority.find((role) => groupsList.includes(role))
    if (userType) {
      if (user.type === 'root') {
        // Check OpenID Group
        if (userType !== 'admin') {
          throw new Error(`Root user "${user.username}" cannot be downgraded to ${userType}. Denying login.`)
        } else {
          // If root user is logging in via OpenID, we will not change the type
          return
        }
      }

      if (user.type !== userType) {
        Logger.info(`[Auth] openid callback: Updating user "${user.username}" type to "${userType}" from "${user.type}"`)
        user.type = userType
        await user.save()
      }
    } else {
      throw new Error(`No valid group found in userinfo: ${JSON.stringify(userinfo[groupClaimName], null, 2)}`)
    }
  }

  /**
   * Updates user permissions based on the advanced permissions claim.
   *
   * @param {import('./models/User')} user
   * @param {Object} userinfo
   */
  async updateUserPermissions(user, userinfo) {
    const absPermissionsClaim = Database.serverSettings.authOpenIDAdvancedPermsClaim
    if (!absPermissionsClaim)
      // No advanced permissions claim configured, don't set anything
      return

    if (user.type === 'admin' || user.type === 'root') return

    const absPermissions = userinfo[absPermissionsClaim]
    if (!absPermissions) throw new Error(`Advanced permissions claim ${absPermissionsClaim} not found in userinfo`)

    if (await user.updatePermissionsFromExternalJSON(absPermissions)) {
      Logger.info(`[Auth] openid callback: Updating advanced perms for user "${user.username}" using "${JSON.stringify(absPermissions)}"`)
    }
  }

  /**
   * Unuse strategy
   *
   * @param {string} name
   */
  unuseAuthStrategy(name) {
    passport.unuse(name)
  }

  /**
   * Use strategy
   *
   * @param {string} name
   */
  useAuthStrategy(name) {
    if (name === 'openid') {
      this.initAuthStrategyOpenID()
    } else if (name === 'local') {
      this.initAuthStrategyPassword()
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
   * Stores the client's choice of login callback method in temporary cookies.
   *
   * The `authMethod` parameter specifies the authentication strategy and can have the following values:
   * - 'local': Standard authentication,
   * - 'api': Authentication for API use
   * - 'openid': OpenID authentication directly over web
   * - 'openid-mobile': OpenID authentication, but done via an mobile device
   *
   * @param {Request} req
   * @param {Response} res
   * @param {string} authMethod - The authentication method, default is 'local'.
   */
  paramsToCookies(req, res, authMethod = 'local') {
    const TWO_MINUTES = 120000 // 2 minutes in milliseconds
    const callback = req.query.redirect_uri || req.query.callback

    // Additional handling for non-API based authMethod
    if (!this.isAuthMethodAPIBased(authMethod)) {
      // Store 'auth_state' if present in the request
      if (req.query.state) {
        res.cookie('auth_state', req.query.state, { maxAge: TWO_MINUTES, httpOnly: true })
      }

      // Validate and store the callback URL
      if (!callback) {
        return res.status(400).send({ message: 'No callback parameter' })
      }
      res.cookie('auth_cb', callback, { maxAge: TWO_MINUTES, httpOnly: true })
    }

    // Store the authentication method for long
    res.cookie('auth_method', authMethod, { maxAge: 1000 * 60 * 60 * 24 * 365 * 10, httpOnly: true })
  }

  /**
   * Sets the refresh token cookie
   * @param {Request} req
   * @param {Response} res
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
   * Informs the client in the right mode about a successfull login and the token
   * (clients choise is restored from cookies).
   *
   * @param {Request} req
   * @param {Response} res
   */
  async handleLoginSuccessBasedOnCookie(req, res) {
    // get userLogin json (information about the user, server and the session)
    const data_json = await this.getUserLoginResponsePayload(req.user)

    if (this.isAuthMethodAPIBased(req.cookies.auth_method)) {
      // REST request - send data
      res.json(data_json)
    } else {
      // UI request -> check if we have a callback url
      // TODO: do we want to somehow limit the values for auth_cb?
      if (req.cookies.auth_cb) {
        let stateQuery = req.cookies.auth_state ? `&state=${req.cookies.auth_state}` : ''
        // UI request -> redirect to auth_cb url and send the jwt token as parameter
        res.redirect(302, `${req.cookies.auth_cb}?setToken=${data_json.user.token}${stateQuery}`)
      } else {
        res.status(400).send('No callback or already expired')
      }
    }
  }

  /**
   * Creates all (express) routes required for authentication.
   *
   * @param {import('express').Router} router
   */
  async initAuthRoutes(router) {
    // Local strategy login route (takes username and password)
    router.post('/login', passport.authenticate('local'), async (req, res) => {
      // return the user login response json if the login was successfull
      const userResponse = await this.getUserLoginResponsePayload(req.user)

      // Check if mobile app wants refresh token in response
      const returnTokens = req.query.return_tokens === 'true' || req.headers['x-return-tokens'] === 'true'

      userResponse.user.refreshToken = returnTokens ? req.user.refreshToken : null
      userResponse.user.accessToken = req.user.accessToken

      if (!returnTokens) {
        this.setRefreshTokenCookie(req, res, req.user.refreshToken)
      }

      res.json(userResponse)
    })

    // Refresh token route
    router.post('/auth/refresh', async (req, res) => {
      let refreshToken = req.cookies.refresh_token

      // For mobile clients, the refresh token is sent in the authorization header
      let shouldReturnRefreshToken = false
      if (!refreshToken && req.headers.authorization?.startsWith('Bearer ')) {
        refreshToken = req.headers.authorization.split(' ')[1]
        shouldReturnRefreshToken = true
      }

      if (!refreshToken) {
        return res.status(401).json({ error: 'No refresh token provided' })
      }

      try {
        // Verify the refresh token
        const decoded = jwt.verify(refreshToken, global.ServerSettings.tokenSecret)

        if (decoded.type !== 'refresh') {
          return res.status(401).json({ error: 'Invalid token type' })
        }

        const session = await Database.sessionModel.findOne({
          where: { refreshToken: refreshToken }
        })

        if (!session) {
          return res.status(401).json({ error: 'Invalid refresh token' })
        }

        // Check if session is expired in database
        if (session.expiresAt < new Date()) {
          Logger.info(`[Auth] Session expired in database, cleaning up`)
          await session.destroy()
          return res.status(401).json({ error: 'Refresh token expired' })
        }

        const user = await Database.userModel.getUserById(decoded.userId)
        if (!user?.isActive) {
          return res.status(401).json({ error: 'User not found or inactive' })
        }

        const newTokens = await this.rotateTokensForSession(session, user, req, res)

        const userResponse = await this.getUserLoginResponsePayload(user)

        userResponse.user.accessToken = newTokens.accessToken
        userResponse.user.refreshToken = shouldReturnRefreshToken ? newTokens.refreshToken : null
        res.json(userResponse)
      } catch (error) {
        if (error.name === 'TokenExpiredError') {
          Logger.info(`[Auth] Refresh token expired, cleaning up session`)

          // Clean up the expired session from database
          try {
            await Database.sessionModel.destroy({
              where: { refreshToken: refreshToken }
            })
            Logger.info(`[Auth] Expired session cleaned up`)
          } catch (cleanupError) {
            Logger.error(`[Auth] Error cleaning up expired session: ${cleanupError.message}`)
          }

          return res.status(401).json({ error: 'Refresh token expired' })
        } else if (error.name === 'JsonWebTokenError') {
          Logger.error(`[Auth] Invalid refresh token format: ${error.message}`)
          return res.status(401).json({ error: 'Invalid refresh token' })
        } else {
          Logger.error(`[Auth] Refresh token error: ${error.message}`)
          return res.status(401).json({ error: 'Invalid refresh token' })
        }
      }
    })

    // openid strategy login route (this redirects to the configured openid login provider)
    router.get('/auth/openid', (req, res, next) => {
      // Get the OIDC client from the strategy
      // We need to call the client manually, because the strategy does not support forwarding the code challenge
      //    for API or mobile clients
      const oidcStrategy = passport._strategy('openid-client')
      const client = oidcStrategy._client
      const sessionKey = oidcStrategy._key

      try {
        const protocol = req.secure || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http'
        const hostUrl = new URL(`${protocol}://${req.get('host')}`)
        const isMobileFlow = req.query.response_type === 'code' || req.query.redirect_uri || req.query.code_challenge

        // Only allow code flow (for mobile clients)
        if (req.query.response_type && req.query.response_type !== 'code') {
          Logger.debug(`[Auth] OIDC Invalid response_type=${req.query.response_type}`)
          return res.status(400).send('Invalid response_type, only code supported')
        }

        // Generate a state on web flow or if no state supplied
        const state = !isMobileFlow || !req.query.state ? OpenIDClient.generators.random() : req.query.state

        // Redirect URL for the SSO provider
        let redirectUri
        if (isMobileFlow) {
          // Mobile required redirect uri
          // If it is in the whitelist, we will save into this.openIdAuthSession and set the redirect uri to /auth/openid/mobile-redirect
          //    where we will handle the redirect to it
          if (!req.query.redirect_uri || !isValidRedirectUri(req.query.redirect_uri)) {
            Logger.debug(`[Auth] Invalid redirect_uri=${req.query.redirect_uri}`)
            return res.status(400).send('Invalid redirect_uri')
          }
          // We cannot save the supplied redirect_uri in the session, because it the mobile client uses browser instead of the API
          //   for the request to mobile-redirect and as such the session is not shared
          this.openIdAuthSession.set(state, { mobile_redirect_uri: req.query.redirect_uri })

          redirectUri = new URL(`${global.ServerSettings.authOpenIDSubfolderForRedirectURLs}/auth/openid/mobile-redirect`, hostUrl).toString()
        } else {
          redirectUri = new URL(`${global.ServerSettings.authOpenIDSubfolderForRedirectURLs}/auth/openid/callback`, hostUrl).toString()

          if (req.query.state) {
            Logger.debug(`[Auth] Invalid state - not allowed on web openid flow`)
            return res.status(400).send('Invalid state, not allowed on web flow')
          }
        }
        oidcStrategy._params.redirect_uri = redirectUri
        Logger.debug(`[Auth] OIDC redirect_uri=${redirectUri}`)

        let { code_challenge, code_challenge_method, code_verifier } = generatePkce(req, isMobileFlow)

        req.session[sessionKey] = {
          ...req.session[sessionKey],
          state: state,
          max_age: oidcStrategy._params.max_age,
          response_type: 'code',
          code_verifier: code_verifier, // not null if web flow
          mobile: req.query.redirect_uri, // Used in the abs callback later, set mobile if redirect_uri is filled out
          sso_redirect_uri: oidcStrategy._params.redirect_uri // Save the redirect_uri (for the SSO Provider) for the callback
        }

        var scope = 'openid profile email'
        if (global.ServerSettings.authOpenIDGroupClaim) {
          scope += ' ' + global.ServerSettings.authOpenIDGroupClaim
        }
        if (global.ServerSettings.authOpenIDAdvancedPermsClaim) {
          scope += ' ' + global.ServerSettings.authOpenIDAdvancedPermsClaim
        }

        const authorizationUrl = client.authorizationUrl({
          ...oidcStrategy._params,
          state: state,
          response_type: 'code',
          scope: scope,
          code_challenge,
          code_challenge_method
        })

        this.paramsToCookies(req, res, isMobileFlow ? 'openid-mobile' : 'openid')

        res.redirect(authorizationUrl)
      } catch (error) {
        Logger.error(`[Auth] Error in /auth/openid route: ${error}\n${error?.stack}`)
        res.status(500).send('Internal Server Error')
      }

      function generatePkce(req, isMobileFlow) {
        if (isMobileFlow) {
          if (!req.query.code_challenge) {
            throw new Error('code_challenge required for mobile flow (PKCE)')
          }
          if (req.query.code_challenge_method && req.query.code_challenge_method !== 'S256') {
            throw new Error('Only S256 code_challenge_method method supported')
          }
          return {
            code_challenge: req.query.code_challenge,
            code_challenge_method: req.query.code_challenge_method || 'S256'
          }
        } else {
          const code_verifier = OpenIDClient.generators.codeVerifier()
          const code_challenge = OpenIDClient.generators.codeChallenge(code_verifier)
          return { code_challenge, code_challenge_method: 'S256', code_verifier }
        }
      }

      function isValidRedirectUri(uri) {
        // Check if the redirect_uri is in the whitelist
        return Database.serverSettings.authOpenIDMobileRedirectURIs.includes(uri) || (Database.serverSettings.authOpenIDMobileRedirectURIs.length === 1 && Database.serverSettings.authOpenIDMobileRedirectURIs[0] === '*')
      }
    })

    // This will be the oauth2 callback route for mobile clients
    // It will redirect to an app-link like audiobookshelf://oauth
    router.get('/auth/openid/mobile-redirect', (req, res) => {
      try {
        // Extract the state parameter from the request
        const { state, code } = req.query

        // Check if the state provided is in our list
        if (!state || !this.openIdAuthSession.has(state)) {
          Logger.error('[Auth] /auth/openid/mobile-redirect route: State parameter mismatch')
          return res.status(400).send('State parameter mismatch')
        }

        let mobile_redirect_uri = this.openIdAuthSession.get(state).mobile_redirect_uri

        if (!mobile_redirect_uri) {
          Logger.error('[Auth] No redirect URI')
          return res.status(400).send('No redirect URI')
        }

        this.openIdAuthSession.delete(state)

        const redirectUri = `${mobile_redirect_uri}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
        // Redirect to the overwrite URI saved in the map
        res.redirect(redirectUri)
      } catch (error) {
        Logger.error(`[Auth] Error in /auth/openid/mobile-redirect route: ${error}\n${error?.stack}`)
        res.status(500).send('Internal Server Error')
      }
    })

    // openid strategy callback route (this receives the token from the configured openid login provider)
    router.get(
      '/auth/openid/callback',
      (req, res, next) => {
        const oidcStrategy = passport._strategy('openid-client')
        const sessionKey = oidcStrategy._key

        if (!req.session[sessionKey]) {
          return res.status(400).send('No session')
        }

        // If the client sends us a code_verifier, we will tell passport to use this to send this in the token request
        // The code_verifier will be validated by the oauth2 provider by comparing it to the code_challenge in the first request
        // Crucial for API/Mobile clients
        if (req.query.code_verifier) {
          req.session[sessionKey].code_verifier = req.query.code_verifier
        }

        function handleAuthError(isMobile, errorCode, errorMessage, logMessage, response) {
          Logger.error(JSON.stringify(logMessage, null, 2))
          if (response) {
            // Depending on the error, it can also have a body
            // We also log the request header the passport plugin sents for the URL
            const header = response.req?._header.replace(/Authorization: [^\r\n]*/i, 'Authorization: REDACTED')
            Logger.debug(header + '\n' + JSON.stringify(response.body, null, 2))
          }

          if (isMobile) {
            return res.status(errorCode).send(errorMessage)
          } else {
            return res.redirect(`/login?error=${encodeURIComponent(errorMessage)}&autoLaunch=0`)
          }
        }

        function passportCallback(req, res, next) {
          return (err, user, info) => {
            const isMobile = req.session[sessionKey]?.mobile === true
            if (err) {
              return handleAuthError(isMobile, 500, 'Error in callback', `[Auth] Error in openid callback - ${err}`, err?.response)
            }

            if (!user) {
              // Info usually contains the error message from the SSO provider
              return handleAuthError(isMobile, 401, 'Unauthorized', `[Auth] No data in openid callback - ${info}`, info?.response)
            }

            req.logIn(user, (loginError) => {
              if (loginError) {
                return handleAuthError(isMobile, 500, 'Error during login', `[Auth] Error in openid callback: ${loginError}`)
              }

              // The id_token does not provide access to the user, but is used to identify the user to the SSO provider
              //   instead it containts a JWT with userinfo like user email, username, etc.
              //   the client will get to know it anyway in the logout url according to the oauth2 spec
              //   so it is safe to send it to the client, but we use strict settings
              res.cookie('openid_id_token', user.openid_id_token, { maxAge: 1000 * 60 * 60 * 24 * 365 * 10, httpOnly: true, secure: true, sameSite: 'Strict' })
              next()
            })
          }
        }

        // While not required by the standard, the passport plugin re-sends the original redirect_uri in the token request
        // We need to set it correctly, as some SSO providers (e.g. keycloak) check that parameter when it is provided
        // We set it here again because the passport param can change between requests
        return passport.authenticate('openid-client', { redirect_uri: req.session[sessionKey].sso_redirect_uri }, passportCallback(req, res, next))(req, res, next)
      },
      // on a successfull login: read the cookies and react like the client requested (callback or json)
      this.handleLoginSuccessBasedOnCookie.bind(this)
    )

    /**
     * Helper route used to auto-populate the openid URLs in config/authentication
     * Takes an issuer URL as a query param and requests the config data at "/.well-known/openid-configuration"
     *
     * @example /auth/openid/config?issuer=http://192.168.1.66:9000/application/o/audiobookshelf/
     */
    router.get('/auth/openid/config', this.isAuthenticated, async (req, res) => {
      if (!req.user.isAdminOrUp) {
        Logger.error(`[Auth] Non-admin user "${req.user.username}" attempted to get issuer config`)
        return res.sendStatus(403)
      }

      if (!req.query.issuer) {
        return res.status(400).send("Invalid request. Query param 'issuer' is required")
      }

      // Strip trailing slash
      let issuerUrl = req.query.issuer
      if (issuerUrl.endsWith('/')) issuerUrl = issuerUrl.slice(0, -1)

      // Append config pathname and validate URL
      let configUrl = null
      try {
        configUrl = new URL(`${issuerUrl}/.well-known/openid-configuration`)
        if (!configUrl.pathname.endsWith('/.well-known/openid-configuration')) {
          throw new Error('Invalid pathname')
        }
      } catch (error) {
        Logger.error(`[Auth] Failed to get openid configuration. Invalid URL "${configUrl}"`, error)
        return res.status(400).send("Invalid request. Query param 'issuer' is invalid")
      }

      axios
        .get(configUrl.toString())
        .then(({ data }) => {
          res.json({
            issuer: data.issuer,
            authorization_endpoint: data.authorization_endpoint,
            token_endpoint: data.token_endpoint,
            userinfo_endpoint: data.userinfo_endpoint,
            end_session_endpoint: data.end_session_endpoint,
            jwks_uri: data.jwks_uri,
            id_token_signing_alg_values_supported: data.id_token_signing_alg_values_supported
          })
        })
        .catch((error) => {
          Logger.error(`[Auth] Failed to get openid configuration at "${configUrl}"`, error)
          res.status(error.statusCode || 400).send(`${error.code || 'UNKNOWN'}: Failed to get openid configuration`)
        })
    })

    // Logout route
    router.post('/logout', async (req, res) => {
      const refreshToken = req.cookies.refresh_token
      // Clear refresh token cookie
      res.clearCookie('refresh_token', {
        path: '/'
      })

      // Invalidate the session in database using refresh token
      if (refreshToken) {
        try {
          await Database.sessionModel.destroy({
            where: { refreshToken }
          })
        } catch (error) {
          Logger.error(`[Auth] Error destroying session: ${error.message}`)
        }
      }

      // TODO: invalidate possible JWTs
      req.logout((err) => {
        if (err) {
          res.sendStatus(500)
        } else {
          const authMethod = req.cookies.auth_method

          res.clearCookie('auth_method')

          let logoutUrl = null

          if (authMethod === 'openid' || authMethod === 'openid-mobile') {
            // If we are using openid, we need to redirect to the logout endpoint
            // node-openid-client does not support doing it over passport
            const oidcStrategy = passport._strategy('openid-client')
            const client = oidcStrategy._client

            if (client.issuer.end_session_endpoint && client.issuer.end_session_endpoint.length > 0) {
              let postLogoutRedirectUri = null

              if (authMethod === 'openid') {
                const protocol = req.secure || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http'
                const host = req.get('host')
                // TODO: ABS does currently not support subfolders for installation
                // If we want to support it we need to include a config for the serverurl
                postLogoutRedirectUri = `${protocol}://${host}${global.RouterBasePath}/login`
              }
              // else for openid-mobile we keep postLogoutRedirectUri on null
              //  nice would be to redirect to the app here, but for example Authentik does not implement
              //  the post_logout_redirect_uri parameter at all and for other providers
              //  we would also need again to implement (and even before get to know somehow for 3rd party apps)
              //  the correct app link like audiobookshelf://login (and maybe also provide a redirect like mobile-redirect).
              //   Instead because its null (and this way the parameter will be omitted completly), the client/app can simply append something like
              //  &post_logout_redirect_uri=audiobookshelf://login to the received logout url by itself which is the simplest solution
              //   (The URL needs to be whitelisted in the config of the SSO/ID provider)

              logoutUrl = client.endSessionUrl({
                id_token_hint: req.cookies.openid_id_token,
                post_logout_redirect_uri: postLogoutRedirectUri
              })
            }

            res.clearCookie('openid_id_token')
          }

          // Tell the user agent (browser) to redirect to the authentification provider's logout URL
          // (or redirect_url: null if we don't have one)
          res.send({ redirect_url: logoutUrl })
        }
      })
    })
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
   *
   * @param {{ id:string, username:string }} user
   * @returns {string} token
   */
  generateAccessToken(user) {
    return jwt.sign({ userId: user.id, username: user.username }, global.ServerSettings.tokenSecret)
  }

  /**
   * Generate access token for a given user
   *
   * @param {{ id:string, username:string }} user
   * @returns {Promise<string>}
   */
  generateTempAccessToken(user) {
    return new Promise((resolve) => {
      jwt.sign({ userId: user.id, username: user.username, type: 'access' }, global.ServerSettings.tokenSecret, { expiresIn: this.AccessTokenExpiry }, (err, token) => {
        if (err) {
          Logger.error(`[Auth] Error generating access token for user ${user.id}: ${err}`)
          resolve(null)
        } else {
          resolve(token)
        }
      })
    })
  }

  /**
   * Generate refresh token for a given user
   *
   * @param {{ id:string, username:string }} user
   * @returns {Promise<string>}
   */
  generateRefreshToken(user) {
    return new Promise((resolve) => {
      jwt.sign({ userId: user.id, username: user.username, type: 'refresh' }, global.ServerSettings.tokenSecret, { expiresIn: this.RefreshTokenExpiry }, (err, token) => {
        if (err) {
          Logger.error(`[Auth] Error generating refresh token for user ${user.id}: ${err}`)
          resolve(null)
        } else {
          resolve(token)
        }
      })
    })
  }

  /**
   * Create tokens and session for a given user
   *
   * @param {{ id:string, username:string }} user
   * @param {Request} req
   * @returns {Promise<{ accessToken:string, refreshToken:string, session:import('./models/Session') }>}
   */
  async createTokensAndSession(user, req) {
    const ipAddress = requestIp.getClientIp(req)
    const userAgent = req.headers['user-agent']
    const [accessToken, refreshToken] = await Promise.all([this.generateTempAccessToken(user), this.generateRefreshToken(user)])

    // Calculate expiration time for the refresh token
    const expiresAt = new Date(Date.now() + this.RefreshTokenExpiry * 1000)

    const session = await Database.sessionModel.createSession(user.id, ipAddress, userAgent, refreshToken, expiresAt)
    user.accessToken = accessToken
    // Store refresh token on user object for cookie setting
    user.refreshToken = refreshToken
    return { accessToken, refreshToken, session }
  }

  /**
   * Rotate tokens for a given session
   *
   * @param {import('./models/Session')} session
   * @param {import('./models/User')} user
   * @param {Request} req
   * @param {Response} res
   * @returns {Promise<{ accessToken:string, refreshToken:string }>}
   */
  async rotateTokensForSession(session, user, req, res) {
    // Generate new tokens
    const [newAccessToken, newRefreshToken] = await Promise.all([this.generateTempAccessToken(user), this.generateRefreshToken(user)])

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
   * Invalidate all JWT sessions for a given user
   * If user is current user and refresh token is valid, rotate tokens for the current session
   *
   * @param {Request} req
   * @param {Response} res
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
        Logger.error(`[Auth] No session found to rotate tokens for refresh token ${currentRefreshToken}`)
      }
    }

    // Current user is not the same as the user to invalidate sessions for (or no refresh token)
    // So invalidate all sessions for the user
    await Database.sessionModel.destroy({ where: { userId: user.id } })
    return null
  }

  /**
   * Function to validate a jwt token for a given user
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
   * Generate a token which is used to encrpt/protect the jwts.
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
        user.token = await this.generateAccessToken(user)
        await user.save({ hooks: false })
      }
    }
  }

  /**
   * Checks if the user or api key in the validated jwt_payload exists and is active.
   * @param {Object} jwt_payload
   * @param {function} done
   */
  async jwtAuthCheck(jwt_payload, done) {
    if (jwt_payload.type === 'api') {
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
        Logger.info(`[Auth] API key ${apiKey.id} is expired - deactivated`)
        return
      }

      const user = await Database.userModel.getUserById(apiKey.userId)
      done(null, user)
    } else {
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
      // approve login
      done(null, user)
    }
  }

  /**
   * Checks if a username and password tuple is valid and the user active.
   * @param {Request} req
   * @param {string} username
   * @param {string} password
   * @param {Promise<function>} done
   */
  async localAuthCheckUserPw(req, username, password, done) {
    // Load the user given it's username
    const user = await Database.userModel.getUserByUsername(username.toLowerCase())

    if (!user?.isActive) {
      if (user) {
        this.logFailedLocalAuthLoginAttempt(req, user.username, 'User is not active')
      } else {
        this.logFailedLocalAuthLoginAttempt(req, username, 'User not found')
      }
      done(null, null)
      return
    }

    // Check passwordless root user
    if (user.type === 'root' && !user.pash) {
      if (password) {
        // deny login
        this.logFailedLocalAuthLoginAttempt(req, user.username, 'Root user has no password set')
        done(null, null)
        return
      }
      // approve login
      Logger.info(`[Auth] User "${user.username}" logged in from ip ${requestIp.getClientIp(req)}`)

      // Create tokens and session, updates user.accessToken and user.refreshToken
      await this.createTokensAndSession(user, req)

      done(null, user)
      return
    } else if (!user.pash) {
      this.logFailedLocalAuthLoginAttempt(req, user.username, 'User has no password set. Might have been created with OpenID')
      done(null, null)
      return
    }

    // Check password match
    const compare = await bcrypt.compare(password, user.pash)
    if (compare) {
      // approve login
      Logger.info(`[Auth] User "${user.username}" logged in from ip ${requestIp.getClientIp(req)}`)

      // Create tokens and session, updates user.accessToken and user.refreshToken
      await this.createTokensAndSession(user, req)

      done(null, user)
      return
    }
    // deny login
    this.logFailedLocalAuthLoginAttempt(req, user.username, 'Invalid password')
    done(null, null)
    return
  }

  /**
   *
   * @param {Request} req
   * @param {string} username
   * @param {string} message
   */
  logFailedLocalAuthLoginAttempt(req, username, message) {
    if (!req || !username || !message) return
    Logger.error(`[Auth] Failed login attempt for username "${username}" from ip ${requestIp.getClientIp(req)} (${message})`)
  }

  /**
   * Hashes a password with bcrypt.
   * @param {string} password
   * @returns {Promise<string>} hash
   */
  hashPass(password) {
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

  /**
   *
   * @param {string} password
   * @param {import('./models/User')} user
   * @returns {Promise<boolean>}
   */
  comparePassword(password, user) {
    if (user.type === 'root' && !password && !user.pash) return true
    if (!password || !user.pash) return false
    return bcrypt.compare(password, user.pash)
  }

  /**
   * User changes their password from request
   * TODO: Update responses to use error status codes
   *
   * @param {import('./controllers/MeController').RequestWithUser} req
   * @param {Response} res
   */
  async userChangePassword(req, res) {
    let { password, newPassword } = req.body
    newPassword = newPassword || ''
    const matchingUser = req.user

    // Only root can have an empty password
    if (matchingUser.type !== 'root' && !newPassword) {
      return res.json({
        error: 'Invalid new password - Only root can have an empty password'
      })
    }

    // Check password match
    const compare = await this.comparePassword(password, matchingUser)
    if (!compare) {
      return res.json({
        error: 'Invalid password'
      })
    }

    let pw = ''
    if (newPassword) {
      pw = await this.hashPass(newPassword)
      if (!pw) {
        return res.json({
          error: 'Hash failed'
        })
      }
    }
    try {
      await matchingUser.update({ pash: pw })
      Logger.info(`[Auth] User "${matchingUser.username}" changed password`)
      res.json({
        success: true
      })
    } catch (error) {
      Logger.error(`[Auth] User "${matchingUser.username}" failed to change password`, error)
      res.json({
        error: 'Unknown error'
      })
    }
  }
}

module.exports = Auth
