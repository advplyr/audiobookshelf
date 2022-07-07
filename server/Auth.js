const bcrypt = require('./libs/bcryptjs')
const jwt = require('./libs/jsonwebtoken')
const Logger = require('./Logger')

class Auth {
  constructor(db) {
    this.db = db

    this.user = null
  }

  get username() {
    return this.user ? this.user.username : 'nobody'
  }

  get users() {
    return this.db.users
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

    var user = await this.verifyToken(token)
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
    return jwt.sign(payload, process.env.TOKEN_SECRET);
  }

  authenticateUser(token) {
    return this.verifyToken(token)
  }

  verifyToken(token) {
    return new Promise((resolve) => {
      jwt.verify(token, process.env.TOKEN_SECRET, (err, payload) => {
        if (!payload || err) {
          Logger.error('JWT Verify Token Failed', err)
          return resolve(null)
        }
        var user = this.users.find(u => u.id === payload.userId)
        resolve(user || null)
      })
    })
  }

  getUserLoginResponsePayload(user) {
    return {
      user: user.toJSONForBrowser(),
      userDefaultLibraryId: user.getDefaultLibraryId(this.db.libraries),
      serverSettings: this.db.serverSettings.toJSON(),
      Source: global.Source
    }
  }

  async login(req, res) {
    var username = (req.body.username || '').toLowerCase()
    var password = req.body.password || ''

    var user = this.users.find(u => u.username.toLowerCase() === username)

    if (!user || !user.isActive) {
      Logger.debug(`[Auth] Failed login attempt ${req.rateLimit.current} of ${req.rateLimit.limit}`)
      if (req.rateLimit.remaining <= 2) {
        return res.status(401).send(`Invalid user or password (${req.rateLimit.remaining === 0 ? '1 attempt remaining' : `${req.rateLimit.remaining + 1} attempts remaining`})`)
      }
      return res.status(401).send('Invalid user or password')
    }

    // Check passwordless root user
    if (user.id === 'root' && (!user.pash || user.pash === '')) {
      if (password) {
        return res.status(401).send('Invalid root password (hint: there is none)')
      } else {
        return res.json(this.getUserLoginResponsePayload(user))
      }
    }

    // Check password match
    var compare = await bcrypt.compare(password, user.pash)
    if (compare) {
      res.json(this.getUserLoginResponsePayload(user))
    } else {
      Logger.debug(`[Auth] Failed login attempt ${req.rateLimit.current} of ${req.rateLimit.limit}`)
      if (req.rateLimit.remaining <= 2) {
        Logger.error(`[Auth] Failed login attempt for user ${user.username}. Attempts: ${req.rateLimit.current}`)
        return res.status(401).send(`Invalid user or password (${req.rateLimit.remaining === 0 ? '1 attempt remaining' : `${req.rateLimit.remaining + 1} attempts remaining`})`)
      }
      return res.status(401).send('Invalid user or password')
    }
  }

  // Not in use now
  lockUser(user) {
    user.isLocked = true
    return this.db.updateEntity('user', user).catch((error) => {
      Logger.error('[Auth] Failed to lock user', user.username, error)
      return false
    })
  }

  comparePassword(password, user) {
    if (user.type === 'root' && !password && !user.pash) return true
    if (!password || !user.pash) return false
    return bcrypt.compare(password, user.pash)
  }

  async userChangePassword(req, res) {
    var { password, newPassword } = req.body
    newPassword = newPassword || ''
    var matchingUser = this.users.find(u => u.id === req.user.id)

    // Only root can have an empty password
    if (matchingUser.type !== 'root' && !newPassword) {
      return res.json({
        error: 'Invalid new password - Only root can have an empty password'
      })
    }

    var compare = await this.comparePassword(password, matchingUser)
    if (!compare) {
      return res.json({
        error: 'Invalid password'
      })
    }

    var pw = ''
    if (newPassword) {
      pw = await this.hashPass(newPassword)
      if (!pw) {
        return res.json({
          error: 'Hash failed'
        })
      }
    }

    matchingUser.pash = pw
    var success = await this.db.updateEntity('user', matchingUser)
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