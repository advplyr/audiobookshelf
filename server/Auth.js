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
      Logger.error('Api called without a token')
      return res.sendStatus(401)
    }

    var user = await this.verifyToken(token)
    if (!user) {
      Logger.error('Verify Token User Not Found', token)
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
    return jwt.sign(payload, process.env.TOKEN_SECRET, { expiresIn: '1800s' });
  }

  verifyToken(token) {
    return new Promise((resolve) => {
      jwt.verify(token, process.env.TOKEN_SECRET, (err, payload) => {
        var user = this.users.find(u => u.id === payload.userId)
        resolve(user || null)
      })
    })
  }

  async login(req, res) {
    var username = req.body.username
    var password = req.body.password || ''
    Logger.debug('Check Auth', username, !!password)

    var user = this.users.find(u => u.id === username)

    if (!user) {
      return res.json({ error: 'User not found' })
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

  async checkAuth(req, res) {
    var username = req.body.username
    Logger.debug('Check Auth', username, !!req.body.password)

    var matchingUser = this.users.find(u => u.username === username)
    if (!matchingUser) {
      return res.json({
        error: 'User not found'
      })
    }

    var cleanedUser = { ...matchingUser }
    delete cleanedUser.pash

    // check for empty password (default)
    if (!req.body.password) {
      if (!matchingUser.pash) {
        res.cookie('user', username, { signed: true })
        return res.json({
          user: cleanedUser
        })
      } else {
        return res.json({
          error: 'Invalid Password'
        })
      }
    }

    // Set root password first time
    if (matchingUser.type === 'root' && !matchingUser.pash && req.body.password && req.body.password.length > 1) {
      console.log('Set root pash')
      var pw = await this.hashPass(req.body.password)
      if (!pw) {
        return res.json({
          error: 'Hash failed'
        })
      }
      this.users = this.users.map(u => {
        if (u.username === matchingUser.username) {
          u.pash = pw
        }
        return u
      })
      await this.saveAuthDb()
      return res.json({
        setroot: true,
        user: cleanedUser
      })
    }

    var compare = await bcrypt.compare(req.body.password, matchingUser.pash)
    if (compare) {
      res.cookie('user', username, { signed: true })
      res.json({
        user: cleanedUser
      })
    } else {
      res.json({
        error: 'Invalid Password'
      })
    }
  }
}
module.exports = Auth