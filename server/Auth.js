const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
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

  init() {
    var root = this.users.find(u => u.type === 'root')
    if (!root) {
      Logger.fatal('No Root User', this.users)
      throw new Error('No Root User')
    }
  }

  cors(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*')
    res.header("Access-Control-Allow-Methods", 'GET, POST, PATCH, PUT, DELETE, OPTIONS')
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization")
    res.header('Access-Control-Allow-Credentials', true)
    if (req.method === 'OPTIONS') {
      res.sendStatus(200)
    } else {
      next()
    }
  }

  async authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]
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

  async login(req, res) {
    var username = req.body.username
    var password = req.body.password || ''
    Logger.debug('Check Auth', username, !!password)

    var user = this.users.find(u => u.username === username)

    if (!user) {
      return res.json({ error: 'User not found' })
    }

    if (!user.isActive) {
      return res.json({ error: 'User unavailable' })
    }

    // Check passwordless root user
    if (user.id === 'root' && (!user.pash || user.pash === '')) {
      if (password) {
        return res.json({ error: 'Invalid root password (hint: there is none)' })
      } else {
        return res.json({ user: user.toJSONForBrowser() })
      }
    }

    // Check password match
    var compare = await bcrypt.compare(password, user.pash)
    if (compare) {
      res.json({
        user: user.toJSONForBrowser()
      })
    } else {
      res.json({
        error: 'Invalid Password'
      })
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