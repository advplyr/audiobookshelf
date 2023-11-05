const passport = require('passport')
const bcrypt = require('./libs/bcryptjs')
const jwt = require('./libs/jsonwebtoken')
const LocalStrategy = require('./libs/passportLocal')
const JwtStrategy = require('passport-jwt').Strategy
const ExtractJwt = require('passport-jwt').ExtractJwt
const GoogleStrategy = require('passport-google-oauth20').Strategy
const OpenIDClient = require('openid-client')
const Database = require('./Database')
const Logger = require('./Logger')

/**
 * @class Class for handling all the authentication related functionality.
 */
class Auth {

  constructor() {
  }

  static cors(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*')
    res.header("Access-Control-Allow-Methods", 'GET, POST, PATCH, PUT, DELETE, OPTIONS')
    res.header('Access-Control-Allow-Headers', '*')
    res.header('Access-Control-Allow-Credentials', true)
    if (req.method === 'OPTIONS') {
      res.sendStatus(200)
    } else {
      next()
    }
  }

  /**
   * Inializes all passportjs strategies and other passportjs ralated initialization.
   */
  async initPassportJs() {
    // Check if we should load the local strategy (username + password login)
    if (global.ServerSettings.authActiveAuthMethods.includes("local")) {
      passport.use(new LocalStrategy(this.localAuthCheckUserPw.bind(this)))
    }

    // Check if we should load the google-oauth20 strategy
    if (global.ServerSettings.authActiveAuthMethods.includes("google-oauth20")) {
      passport.use(new GoogleStrategy({
        clientID: global.ServerSettings.authGoogleOauth20ClientID,
        clientSecret: global.ServerSettings.authGoogleOauth20ClientSecret,
        callbackURL: global.ServerSettings.authGoogleOauth20CallbackURL
      }, (async function (accessToken, refreshToken, profile, done) {
        // TODO: do we want to create the users which does not exist?

        // get user by email
        const user = await Database.userModel.getUserByEmail(profile.emails[0].value.toLowerCase())

        if (!user || !user.isActive) {
          // deny login
          done(null, null)
          return
        }

        // permit login
        return done(null, user)
      }).bind(this)))
    }

    // Check if we should load the openid strategy
    if (global.ServerSettings.authActiveAuthMethods.includes("openid")) {
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
        // TODO: Here is where to lookup the Abs user or register a new Abs user
        Logger.debug(`[Auth] openid callback userinfo=`, userinfo)

        let user = null
        // TODO: Temporary lookup existing user by email. May be replaced by a setting to toggle this or use name
        if (userinfo.email && userinfo.email_verified) {
          user = await Database.userModel.getUserByEmail(userinfo.email)
          // TODO: If using existing user then save userinfo.sub on user
        }

        if (!user?.isActive) {
          // deny login
          done(null, null)
          return
        }

        // permit login
        return done(null, user)
      }))
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
   * Stores the client's choice how the login callback should happen in temp cookies
   * 
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  paramsToCookies(req, res) {
    if (req.query.isRest?.toLowerCase() == "true") {
      // store the isRest flag to the is_rest cookie 
      res.cookie('is_rest', req.query.isRest.toLowerCase(), {
        maxAge: 120000, // 2 min
        httpOnly: true
      })
    } else {
      // no isRest-flag set -> set is_rest cookie to false
      res.cookie('is_rest', "false", {
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

    // google-oauth20 strategy login route (this redirects to the google login)
    router.get('/auth/google', (req, res, next) => {
      const auth_func = passport.authenticate('google', { scope: ['email'] })
      // params (isRest, callback) to a cookie that will be send to the client
      this.paramsToCookies(req, res)
      auth_func(req, res, next)
    })

    // google-oauth20 strategy callback route (this receives the token from google)
    router.get('/auth/google/callback',
      passport.authenticate('google'),
      // on a successfull login: read the cookies and react like the client requested (callback or json)
      this.handleLoginSuccessBasedOnCookie.bind(this)
    )

    // openid strategy login route (this redirects to the configured openid login provider)
    router.get('/auth/openid', (req, res, next) => {
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
      oidcStrategy._params.redirect_uri = new URL(`${req.protocol}://${req.get('host')}/auth/openid/callback`).toString()
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
        ...pick(params, 'nonce', 'state', 'max_age', 'response_type')
      }

      // Now get the URL to direct to
      const authorizationUrl = client.authorizationUrl({
        ...params,
        scope: 'openid profile email',
        response_type: 'code',
        code_challenge,
        code_challenge_method,
      })

      // params (isRest, callback) to a cookie that will be send to the client
      this.paramsToCookies(req, res)

      // Redirect the user agent (browser) to the authorization URL
      res.redirect(authorizationUrl)
    })

    // openid strategy callback route (this receives the token from the configured openid login provider)
    router.get('/auth/openid/callback',
      passport.authenticate('openid-client'),
      // on a successfull login: read the cookies and react like the client requested (callback or json)
      this.handleLoginSuccessBasedOnCookie.bind(this))

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
   * @param {Object} user 
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
        user.token = await this.generateAccessToken({ userId: user.id, username: user.username })
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

    if (!user || !user.isActive) {
      done(null, null)
      return
    }

    // Check passwordless root user
    if (user.type === 'root' && (!user.pash || user.pash === '')) {
      if (password) {
        // deny login
        done(null, null)
        return
      }
      // approve login
      done(null, user)
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
}

module.exports = Auth