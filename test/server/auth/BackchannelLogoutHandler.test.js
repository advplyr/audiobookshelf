const { expect } = require('chai')
const sinon = require('sinon')

describe('BackchannelLogoutHandler', function () {
  let BackchannelLogoutHandler, handler
  let joseStub, DatabaseStub, SocketAuthorityStub

  const BACKCHANNEL_EVENT = 'http://schemas.openid.net/event/backchannel-logout'

  beforeEach(function () {
    // Clear require cache so we get fresh stubs each test
    delete require.cache[require.resolve('../../../server/auth/BackchannelLogoutHandler')]

    // Stub jose
    joseStub = {
      createRemoteJWKSet: sinon.stub().returns('jwks-function'),
      jwtVerify: sinon.stub()
    }

    // Stub Database
    DatabaseStub = {
      sessionModel: {
        destroy: sinon.stub().resolves(1)
      },
      userModel: {
        getUserByOpenIDSub: sinon.stub()
      }
    }

    // Stub SocketAuthority
    SocketAuthorityStub = {
      clientEmitter: sinon.stub()
    }

    // Set up global.ServerSettings
    global.ServerSettings = {
      authOpenIDJwksURL: 'https://idp.example.com/.well-known/jwks.json',
      authOpenIDIssuerURL: 'https://idp.example.com',
      authOpenIDClientID: 'my-client-id'
    }

    // Use proxyquire-style: intercept requires by replacing module cache entries
    const Module = require('module')
    const originalResolve = Module._resolveFilename
    const stubs = {
      jose: joseStub,
      '../Logger': { info: sinon.stub(), warn: sinon.stub(), error: sinon.stub(), debug: sinon.stub() },
      '../Database': DatabaseStub,
      '../SocketAuthority': SocketAuthorityStub
    }

    // Pre-populate the require cache with stubs
    const path = require('path')
    const handlerPath = require.resolve('../../../server/auth/BackchannelLogoutHandler')

    // We need to stub the dependencies before requiring the handler
    // Clear any cached versions of the dependencies
    const josePath = require.resolve('jose')
    const loggerPath = require.resolve('../../../server/Logger')
    const databasePath = require.resolve('../../../server/Database')
    const socketPath = require.resolve('../../../server/SocketAuthority')

    // Save original modules
    const originalJose = require.cache[josePath]
    const originalLogger = require.cache[loggerPath]
    const originalDatabase = require.cache[databasePath]
    const originalSocket = require.cache[socketPath]

    // Replace with stubs
    require.cache[josePath] = { id: josePath, exports: joseStub }
    require.cache[loggerPath] = { id: loggerPath, exports: stubs['../Logger'] }
    require.cache[databasePath] = { id: databasePath, exports: DatabaseStub }
    require.cache[socketPath] = { id: socketPath, exports: SocketAuthorityStub }

    // Now require the handler
    BackchannelLogoutHandler = require('../../../server/auth/BackchannelLogoutHandler')
    handler = new BackchannelLogoutHandler()

    // Store originals for cleanup
    this._originals = { josePath, loggerPath, databasePath, socketPath, originalJose, originalLogger, originalDatabase, originalSocket }
  })

  afterEach(function () {
    // Restore original modules
    const { josePath, loggerPath, databasePath, socketPath, originalJose, originalLogger, originalDatabase, originalSocket } = this._originals
    if (originalJose) require.cache[josePath] = originalJose
    else delete require.cache[josePath]
    if (originalLogger) require.cache[loggerPath] = originalLogger
    else delete require.cache[loggerPath]
    if (originalDatabase) require.cache[databasePath] = originalDatabase
    else delete require.cache[databasePath]
    if (originalSocket) require.cache[socketPath] = originalSocket
    else delete require.cache[socketPath]

    delete require.cache[require.resolve('../../../server/auth/BackchannelLogoutHandler')]

    sinon.restore()
  })

  it('should destroy all user sessions for sub-only token', async function () {
    const mockUser = { id: 'user-123', username: 'testuser' }
    DatabaseStub.userModel.getUserByOpenIDSub.resolves(mockUser)
    DatabaseStub.sessionModel.destroy.resolves(2)

    joseStub.jwtVerify.resolves({
      payload: {
        jti: 'unique-id-1',
        sub: 'oidc-sub-value',
        events: { [BACKCHANNEL_EVENT]: {} }
      }
    })

    const result = await handler.processLogoutToken('valid.jwt.token')

    expect(result.success).to.be.true
    expect(DatabaseStub.sessionModel.destroy.calledOnce).to.be.true
    expect(DatabaseStub.sessionModel.destroy.firstCall.args[0]).to.deep.equal({ where: { userId: 'user-123' } })
    expect(SocketAuthorityStub.clientEmitter.calledOnce).to.be.true
    expect(SocketAuthorityStub.clientEmitter.firstCall.args).to.deep.equal(['user-123', 'backchannel_logout', {}])
  })

  it('should destroy session by sid for sid-only token', async function () {
    DatabaseStub.sessionModel.destroy.resolves(1)

    joseStub.jwtVerify.resolves({
      payload: {
        jti: 'unique-id-2',
        sid: 'session-abc',
        events: { [BACKCHANNEL_EVENT]: {} }
      }
    })

    const result = await handler.processLogoutToken('valid.jwt.token')

    expect(result.success).to.be.true
    expect(DatabaseStub.sessionModel.destroy.calledOnce).to.be.true
    expect(DatabaseStub.sessionModel.destroy.firstCall.args[0]).to.deep.equal({ where: { oidcSessionId: 'session-abc' } })
    // No sub means no user lookup and no socket notification
    expect(DatabaseStub.userModel.getUserByOpenIDSub.called).to.be.false
    expect(SocketAuthorityStub.clientEmitter.called).to.be.false
  })

  it('should destroy by sid and notify by sub when both present', async function () {
    const mockUser = { id: 'user-456', username: 'testuser2' }
    DatabaseStub.userModel.getUserByOpenIDSub.resolves(mockUser)
    DatabaseStub.sessionModel.destroy.resolves(1)

    joseStub.jwtVerify.resolves({
      payload: {
        jti: 'unique-id-3',
        sub: 'oidc-sub-value',
        sid: 'session-xyz',
        events: { [BACKCHANNEL_EVENT]: {} }
      }
    })

    const result = await handler.processLogoutToken('valid.jwt.token')

    expect(result.success).to.be.true
    // Should destroy by sid (first call) and NOT destroy by userId (sid takes priority)
    expect(DatabaseStub.sessionModel.destroy.calledOnce).to.be.true
    expect(DatabaseStub.sessionModel.destroy.firstCall.args[0]).to.deep.equal({ where: { oidcSessionId: 'session-xyz' } })
    // But should still notify the user
    expect(SocketAuthorityStub.clientEmitter.calledOnce).to.be.true
    expect(SocketAuthorityStub.clientEmitter.firstCall.args[0]).to.equal('user-456')
  })

  it('should return error for invalid JWT signature', async function () {
    joseStub.jwtVerify.rejects(new Error('JWS signature verification failed'))

    const result = await handler.processLogoutToken('invalid.jwt.token')

    expect(result.success).to.be.false
    expect(result.error).to.equal('invalid_request')
  })

  it('should return error for missing events claim', async function () {
    joseStub.jwtVerify.resolves({
      payload: {
        sub: 'oidc-sub-value'
        // no events
      }
    })

    const result = await handler.processLogoutToken('valid.jwt.token')

    expect(result.success).to.be.false
    expect(result.error).to.equal('invalid_request')
  })

  it('should return error for wrong events claim value', async function () {
    joseStub.jwtVerify.resolves({
      payload: {
        sub: 'oidc-sub-value',
        events: { 'http://some-other-event': {} }
      }
    })

    const result = await handler.processLogoutToken('valid.jwt.token')

    expect(result.success).to.be.false
    expect(result.error).to.equal('invalid_request')
  })

  it('should return error when token is missing jti claim', async function () {
    joseStub.jwtVerify.resolves({
      payload: {
        sub: 'oidc-sub-value',
        events: { [BACKCHANNEL_EVENT]: {} }
        // no jti
      }
    })

    const result = await handler.processLogoutToken('valid.jwt.token')

    expect(result.success).to.be.false
    expect(result.error).to.equal('invalid_request')
  })

  it('should return error when token contains nonce', async function () {
    joseStub.jwtVerify.resolves({
      payload: {
        jti: 'unique-id-4',
        sub: 'oidc-sub-value',
        nonce: 'some-nonce',
        events: { [BACKCHANNEL_EVENT]: {} }
      }
    })

    const result = await handler.processLogoutToken('valid.jwt.token')

    expect(result.success).to.be.false
    expect(result.error).to.equal('invalid_request')
  })

  it('should return error when token has neither sub nor sid', async function () {
    joseStub.jwtVerify.resolves({
      payload: {
        jti: 'unique-id-5',
        events: { [BACKCHANNEL_EVENT]: {} }
      }
    })

    const result = await handler.processLogoutToken('valid.jwt.token')

    expect(result.success).to.be.false
    expect(result.error).to.equal('invalid_request')
  })

  it('should return success for unknown sub (no user found)', async function () {
    DatabaseStub.userModel.getUserByOpenIDSub.resolves(null)

    joseStub.jwtVerify.resolves({
      payload: {
        jti: 'unique-id-6',
        sub: 'unknown-sub',
        events: { [BACKCHANNEL_EVENT]: {} }
      }
    })

    const result = await handler.processLogoutToken('valid.jwt.token')

    // Per spec, unknown sub is not an error
    expect(result.success).to.be.true
    expect(DatabaseStub.sessionModel.destroy.called).to.be.false
    expect(SocketAuthorityStub.clientEmitter.called).to.be.false
  })

  it('should reject replayed jti', async function () {
    const mockUser = { id: 'user-123', username: 'testuser' }
    DatabaseStub.userModel.getUserByOpenIDSub.resolves(mockUser)
    DatabaseStub.sessionModel.destroy.resolves(1)

    joseStub.jwtVerify.resolves({
      payload: {
        jti: 'same-jti',
        sub: 'oidc-sub-value',
        events: { [BACKCHANNEL_EVENT]: {} }
      }
    })

    // First call should succeed
    const result1 = await handler.processLogoutToken('valid.jwt.token')
    expect(result1.success).to.be.true

    // Second call with same jti should be rejected
    const result2 = await handler.processLogoutToken('valid.jwt.token')
    expect(result2.success).to.be.false
    expect(result2.error).to.equal('invalid_request')
  })

  it('should warn when sid destroy matches 0 sessions', async function () {
    DatabaseStub.sessionModel.destroy.resolves(0)

    joseStub.jwtVerify.resolves({
      payload: {
        jti: 'unique-id-warn',
        sid: 'old-session-id',
        events: { [BACKCHANNEL_EVENT]: {} }
      }
    })

    const result = await handler.processLogoutToken('valid.jwt.token')

    expect(result.success).to.be.true
    expect(DatabaseStub.sessionModel.destroy.calledOnce).to.be.true
  })

  it('should reset cached JWKS and jti cache', function () {
    // Call _getJwks to cache
    handler._getJwks()
    expect(joseStub.createRemoteJWKSet.calledOnce).to.be.true

    // Reset and call again
    handler.reset()
    handler._getJwks()
    expect(joseStub.createRemoteJWKSet.calledTwice).to.be.true
  })
})
