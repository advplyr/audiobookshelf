const { expect } = require('chai')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const jwt = require('../../../server/libs/jsonwebtoken')

// Database → Auth → TokenManager circular require can leave TokenManager with a partial Database reference; reload before each test
function loadTokenManager() {
  delete require.cache[require.resolve('../../../server/auth/TokenManager')]
  return require('../../../server/auth/TokenManager')
}

describe('TokenManager', () => {
  const secret = 'test-jwt-secret'
  const userId = 'user-uuid-1'
  let TokenManager
  let tokenManager

  beforeEach(() => {
    TokenManager = loadTokenManager()
    TokenManager.TokenSecret = secret
    tokenManager = new TokenManager()
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('validateAccessToken', () => {
    it('rejects refresh tokens', () => {
      const refreshToken = jwt.sign({ userId, type: 'refresh' }, secret, { expiresIn: 3600 })
      expect(TokenManager.validateAccessToken(refreshToken)).to.equal(null)
    })

    it('accepts access tokens', () => {
      const accessToken = jwt.sign({ userId, type: 'access' }, secret, { expiresIn: 3600 })
      const decoded = TokenManager.validateAccessToken(accessToken)
      expect(decoded.userId).to.equal(userId)
      expect(decoded.type).to.equal('access')
    })
  })

  describe('jwtAuthCheck', () => {
    const user = { id: userId, username: 'testuser', isActive: true }

    it('rejects refresh tokens for API auth', async () => {
      const refreshToken = tokenManager.generateRefreshToken(user)
      const decoded = jwt.verify(refreshToken, secret)
      const done = sinon.spy()

      await tokenManager.jwtAuthCheck(decoded, done)

      expect(done.calledWith(null, null)).to.be.true
    })

    it('allows access tokens for active users', async () => {
      sinon.stub(Database, 'userModel').get(() => ({
        getUserByIdOrOldId: sinon.stub().resolves(user)
      }))
      const decoded = jwt.verify(tokenManager.generateTempAccessToken(user), secret)
      const done = sinon.spy()

      await tokenManager.jwtAuthCheck(decoded, done)

      expect(done.calledWith(null, user)).to.be.true
    })
  })
})
