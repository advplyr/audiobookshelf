const axios = require('axios')
const passport = require('passport')
const bcrypt = require('./libs/bcryptjs')
const jwt = require('./libs/jsonwebtoken')
const LocalStrategy = require('./libs/passportLocal')
const JwtStrategy = require('passport-jwt').Strategy
const ExtractJwt = require('passport-jwt').ExtractJwt
const OpenIDClient = require('openid-client')
const Database = require('./Database')
const Logger = require('./Logger')

/**
 * @class Class for handling all the authentication related functionality.
 */
class Auth {

  constructor() {
    // Map of openId sessions indexed by oauth2 state-variable
    this.openIdAuthSession = new Map()
  }

  /**
   * Inializes all passportjs strategies and other passportjs ralated initialization.
   */
  async initPassportJs() {
    // Check if we should load the local strategy (username + password login)
    if (global.ServerSettings.authActiveAuthMethods.includes("local")) {
      this.initAuthStrategyPassword()
    }

    // Check if we should load the openid strategy
    if (global.ServerSettings.authActiveAuthMethods.includes("openid")) {
      this.initAuthStrategyOpenID()
    }

    // Load the JwtStrategy (always) -> for bearer token auth 
    passport.use(new JwtStrategy({
      jwtFromRequest: ExtractJwt.fromExtractors([ExtractJwt.fromAuthHeaderAsBearerToken(), ExtractJwt.fromUrlQueryParameter('token')]),
      secretOrKey: Database.serverSettings.tokenSecret
    }, this.jwtAuthCheck.bind(this)))

    // define how to seralize a user (to be put into the session)
    passport.serializeUser(function (user, cb) {
      process.nextTick(function () {
        // only store id to session
        return cb(null, JSON.stringify({
          id: user.id,
        }))
      })
    })

    // define how to deseralize a user (use the ID to get it from the database)
    passport.deserializeUser((function (user, cb) {
      process.nextTick((async function () {
        const parsedUserInfo = JSON.parse(user)
        // load the user by ID that is stored in the session
        const dbUser = await Database.userModel.getUserById(parsedUserInfo.id)
        return cb(null, dbUser)
      }).bind(this))
    }).bind(this))
  }

  /**
   * Passport use LocalStrategy
   */
  initAuthStrategyPassword() {
    passport.use(new LocalStrategy(this.localAuthCheckUserPw.bind(this)))
  }

