const bcrypt = require('./libs/bcryptjs')
const ldap = require('./authProviders/ldap')
const jwt = require('./libs/jsonwebtoken')
const requestIp = require('./libs/requestIp')
const User = require('./objects/user/User')
const { getId } = require('./utils')
const Logger = require('./Logger')
const Database = require('./Database')

class Auth {
  
  constructor() {
    if (global.ldapEnabled) {
      this.ldap = ldap
    }
    this.user = null
  }

  get username() {
    return this.user ? this.user.username : 'nobody'
  }

  get users() {
    return Database.users
  }

  cors(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*')
    res.header("Access-Control-Allow-Methods", 'GET, POST, PATCH, PUT, DELETE, OPTIONS')
    res.header('Access-Control-Allow-Headers', '*')
    // TODO: Make sure allowing all headers is not a security concern. It is required for adding custom headers for SSO
    // res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Accept-Encoding, Range, Authorization")
    res.header('Access-Control-Allow-Credentials', true)
    if (req.method === 'OPTIONS') {
      res.sendStatus(200)
    } else {
      next()
    }
  }

  async initTokenSecret() {
    if (process.env.TOKEN_SECRET) { // User can supply their own token secret
      Logger.debug(`[Auth] Setting token secret - using user passed in TOKEN_SECRET env var`)
      Database.serverSettings.tokenSecret = process.env.TOKEN_SECRET
    } else {
      Logger.debug(`[Auth] Setting token secret - using random bytes`)
      Database.serverSettings.tokenSecret = require('crypto').randomBytes(256).toString('base64')
    }
    await Database.updateServerSettings()

    // New token secret creation added in v2.1.0 so generate new API tokens for each user
    if (Database.users.length) {
      for (const user of Database.users) {
        if (user.token) {
          delete user.token
        }
        //Tokens should never be stored on the server, the entire point is that the server can cryptographically verify the token without storing it
        Logger.warn(`[Auth] User ${user.username} api token security hole has been removed`)
      }
      await Database.updateBulkUsers(Database.users)
    }
  }

  async authMiddleware(req, res, next) {
    let token = null

    // If using a get request, the token can be passed as a query string
    if (req.method === 'GET' && req.query && req.query.token) {
      token = req.query.token
    } else {
      const authHeader = req.headers['authorization']
      token = authHeader && authHeader.split(' ')[1]
    }

    if (token == null) {
      Logger.error('Api called without a token', req.path)
      return res.sendStatus(401)
    }

    const user = await this.verifyToken(token)
    if (!user) {
      Logger.error('Verify Token User Not Found', token)
      return res.sendStatus(404)
    }
    if (!user.isActive) {
      Logger.error('Verify Token User is disabled', token, user.username)
      return res.sendStatus(403)
    }
    req.user = user
    next()
  }

  hashPass(password) {
    return new Promise((resolve) => {
      bcrypt.hash(password, 8, (err, hash) => {
        if (err) {
          Logger.error('Hash failed', err)
          resolve(null)
        } else {
          resolve(hash)
        }
      })
    })
  }

  generateAccessToken(payload) {
    return jwt.sign(payload, Database.serverSettings.tokenSecret)
  }

  authenticateUser(token) {
    return this.verifyToken(token)
  }

  verifyToken(token) {
    return new Promise((resolve) => {
      jwt.verify(token, Database.serverSettings.tokenSecret, (err, payload) => {
        if (!payload || err) {
          Logger.error('JWT Verify Token Failed', err)
          return resolve(null)
        }
        const user = Database.users.find(u => (u.id === payload.userId || u.oldUserId === payload.userId) && u.username === payload.username)
        resolve(user || null)
      })
    })
  }

  async getLdapUsers() {
    if (this.ldap) {
      const ldapUsers = await this.ldap.findAllUsers();
      return ldapUsers;
    } else {
      return [];
    }
  }
  async getUserLoginResponsePayload(user) {
    user.token = await this.generateAccessToken({ userId: user.id, username: user.username });
    return {
      user: user.toJSONForBrowser(),
      userDefaultLibraryId: user.getDefaultLibraryId(Database.libraries),
      serverSettings: Database.serverSettings.toJSONForBrowser(),
      ereaderDevices: Database.emailSettings.getEReaderDevices(user),
      Source: global.Source
    }
  }

