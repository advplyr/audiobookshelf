const { expect } = require('chai')
const sinon = require('sinon')
const { Op } = require('sequelize')

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

  describe('invalidateJwtSessionsForUser', () => {
    const targetUser = { id: userId, username: 'testuser' }
    const currentSession = {
      id: 'session-current',
      userId,
      refreshToken: 'refresh-current'
    }

    /** Minimal req/res for session invalidation (ApiRouter provides auth on real requests). */
    function makeReq({ requestUserId = userId, refreshToken = null, cookieRefreshToken = null } = {}) {
      return {
        user: { id: requestUserId },
        cookies: cookieRefreshToken ? { refresh_token: cookieRefreshToken } : {},
        headers: refreshToken ? { 'x-refresh-token': refreshToken } : {}
      }
    }

    let sessionFindOne
    let sessionDestroy
    let rotateStub

    beforeEach(() => {
      sessionFindOne = sinon.stub().resolves(currentSession)
      sessionDestroy = sinon.stub().resolves(1)
      sinon.stub(Database, 'sessionModel').get(() => ({
        findOne: sessionFindOne,
        destroy: sessionDestroy
      }))
      rotateStub = sinon.stub(tokenManager, 'rotateTokensForSession').resolves({
        accessToken: 'access-new',
        refreshToken: 'refresh-new'
      })
    })

    it('self password change: keeps current session, deletes others', async () => {
      const req = makeReq({ refreshToken: 'refresh-current' })
      const res = { cookie: sinon.spy() }

      const result = await tokenManager.invalidateJwtSessionsForUser(targetUser, req, res)

      // Found this device's session using the x-refresh-token header
      expect(sessionFindOne.calledOnce).to.be.true
      const findWhere = sessionFindOne.firstCall.args[0].where
      expect(findWhere.userId).to.equal(userId)
      expect(findWhere[Op.or]).to.deep.equal([{ refreshToken: 'refresh-current' }, { lastRefreshToken: 'refresh-current' }])

      // Rotated in place (no grace period) so the caller keeps a valid session
      expect(rotateStub.calledOnceWith(currentSession, targetUser, req, res, false)).to.be.true

      // Deleted all other sessions, but not this one
      expect(sessionDestroy.calledOnce).to.be.true
      const destroyWhere = sessionDestroy.firstCall.args[0].where
      expect(destroyWhere.userId).to.equal(userId)
      expect(destroyWhere.id[Op.ne]).to.equal(currentSession.id)

      expect(result).to.deep.equal({ accessToken: 'access-new', refreshToken: 'refresh-new' })
    })

    it('admin password reset: deletes all target sessions', async () => {
      const req = makeReq({ requestUserId: 'admin-id', refreshToken: 'refresh-current' })
      const res = { cookie: sinon.spy() }

      const result = await tokenManager.invalidateJwtSessionsForUser(targetUser, req, res)

      // Token rotation did not happen because target is a different user
      expect(sessionFindOne.called).to.be.false
      expect(rotateStub.called).to.be.false

      expect(sessionDestroy.calledOnceWith(sinon.match({ where: { userId } }))).to.be.true
      expect(result).to.equal(null)
    })
  })
})