  /**
   * Passport use OpenIDClient.Strategy
   */
  initAuthStrategyOpenID() {
    if (!Database.serverSettings.isOpenIDAuthSettingsValid) {
      Logger.error(`[Auth] Cannot init openid auth strategy - invalid settings`)
      return
    }

    const openIdIssuerClient = new OpenIDClient.Issuer({
      issuer: global.ServerSettings.authOpenIDIssuerURL,
      authorization_endpoint: global.ServerSettings.authOpenIDAuthorizationURL,
      token_endpoint: global.ServerSettings.authOpenIDTokenURL,
      userinfo_endpoint: global.ServerSettings.authOpenIDUserInfoURL,
      jwks_uri: global.ServerSettings.authOpenIDJwksURL
    }).Client
    const openIdClient = new openIdIssuerClient({
      client_id: global.ServerSettings.authOpenIDClientID,
      client_secret: global.ServerSettings.authOpenIDClientSecret
    })
    passport.use('openid-client', new OpenIDClient.Strategy({
      client: openIdClient,
      params: {
        redirect_uri: '/auth/openid/callback',
        scope: 'openid profile email'
      }
    }, async (tokenset, userinfo, done) => {
      Logger.debug(`[Auth] openid callback userinfo=`, userinfo)

      let failureMessage = 'Unauthorized'
      if (!userinfo.sub) {
        Logger.error(`[Auth] openid callback invalid userinfo, no sub`)
        return done(null, null, failureMessage)
      }

      // First check for matching user by sub
      let user = await Database.userModel.getUserByOpenIDSub(userinfo.sub)
      if (!user) {
        // Optionally match existing by email or username based on server setting "authOpenIDMatchExistingBy"
        if (Database.serverSettings.authOpenIDMatchExistingBy === 'email' && userinfo.email && userinfo.email_verified) {
          Logger.info(`[Auth] openid: User not found, checking existing with email "${userinfo.email}"`)
          user = await Database.userModel.getUserByEmail(userinfo.email)
          // Check that user is not already matched
          if (user?.authOpenIDSub) {
            Logger.warn(`[Auth] openid: User found with email "${userinfo.email}" but is already matched with sub "${user.authOpenIDSub}"`)
            // TODO: Message isn't actually returned to the user yet. Need to override the passport authenticated callback
            failureMessage = 'A matching user was found but is already matched with another user from your auth provider'
            user = null
          }
        } else if (Database.serverSettings.authOpenIDMatchExistingBy === 'username' && userinfo.preferred_username) {
          Logger.info(`[Auth] openid: User not found, checking existing with username "${userinfo.preferred_username}"`)
          user = await Database.userModel.getUserByUsername(userinfo.preferred_username)
          // Check that user is not already matched
          if (user?.authOpenIDSub) {
            Logger.warn(`[Auth] openid: User found with username "${userinfo.preferred_username}" but is already matched with sub "${user.authOpenIDSub}"`)
            // TODO: Message isn't actually returned to the user yet. Need to override the passport authenticated callback
            failureMessage = 'A matching user was found but is already matched with another user from your auth provider'
            user = null
          }
        }

        // If existing user was matched and isActive then save sub to user
        if (user?.isActive) {
          Logger.info(`[Auth] openid: New user found matching existing user "${user.username}"`)
          user.authOpenIDSub = userinfo.sub
          await Database.userModel.updateFromOld(user)
        } else if (user && !user.isActive) {
          Logger.warn(`[Auth] openid: New user found matching existing user "${user.username}" but that user is deactivated`)
        }

        // Optionally auto register the user 
        if (!user && Database.serverSettings.authOpenIDAutoRegister) {
          Logger.info(`[Auth] openid: Auto-registering user with sub "${userinfo.sub}"`, userinfo)
          user = await Database.userModel.createUserFromOpenIdUserInfo(userinfo, this)
        }
      }

      if (!user?.isActive) {
        if (user && !user.isActive) {
          failureMessage = 'Unauthorized'
        }
        // deny login
        done(null, null, failureMessage)
        return
      }

      // permit login
      return done(null, user)
    }))
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
   * Stores the client's choice how the login callback should happen in temp cookies
   * 
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  paramsToCookies(req, res) {
    // Set if isRest flag is set or if mobile oauth flow is used
    if (req.query.isRest?.toLowerCase() == 'true' || req.query.redirect_uri) {
      // store the isRest flag to the is_rest cookie 
      res.cookie('is_rest', 'true', {
        maxAge: 120000, // 2 min
        httpOnly: true
      })
    } else {
      // no isRest-flag set -> set is_rest cookie to false
      res.cookie('is_rest', 'false', {
        maxAge: 120000, // 2 min
        httpOnly: true
      })

      // persist state if passed in
      if (req.query.state) {
        res.cookie('auth_state', req.query.state, {
          maxAge: 120000, // 2 min
          httpOnly: true
        })
      }

      const callback = req.query.redirect_uri || req.query.callback

      // check if we are missing a callback parameter - we need one if isRest=false
      if (!callback) {
        res.status(400).send({
          message: 'No callback parameter'
        })
        return
      }
      // store the callback url to the auth_cb cookie 
      res.cookie('auth_cb', callback, {
        maxAge: 120000, // 2 min
        httpOnly: true
      })
    }
  }

  /**
   * Informs the client in the right mode about a successfull login and the token
   * (clients choise is restored from cookies).
   * 
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async handleLoginSuccessBasedOnCookie(req, res) {
    // get userLogin json (information about the user, server and the session)
    const data_json = await this.getUserLoginResponsePayload(req.user)

    if (req.cookies.is_rest === 'true') {
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
      res.json(await this.getUserLoginResponsePayload(req.user))
    })

    // openid strategy login route (this redirects to the configured openid login provider)
    router.get('/auth/openid', (req, res, next) => {
      try {
        // helper function from openid-client
        function pick(object, ...paths) {
          const obj = {}
          for (const path of paths) {
            if (object[path] !== undefined) {
              obj[path] = object[path]
            }
          }
          return obj
        }

        // Get the OIDC client from the strategy
        // We need to call the client manually, because the strategy does not support forwarding the code challenge
        //    for API or mobile clients
        const oidcStrategy = passport._strategy('openid-client')
        const protocol = (req.secure || req.get('x-forwarded-proto') === 'https') ? 'https' : 'http'

        let mobile_redirect_uri = null

        // The client wishes a different redirect_uri
        // We will allow if it is in the whitelist, by saving it into this.openIdAuthSession and setting the redirect uri to /auth/openid/mobile-redirect
        //    where we will handle the redirect to it
        if (req.query.redirect_uri) {
          // Check if the redirect_uri is in the whitelist
          if (Database.serverSettings.authOpenIDMobileRedirectURIs.includes(req.query.redirect_uri) ||
            (Database.serverSettings.authOpenIDMobileRedirectURIs.length === 1 && Database.serverSettings.authOpenIDMobileRedirectURIs[0] === '*')) {
            oidcStrategy._params.redirect_uri = new URL(`${protocol}://${req.get('host')}/auth/openid/mobile-redirect`).toString()
            mobile_redirect_uri = req.query.redirect_uri
          } else {
            Logger.debug(`[Auth] Invalid redirect_uri=${req.query.redirect_uri} - not in whitelist`)
            return res.status(400).send('Invalid redirect_uri')
          }
        } else {
          oidcStrategy._params.redirect_uri = new URL(`${protocol}://${req.get('host')}/auth/openid/callback`).toString()
        }

        Logger.debug(`[Auth] Oidc redirect_uri=${oidcStrategy._params.redirect_uri}`)
        const client = oidcStrategy._client
        const sessionKey = oidcStrategy._key

        let code_challenge
        let code_challenge_method

        // If code_challenge is provided, expect that code_verifier will be handled by the client (mobile app)
        // The web frontend of ABS does not need to do a PKCE itself, because it never handles the "code" of the oauth flow
        //    and as such will not send a code challenge, we will generate then one
        if (req.query.code_challenge) {
          code_challenge = req.query.code_challenge
          code_challenge_method = req.query.code_challenge_method || 'S256'

          if (!['S256', 'plain'].includes(code_challenge_method)) {
            return res.status(400).send('Invalid code_challenge_method')
          }
        } else {
          // If no code_challenge is provided, assume a web application flow and generate one
          const code_verifier = OpenIDClient.generators.codeVerifier()
          code_challenge = OpenIDClient.generators.codeChallenge(code_verifier)
          code_challenge_method = 'S256'

          // Store the code_verifier in the session for later use in the token exchange
          req.session[sessionKey] = { ...req.session[sessionKey], code_verifier }
        }

        const params = {
          state: OpenIDClient.generators.random(),
          // Other params by the passport strategy
          ...oidcStrategy._params
        }

        if (!params.nonce && params.response_type.includes('id_token')) {
          params.nonce = OpenIDClient.generators.random()
        }

        req.session[sessionKey] = {
          ...req.session[sessionKey],
          ...pick(params, 'nonce', 'state', 'max_age', 'response_type'),
          mobile: req.query.redirect_uri, // Used in the abs callback later, set mobile if redirect_uri is filled out
          sso_redirect_uri: oidcStrategy._params.redirect_uri // Save the redirect_uri (for the SSO Provider) for the callback
        }

        // We cannot save redirect_uri in the session, because it the mobile client uses browser instead of the API
        //   for the request to mobile-redirect and as such the session is not shared
        this.openIdAuthSession.set(params.state, { mobile_redirect_uri: mobile_redirect_uri })

        // Now get the URL to direct to
        const authorizationUrl = client.authorizationUrl({
          ...params,
          scope: 'openid profile email',
          response_type: 'code',
          code_challenge,
          code_challenge_method
        })

        // params (isRest, callback) to a cookie that will be send to the client
        this.paramsToCookies(req, res)

        // Redirect the user agent (browser) to the authorization URL
        res.redirect(authorizationUrl)
      } catch (error) {
        Logger.error(`[Auth] Error in /auth/openid route: ${error}`)
        res.status(500).send('Internal Server Error')
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
        Logger.error(`[Auth] Error in /auth/openid/mobile-redirect route: ${error}`)
        res.status(500).send('Internal Server Error')
      }
    })

    // openid strategy callback route (this receives the token from the configured openid login provider)
    router.get('/auth/openid/callback', (req, res, next) => {
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
        Logger.error(logMessage)
        if (response) {
          // Depending on the error, it can also have a body
          // We also log the request header the passport plugin sents for the URL
          const header = response.req?._header.replace(/Authorization: [^\r\n]*/i, 'Authorization: REDACTED')
          Logger.debug(header + '\n' + response.body?.toString())
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
      this.handleLoginSuccessBasedOnCookie.bind(this))

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
        return res.status(400).send('Invalid request. Query param \'issuer\' is required')
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
        return res.status(400).send('Invalid request. Query param \'issuer\' is invalid')
      }

      axios.get(configUrl.toString()).then(({ data }) => {
        res.json({
          issuer: data.issuer,
          authorization_endpoint: data.authorization_endpoint,
          token_endpoint: data.token_endpoint,
          userinfo_endpoint: data.userinfo_endpoint,
          end_session_endpoint: data.end_session_endpoint,
          jwks_uri: data.jwks_uri
        })
      }).catch((error) => {
        Logger.error(`[Auth] Failed to get openid configuration at "${configUrl}"`, error)
        res.status(error.statusCode || 400).send(`${error.code || 'UNKNOWN'}: Failed to get openid configuration`)
      })
    })

    // Logout route
    router.post('/logout', (req, res) => {
      // TODO: invalidate possible JWTs
      req.logout((err) => {
        if (err) {
          res.sendStatus(500)
        } else {
          res.sendStatus(200)
        }
      })
    })
  }

  /**
   * middleware to use in express to only allow authenticated users.
   * @param {import('express').Request} req 
   * @param {import('express').Response} res 
   * @param {import('express').NextFunction} next  
   */
  isAuthenticated(req, res, next) {
    // check if session cookie says that we are authenticated
    if (req.isAuthenticated()) {
      next()
    } else {
      // try JWT to authenticate
      passport.authenticate("jwt")(req, res, next)
    }
  }

  /**
   * Function to generate a jwt token for a given user
   * 
   * @param {{ id:string, username:string }} user 
   * @returns {string} token
   */
  generateAccessToken(user) {
    return jwt.sign({ userId: user.id, username: user.username }, global.ServerSettings.tokenSecret)
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
    }
    catch (err) {
      return null
    }
  }

  /**
   * Generate a token which is used to encrpt/protect the jwts.
   */
  async initTokenSecret() {
    if (process.env.TOKEN_SECRET) { // User can supply their own token secret
      Database.serverSettings.tokenSecret = process.env.TOKEN_SECRET
    } else {
      Database.serverSettings.tokenSecret = require('crypto').randomBytes(256).toString('base64')
    }
    await Database.updateServerSettings()

    // New token secret creation added in v2.1.0 so generate new API tokens for each user
    const users = await Database.userModel.getOldUsers()
    if (users.length) {
      for (const user of users) {
        user.token = await this.generateAccessToken(user)
      }
      await Database.updateBulkUsers(users)
    }
  }

  /**
   * Checks if the user in the validated jwt_payload really exists and is active.
   * @param {Object} jwt_payload 
   * @param {function} done 
   */
  async jwtAuthCheck(jwt_payload, done) {
    // load user by id from the jwt token
    const user = await Database.userModel.getUserByIdOrOldId(jwt_payload.userId)

    if (!user?.isActive) {
      // deny login
      done(null, null)
      return
    }
    // approve login
    done(null, user)
    return
  }

  /**
   * Checks if a username and password tuple is valid and the user active.
   * @param {string} username 
   * @param {string} password 
   * @param {function} done 
   */
  async localAuthCheckUserPw(username, password, done) {
    // Load the user given it's username
    const user = await Database.userModel.getUserByUsername(username.toLowerCase())

    if (!user?.isActive) {
      done(null, null)
      return
    }

    // Check passwordless root user
    if (user.type === 'root' && !user.pash) {
      if (password) {
        // deny login
        done(null, null)
        return
      }
      // approve login
      done(null, user)
      return
    } else if (!user.pash) {
      Logger.error(`[Auth] User "${user.username}"/"${user.type}" attempted to login without a password set`)
      done(null, null)
      return
    }

    // Check password match
    const compare = await bcrypt.compare(password, user.pash)
    if (compare) {
      // approve login
      done(null, user)
      return
    }
    // deny login
    done(null, null)
    return
  }

  /**
   * Hashes a password with bcrypt.
   * @param {string} password 
   * @returns {string} hash 
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
   * @param {Object} user 
   * @returns {Promise<Object>} jsonPayload
   */
  async getUserLoginResponsePayload(user) {
    const libraryIds = await Database.libraryModel.getAllLibraryIds()
    return {
      user: user.toJSONForBrowser(),
      userDefaultLibraryId: user.getDefaultLibraryId(libraryIds),
      serverSettings: Database.serverSettings.toJSONForBrowser(),
      ereaderDevices: Database.emailSettings.getEReaderDevices(user),
      Source: global.Source
    }
  }

  /**
   * 
   * @param {string} password 
   * @param {*} user 
   * @returns {boolean}
   */
  comparePassword(password, user) {
    if (user.type === 'root' && !password && !user.pash) return true
    if (!password || !user.pash) return false
    return bcrypt.compare(password, user.pash)
  }

  /**
   * User changes their password from request
   * 
   * @param {import('express').Request} req 
   * @param {import('express').Response} res 
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

    matchingUser.pash = pw

    const success = await Database.updateUser(matchingUser)
    if (success) {
      Logger.info(`[Auth] User "${matchingUser.username}" changed password`)
      res.json({
        success: true
      })
    } else {
      res.json({
        error: 'Unknown error'
      })
    }
  }
}

module.exports = Auth