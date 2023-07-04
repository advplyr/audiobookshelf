const bcrypt = require('./libs/bcryptjs')
const jwt = require('./libs/jsonwebtoken')
const requestIp = require('./libs/requestIp')
const Logger = require('./Logger')
const Database = require('./Database')

class Auth {
  constructor() { }

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
        user.token = await this.generateAccessToken({ userId: user.id, username: user.username })
        Logger.warn(`[Auth] User ${user.username} api token has been updated using new token secret`)
      }
      await Database.updateBulkUsers(Database.users)
    }
  }

  async authMiddleware(req, res, next) {
    var token = null

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

  getUserLoginResponsePayload(user) {
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

    const user = Database.users.find(u => u.username.toLowerCase() === username)

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
        return res.json(this.getUserLoginResponsePayload(user))
      }
    }

    // Check password match
    const compare = await bcrypt.compare(password, user.pash)
    if (compare) {
      Logger.info(`[Auth] ${user.username} logged in from ${ipAddress}`)
      res.json(this.getUserLoginResponsePayload(user))
    } else {
      Logger.warn(`[Auth] Failed login attempt ${req.rateLimit.current} of ${req.rateLimit.limit} from ${ipAddress}`)
      if (req.rateLimit.remaining <= 2) {
        Logger.error(`[Auth] Failed login attempt for user ${user.username} from ip ${ipAddress}. Attempts: ${req.rateLimit.current}`)
        return res.status(401).send(`Invalid user or password (${req.rateLimit.remaining === 0 ? '1 attempt remaining' : `${req.rateLimit.remaining + 1} attempts remaining`})`)
      }
      return res.status(401).send('Invalid user or password')
    }
  }

  comparePassword(password, user) {
    if (user.type === 'root' && !password && !user.pash) return true
    if (!password || !user.pash) return false
    return bcrypt.compare(password, user.pash)
  }

  async userChangePassword(req, res) {
    var { password, newPassword } = req.body
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