const passport = require('passport')
const bcrypt = require('./libs/bcryptjs')
const jwt = require('./libs/jsonwebtoken')
const LocalStrategy = require('./libs/passportLocal')
const JwtStrategy = require('passport-jwt').Strategy
const ExtractJwt = require('passport-jwt').ExtractJwt
const GoogleStrategy = require('passport-google-oauth20').Strategy
const OpenIDConnectStrategy = require('passport-openidconnect')
const Database = require('./Database')

/**
 * @class Class for handling all the authentication related functionality.
 */
class Auth {

  constructor() {
  }

  /**
   * Inializes all passportjs stragegies and other passportjs ralated initialization.
   */
  initPassportJs() {
    // Check if we should load the local strategy
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
        const user = await Database.userModel.getUserByEmail(profile.emails[0].value.toLowerCase())

        if (!user || !user.isActive) {
          done(null, null)
          return
        }

        return done(null, user)
      }).bind(this)))
    }

    // Check if we should load the openid strategy
    if (global.ServerSettings.authActiveAuthMethods.includes("openid")) {
      passport.use(new OpenIDConnectStrategy({
        issuer: global.ServerSettings.authOpenIDIssuerURL,
        authorizationURL: global.ServerSettings.authOpenIDAuthorizationURL,
        tokenURL: global.ServerSettings.authOpenIDTokenURL,
        userInfoURL: global.ServerSettings.authOpenIDUserInfoURL,
        clientID: global.ServerSettings.authOpenIDClientID,
        clientSecret: global.ServerSettings.authOpenIDClientSecret,
        callbackURL: global.ServerSettings.authOpenIDCallbackURL,
        scope: ["openid", "email", "profile"],
        skipUserProfile: false
      },
        (function (issuer, profile, done) {
          // TODO: do we want to create the users which does not exist?
          var user = Database.userModel.getUserByEmail(profile.emails[0].value.toLowerCase())

          if (!user || !user.isActive) {
            done(null, null)
            return
          }

          return done(null, user)
        }).bind(this)))
    }

    // Load the JwtStrategy (always) -> for bearer token auth 
    passport.use(new JwtStrategy({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: global.ServerSettings.tokenSecret
    }, this.jwtAuthCheck.bind(this)))

    // define how to seralize a user (to be put into the session)
    passport.serializeUser(function (user, cb) {
      process.nextTick(function () {
        // only store username and id to session
        // TODO: do we want to store more info in the session?
        return cb(null, JSON.stringify({
          "username": user.username,
          "id": user.id,
          "email": user.email,
        }))
      })
    })

    // define how to deseralize a user (use the username to get it from the database)
    passport.deserializeUser((function (user, cb) {
      process.nextTick((async function () {
        const parsedUserInfo = JSON.parse(user)
        // TODO: do the matching on username or better on id?
        const dbUser = await Database.userModel.getUserByUsername(parsedUserInfo.username.toLowerCase())
        return cb(null, dbUser)
      }).bind(this))
    }).bind(this))
  }

  /**
   * Creates all (express) routes required for authentication.
   * @param {express.Router} router 
   */
  initAuthRoutes(router) {
    // Local strategy login route (takes username and password)
    router.post('/login', passport.authenticate('local'),
      (async function (req, res) {
        // return the user login response json if the login was successfull
        res.json(await this.getUserLoginResponsePayload(req.user))
      }).bind(this)
    )

    // google-oauth20 strategy login route (this redirects to the google login)
    router.get('/auth/google', (req, res, next) => {
      const auth_func = passport.authenticate('google', { scope: ['email'] })
      if (!req.query.callback || req.query.callback === "") {
        res.status(400).send({
          message: 'No callback parameter'
        })
        return
      }
      res.cookie('auth_cb', req.query.callback, {
        maxAge: 120000 * 120, // Hack - this semms to be in UTC??
        httpOnly: true
      })
      auth_func(req, res, next);
    })

    // google-oauth20 strategy callback route (this receives the token from google)
    router.get('/auth/google/callback',
      passport.authenticate('google'),
      (async function (req, res) {
        // return the user login response json if the login was successfull
        var data_json = await this.getUserLoginResponsePayload(req.user)
        // res.json(data_json)
        // TODO: do we want to somehow limit the values for auth_cb?
        if (req.cookies.auth_cb) {
          res.redirect(302, `${req.cookies.auth_cb}?setToken=${data_json.user.token}`)
        }
        else {
          res.status(400).send("No callback or already expired")
        }
      }).bind(this)
    )

    // openid strategy login route (this redirects to the configured openid login provider)
    router.get('/auth/openid', (req, res, next) => {
      const auth_func = passport.authenticate('openidconnect')
      if (!req.query.callback || req.query.callback === "") {
        res.status(400).send({
          message: 'No callback parameter'
        })
        return
      }
      res.cookie('auth_cb', req.query.callback, {
        maxAge: 120000 * 120, // Hack - this semms to be in UTC??
        httpOnly: true
      })
      auth_func(req, res, next);
    })

    // openid strategy callback route (this receives the token from the configured openid login provider)
    router.get('/auth/openid/callback',
      passport.authenticate('openidconnect'),
      (async function (req, res) {
        // return the user login response json if the login was successfull
        var data_json = await this.getUserLoginResponsePayload(req.user)
        // res.json(data_json)
        if (req.cookies.auth_cb) {
          res.redirect(302, `${req.cookies.auth_cb}?setToken=${data_json.user.token}`)
        }
        else {
          res.status(400).send("No callback or already expired")
        }
      }).bind(this)
    )

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
   * @param {express.Request} req 
   * @param {express.Response} res 
   * @param {express.NextFunction} next  
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
   * Function to generate a jwt token for a given user.
   * @param {Object} user 
   * @returns the token.
   */
  generateAccessToken(user) {
    return jwt.sign({ userId: user.id, username: user.username }, global.ServerSettings.tokenSecret)
  }

  /**
   * Function to generate a jwt token for a given user.
   * @param {string} token 
   * @returns the tokens data.
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
   * Generate a token for each user.
   */
  async initTokenSecret() {
    if (process.env.TOKEN_SECRET) { // User can supply their own token secret
      this.db.serverSettings.tokenSecret = process.env.TOKEN_SECRET
    } else {
      this.db.serverSettings.tokenSecret = require('crypto').randomBytes(256).toString('base64')
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
  jwtAuthCheck(jwt_payload, done) {
    const user = Database.userModel.getUserByUsername(jwt_payload.username.toLowerCase())

    if (!user || !user.isActive) {
      done(null, null)
      return
    }
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
    const user = Database.userModel.getUserByUsername(username.toLowerCase())

    if (!user || !user.isActive) {
      done(null, null)
      return
    }

    // Check passwordless root user
    if (user.id === 'root' && (!user.pash || user.pash === '')) {
      if (password) {
        done(null, null)
        return
      }
      done(null, user)
      return
    }

    // Check password match
    const compare = await bcrypt.compare(password, user.pash)
    if (compare) {
      done(null, user)
      return
    }
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
   * Return the login info payload for a user.
   * @param {string} username 
   * @returns {string} jsonPayload
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