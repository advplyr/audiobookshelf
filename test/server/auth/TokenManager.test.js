const chai = require('chai')
const sinon = require('sinon')
const { expect } = chai

// Require Database before TokenManager to resolve the Database -> Auth -> TokenManager
// require cycle (otherwise requiring TokenManager first yields an incomplete export).
require('../../../server/Database')
const Logger = require('../../../server/Logger')
const TokenManager = require('../../../server/auth/TokenManager')

describe('TokenManager', () => {
  describe('refresh token grace period configuration', () => {
    let loggerInfoStub
    const originalEnv = process.env.REFRESH_TOKEN_GRACE_PERIOD

    beforeEach(() => {
      loggerInfoStub = sinon.stub(Logger, 'info')
      delete process.env.REFRESH_TOKEN_GRACE_PERIOD
    })

    afterEach(() => {
      loggerInfoStub.restore()
      if (originalEnv === undefined) delete process.env.REFRESH_TOKEN_GRACE_PERIOD
      else process.env.REFRESH_TOKEN_GRACE_PERIOD = originalEnv
    })

    it('defaults to 10 minutes (600 seconds) when the env var is not set', () => {
      const tokenManager = new TokenManager()
      expect(tokenManager.RefreshTokenGracePeriod).to.equal(600)
    })

    it('reads a positive value from REFRESH_TOKEN_GRACE_PERIOD (in seconds)', () => {
      process.env.REFRESH_TOKEN_GRACE_PERIOD = '300'
      const tokenManager = new TokenManager()
      expect(tokenManager.RefreshTokenGracePeriod).to.equal(300)
      expect(loggerInfoStub.calledWithMatch(/grace period set from ENV/i)).to.equal(true)
    })

    it('falls back to the default for a non-positive or invalid value', () => {
      process.env.REFRESH_TOKEN_GRACE_PERIOD = '0'
      expect(new TokenManager().RefreshTokenGracePeriod).to.equal(600)

      process.env.REFRESH_TOKEN_GRACE_PERIOD = 'not-a-number'
      expect(new TokenManager().RefreshTokenGracePeriod).to.equal(600)
    })

    it('does not log the ENV override message when the env var is unset', () => {
      new TokenManager()
      expect(loggerInfoStub.calledWithMatch(/grace period set from ENV/i)).to.equal(false)
    })
  })
})
