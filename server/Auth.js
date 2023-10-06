const uuidv4 = require("uuid").v4
const bcrypt = require('./libs/bcryptjs')
const jwt = require('./libs/jsonwebtoken')
const requestIp = require('./libs/requestIp')

const Logger = require('./Logger')
const Database = require('./Database')
const User = require('./objects/user/User')

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
    const users = await Database.userModel.getOldUsers()
    if (users.length) {
      for (const user of users) {
        user.token = await this.generateAccessToken({ userId: user.id, username: user.username })
        Logger.warn(`[Auth] User ${user.username} api token has been updated using new token secret`)
      }
      await Database.updateBulkUsers(users)
    }
  }

  async authMiddleware(req, res, next) {
    var token = null
    var proxyAccount = this.getProxyAccount(req.headers)

    // If using a get request, the token can be passed as a query string
    if (req.method === 'GET' && req.query && req.query.token) {
      token = req.query.token
    } else {
      const authHeader = req.headers['authorization']
      token = authHeader && authHeader.split(' ')[1]
    }

    if (token == null && !(proxyAccount && proxyAccount['username'])) {
      Logger.error('Api called without a token and no proxy auth provided', req.path)
      return res.sendStatus(401)
    }

    let user
    if (token) {
      user = await this.verifyToken(token)
      if (!user) {
        Logger.error('Verify Token User Not Found', token)
        return res.sendStatus(401)
      }

      user.isFromProxy = false
    } else if (proxyAccount) {
      user = await this.getProxyUser(proxyAccount)
      if (!user) {
        Logger.error('Cannot get user from proxy headers', proxyUsername)
        return res.sendStatus(401)
      }

      user.isFromProxy = true
    }

    // if we got here, we should have a valid user in `user`
    if (!user) {
      Logger.error('Unknown error getting user')
      return res.sendStatus(401)
    }

    // is the user active
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

  async authenticateUser(token, headers) {
    const tokenUser = token ? await this.verifyToken(token) : null
    if (tokenUser) return tokenUser

    const proxyAccount = this.getProxyAccount(headers)
    if (proxyAccount && proxyAccount.username) {
      const proxyUser = await this.getProxyUser(proxyAccount)
      if (proxyUser) {
        proxyUser.isFromProxy = true;
        return proxyUser;
      }
    }

    return null
  }

  verifyToken(token) {
    return new Promise((resolve) => {
      jwt.verify(token, Database.serverSettings.tokenSecret, async (err, payload) => {
        if (!payload || err) {
          Logger.error('JWT Verify Token Failed', err)
          return resolve(null)
        }

        const user = await Database.userModel.getUserByIdOrOldId(payload.userId)
        if (user && user.username === payload.username) {
          resolve(user)
        } else {
          resolve(null)
        }
      })
    })
  }

  getProxyAccount(headers) {
    if (!Database.serverSettings.proxyAuthEnabled) return null

    const uHeader = Database.serverSettings.proxyAuthUsernameHeader.toLowerCase()
    const eHeader = Database.serverSettings.proxyAuthEmailHeader.toLowerCase()

    return {
      username: uHeader ? headers[uHeader] : null,
      email: eHeader ? headers[eHeader] : null,
    }
  }

  async getProxyUser(account) {
    const user = await Database.userModel.getUserByUsername(account.username)
    if (user) return user;

    // we need an email to create accounts
    if (!account.email) return null;

    // add some fields for proxy users
    account = {
      ...account,
      type: 'user',
      isActive: true,
    }

    return await this.createUser(account)
  }

  // create and return a new user from an object with lots of user properties defined
  async createUser(account) {
    const username = account.username
    const usernameExists = await Database.userModel.getUserByUsername(username)
    if (usernameExists) {
      return null
    }

    account.id = uuidv4()

    const password = account.password || uuidv4()
    delete account.password

    account.pash = await this.hashPass(password)
    account.token = await this.generateAccessToken({ userId: account.id, username })
    account.createdAt = Date.now()
    const newUser = new User(account)

    const success = await Database.createUser(newUser)
    return success ? await Database.userModel.getUserById(newUser.id) : null
  }

  /**
   * Payload returned to a user after successful login
   * @param {oldUser} user
   * @returns {object}
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

  async login(req, res) {
    const ipAddress = requestIp.getClientIp(req)
    const username = (req.body.username || '').toLowerCase()
    const password = req.body.password || ''

    const user = await Database.userModel.getUserByUsername(username)

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
        const userLoginResponsePayload = await this.getUserLoginResponsePayload(user)
        return res.json(userLoginResponsePayload)
      }
    }

    // Check password match
    const compare = await bcrypt.compare(password, user.pash)
    if (compare) {
      Logger.info(`[Auth] ${user.username} logged in from ${ipAddress}`)
      const userLoginResponsePayload = await this.getUserLoginResponsePayload(user)
      res.json(userLoginResponsePayload)
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
    const matchingUser = await Database.userModel.getUserById(req.user.id)

    // Only root can have an empty password
    if (matchingUser.type !== 'root' && !newPassword) {
      return res.json({
        error: 'Invalid new password - Only root can have an empty password'
      })
    }

    // proxy users can change their password without knowing their old password
    const compare = await this.comparePassword(password, matchingUser)
    if (!compare && !req.user.isFromProxy) {
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