  async login(req, res) {
    const ipAddress = requestIp.getClientIp(req)
    const username = (req.body.username || '').toLowerCase()
    const password = req.body.password || ''

    let user = Database.users.find(u => u.username.toLowerCase() === username)
    if (!user && this.ldap) {
      Logger.warn(`[Auth] Could not find user in database from ${ipAddress}, checking LDAP...`)
      const ldapUsers = await this.getLdapUsers()
      Logger.debug(ldapUsers);
      if (ldapUsers.filter(u => u[global.ldapUsernameAttribute].toLowerCase() == username.toLowerCase())) {
        const ldapUser = ldapUsers.find(v => v[global.ldapUsernameAttribute].toLowerCase() == username.toLowerCase())
        const newUser = new User({
          username: ldapUser[global.ldapUsernameAttribute],
          id: getId('usr'),
          isActive: true,
          isLocked: false,
          librariesAccessible: [],
          itemTagsAccessible: [],
          type: 'ldap'
        })
        const success = await Database.insertEntity('user', newUser)
        if (success) {
          user = Database.users.find(u => u.username.toLowerCase() === username)
        }
      }
    }

    if (!user?.isActive) {
      Logger.warn(`[Auth] Failed login attempt ${req.rateLimit.current} of ${req.rateLimit.limit} from ${ipAddress}`)
      if (req.rateLimit.remaining <= 2) {
        Logger.error(`[Auth] Failed login attempt for username ${username} from ip ${ipAddress}. Attempts: ${req.rateLimit.current}`)
        return res.status(401).send(`Invalid user or password (${req.rateLimit.remaining === 0 ? '1 attempt remaining' : `${req.rateLimit.remaining + 1} attempts remaining`})`)
      }
      return res.status(401).send('Invalid user or password')
    }

    // Check passwordless root user
    if (user.type === 'root' && (!user.pash || user.pash === '')) {
      if (password) {
        return res.status(401).send('Invalid root password (hint: there is none)')
      } else {
        Logger.info(`[Auth] ${user.username} logged in from ${ipAddress}`)
        return res.json(await this.getUserLoginResponsePayload(user))
      }
    }

    if (!user.pash || user.pash === '') {
      // Check LDAP for user.

      const ldapUsers = await this.getLdapUsers()
      const ldapUser = ldapUsers.find(v => v[global.ldapUsernameAttribute].toLowerCase() == username.toLowerCase())
      if (ldapUser != null) {
        const adUserName = ldapUser.dn
        const authResult = await this.ldap.authenticateUser(adUserName, password);
        if (authResult) {
          res.json(await this.getUserLoginResponsePayload(user))
        } else {
          Logger.warn(`[Auth] Failed login attempt ${req.rateLimit.current} of ${req.rateLimit.limit} from ${ipAddress}`)
          if (req.rateLimit.remaining <= 2) {
            Logger.error(`[Auth] Failed login attempt for user ${user.username} from ip ${ipAddress}. Attempts: ${req.rateLimit.current}`)
            return res.status(401).send(`Invalid user or password (${req.rateLimit.remaining === 0 ? '1 attempt remaining' : `${req.rateLimit.remaining + 1} attempts remaining`})`)
          }
          return res.status(401).send('Invalid user or password')
        }
      } else {
        return res.status(401).send('Invalid user or password')
      }

    } else {
      // Check password match
      const compare = await bcrypt.compare(password, user.pash)
      if (compare) {
        Logger.info(`[Auth] ${user.username} logged in from ${ipAddress}`)
        res.json(await this.getUserLoginResponsePayload(user))
      } else {
        Logger.warn(`[Auth] Failed login attempt ${req.rateLimit.current} of ${req.rateLimit.limit} from ${ipAddress}`)
        if (req.rateLimit.remaining <= 2) {
          Logger.error(`[Auth] Failed login attempt for user ${user.username} from ip ${ipAddress}. Attempts: ${req.rateLimit.current}`)
          return res.status(401).send(`Invalid user or password (${req.rateLimit.remaining === 0 ? '1 attempt remaining' : `${req.rateLimit.remaining + 1} attempts remaining`})`)
        }
        return res.status(401).send('Invalid user or password')
      }
    }
  }

  comparePassword(password, user) {
    if (user.type === 'root' && !password && !user.pash) return true
    if (!password || !user.pash) return false
    return bcrypt.compare(password, user.pash)
  }

  async userChangePassword(req, res) {
    const { password, newPassword } = req.body
    newPassword = newPassword || ''
    const matchingUser = Database.users.find(u => u.id === req.user.id)

    // Only root can have an empty password
    if (matchingUser.type !== 'root' && !newPassword) {
      return res.json({
        error: 'Invalid new password - Only root can have an empty password'
      })
    }

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