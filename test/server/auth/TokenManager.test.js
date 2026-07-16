const { expect } = require('chai')
const sinon = require('sinon')
const { Sequelize } = require('sequelize')

const Database = require('../../../server/Database')
const jwt = require('../../../server/libs/jsonwebtoken')

// TokenManager is first loaded via Database → Auth → TokenManager while Database is still
// initializing, so it can capture a stale Database reference. Reload after Database is ready.
function loadTokenManager() {
  delete require.cache[require.resolve('../../../server/auth/TokenManager')]
  return require('../../../server/auth/TokenManager')
}

describe('TokenManager', () => {
  const secret = 'test-jwt-secret'
  let TokenManager
  let tokenManager

  beforeEach(() => {
    TokenManager = loadTokenManager()
    TokenManager.TokenSecret = secret
    tokenManager = new TokenManager()
  })

  describe('isBearerAccessTokenPayload', () => {
    const userId = 'user-uuid-1'

    it('rejects refresh tokens', () => {
      expect(TokenManager.isBearerAccessTokenPayload({ userId, type: 'refresh' })).to.equal(false)
    })

    it('accepts access tokens', () => {
      expect(TokenManager.isBearerAccessTokenPayload({ userId, type: 'access' })).to.equal(true)
    })

    it('accepts legacy tokens without type', () => {
      expect(TokenManager.isBearerAccessTokenPayload({ userId })).to.equal(true)
    })

    it('rejects payloads without userId', () => {
      expect(TokenManager.isBearerAccessTokenPayload({ type: 'access' })).to.equal(false)
    })
  })

  describe('validateAccessToken', () => {
    const userId = 'user-uuid-1'

    it('returns null for a refresh token', () => {
      const refreshToken = jwt.sign({ userId, type: 'refresh' }, secret, { expiresIn: 3600 })
      expect(TokenManager.validateAccessToken(refreshToken)).to.equal(null)
    })

    it('returns decoded payload for an access token', () => {
      const accessToken = jwt.sign({ userId, type: 'access' }, secret, { expiresIn: 3600 })
      const decoded = TokenManager.validateAccessToken(accessToken)
      expect(decoded.userId).to.equal(userId)
      expect(decoded.type).to.equal('access')
    })

    it('returns decoded payload for a legacy token without type', () => {
      const legacyToken = jwt.sign({ userId, username: 'testuser' }, secret)
      const decoded = TokenManager.validateAccessToken(legacyToken)
      expect(decoded.userId).to.equal(userId)
      expect(decoded.type).to.equal(undefined)
    })
  })

  describe('jwtAuthCheck', () => {
    let user

    beforeEach(async () => {
      Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
      Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
      await Database.buildModels()

      user = await Database.userModel.create({
        username: 'tokenuser',
        pash: 'hash',
        token: 'legacy-token',
        type: 'user',
        isActive: true,
        permissions: Database.userModel.getDefaultPermissionsForUserType('user'),
        bookmarks: [],
        extraData: {}
      })
    })

    afterEach(async () => {
      if (Database.sequelize) {
        await Database.sequelize.sync({ force: true })
        Database.sequelize = null
      }
      sinon.restore()
    })

    it('denies refresh tokens on resource authentication', async () => {
      const done = sinon.spy()
      const refreshToken = tokenManager.generateRefreshToken(user)
      const decoded = jwt.verify(refreshToken, secret)

      await tokenManager.jwtAuthCheck(decoded, done)

      expect(done.calledOnce).to.equal(true)
      expect(done.firstCall.args).to.deep.equal([null, null])
    })

    it('allows access tokens for active users', async () => {
      const done = sinon.spy()
      const accessToken = tokenManager.generateTempAccessToken(user)
      const decoded = jwt.verify(accessToken, secret)

      await tokenManager.jwtAuthCheck(decoded, done)

      expect(done.calledOnce).to.equal(true)
      expect(done.firstCall.args[1].id).to.equal(user.id)
    })

    it('allows legacy tokens without type for active users', async () => {
      const done = sinon.spy()
      const legacyToken = TokenManager.generateAccessToken({ id: user.id, username: user.username })
      const decoded = jwt.verify(legacyToken, secret)

      await tokenManager.jwtAuthCheck(decoded, done)

      expect(done.calledOnce).to.equal(true)
      expect(done.firstCall.args[1].id).to.equal(user.id)
      expect(done.firstCall.args[1].isOldToken).to.equal(true)
    })

    it('authenticates API keys via the api branch', async () => {
      const apiKey = await Database.apiKeyModel.create({
        name: 'test-key',
        userId: user.id,
        isActive: true,
        expiresAt: null
      })
      const apiToken = jwt.sign({ type: 'api', keyId: apiKey.id, exp: Math.floor(Date.now() / 1000) + 3600 }, secret)
      const decoded = jwt.verify(apiToken, secret)
      const done = sinon.spy()

      await tokenManager.jwtAuthCheck(decoded, done)

      expect(done.calledOnce).to.equal(true)
      expect(done.firstCall.args[1].id).to.equal(user.id)
    })
  })
})
