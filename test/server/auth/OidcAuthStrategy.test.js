const { expect } = require('chai')
const sinon = require('sinon')

// Load Database first so Auth resolves OidcAuthStrategy before the circular require completes.
require('../../../server/Database')
const OidcAuthStrategy = require('../../../server/auth/OidcAuthStrategy')
const Logger = require('../../../server/Logger')

describe('OidcAuthStrategy - isValidWebCallbackUrl', () => {
  /** @type {OidcAuthStrategy} */
  let strategy

  beforeEach(() => {
    global.RouterBasePath = ''
    strategy = new OidcAuthStrategy()
    sinon.stub(Logger, 'warn')
    sinon.stub(Logger, 'error')
  })

  afterEach(() => {
    sinon.restore()
  })

  function mockReq({ secure = false, host = 'books.example.com', xForwardedProto = null } = {}) {
    return {
      secure,
      get(header) {
        if (header === 'host') return host
        if (header === 'x-forwarded-proto') return xForwardedProto
        return null
      }
    }
  }

  it('accepts a same-origin relative path when router base path is empty', () => {
    expect(strategy.isValidWebCallbackUrl('/library', mockReq())).to.equal(true)
  })

  it('accepts a same-origin absolute https URL', () => {
    const req = mockReq({ secure: true })
    expect(strategy.isValidWebCallbackUrl('https://books.example.com/library', req)).to.equal(true)
  })

  it('rejects protocol-relative URLs', () => {
    expect(strategy.isValidWebCallbackUrl('//evil.example/capture', mockReq())).to.equal(false)
  })

  it('rejects backslash-prefixed URLs', () => {
    expect(strategy.isValidWebCallbackUrl('/\\evil.example/capture', mockReq())).to.equal(false)
  })

  it('rejects absolute external URLs', () => {
    expect(strategy.isValidWebCallbackUrl('http://evil.example/capture', mockReq())).to.equal(false)
  })

  it('rejects encoded protocol-relative path segments', () => {
    expect(strategy.isValidWebCallbackUrl('/%2F%2Fevil.example/capture', mockReq())).to.equal(false)
  })

  it('rejects same-origin URLs outside router base path', () => {
    global.RouterBasePath = '/audiobookshelf'
    expect(strategy.isValidWebCallbackUrl('/login', mockReq())).to.equal(false)
    expect(strategy.isValidWebCallbackUrl('/audiobookshelf/login', mockReq())).to.equal(true)
  })

  it('rejects empty and malformed callback URLs', () => {
    expect(strategy.isValidWebCallbackUrl('', mockReq())).to.equal(false)
    expect(strategy.isValidWebCallbackUrl(null, mockReq())).to.equal(false)
    expect(strategy.isValidWebCallbackUrl('not a url', mockReq())).to.equal(false)
  })

  it('uses x-forwarded-proto when determining same-origin https URLs', () => {
    const req = mockReq({ xForwardedProto: 'https' })
    expect(strategy.isValidWebCallbackUrl('https://books.example.com/login', req)).to.equal(true)
    expect(strategy.isValidWebCallbackUrl('http://books.example.com/login', req)).to.equal(false)
  })
})

describe('OidcAuthStrategy - openIdAuthSession', () => {
  /** @type {OidcAuthStrategy} */
  let strategy

  beforeEach(() => {
    global.RouterBasePath = ''
    strategy = new OidcAuthStrategy()
  })

  it('configures a 10 minute TTL with autopurge so abandoned mobile logins are cleaned up', () => {
    expect(strategy.openIdAuthSession.ttl).to.equal(10 * 60 * 1000)
    expect(strategy.openIdAuthSession.ttlAutopurge).to.equal(true)
  })

  it('still supports the same set/has/get/delete usage as a plain Map', () => {
    strategy.openIdAuthSession.set('some-state', { mobile_redirect_uri: 'myapp://callback' })
    expect(strategy.openIdAuthSession.has('some-state')).to.equal(true)
    expect(strategy.openIdAuthSession.get('some-state')).to.deep.equal({ mobile_redirect_uri: 'myapp://callback' })
    strategy.openIdAuthSession.delete('some-state')
    expect(strategy.openIdAuthSession.has('some-state')).to.equal(false)
  })
})

describe('OidcAuthStrategy - mobile flow without a shared session cookie', () => {
  const { generators } = require('openid-client')

  /** @type {OidcAuthStrategy} */
  let strategy
  let verifier
  let challenge

  function makeRes() {
    const res = { statusCode: null, body: null, location: null }
    res.status = (code) => {
      res.statusCode = code
      return res
    }
    res.send = (body) => {
      res.body = body
      return res
    }
    res.redirect = (url) => {
      res.location = url
      return res
    }
    return res
  }

  function makeReq(query) {
    return {
      query,
      session: {},
      cookies: {},
      secure: true,
      get(header) {
        return header === 'host' ? 'books.example.com' : null
      }
    }
  }

  /** Runs /auth/openid for a mobile client, then /auth/openid/mobile-redirect, like a real sign-in */
  function startAndRedirect(state = 'st') {
    const result = strategy.getAuthorizationUrl(makeReq({ response_type: 'code', redirect_uri: 'myapp://callback', state, code_challenge: challenge, code_challenge_method: 'S256' }))
    expect(result.error).to.equal(undefined)
    const res = makeRes()
    strategy.handleMobileRedirect({ query: { state, code: 'abc' } }, res)
    return res
  }

  beforeEach(() => {
    global.RouterBasePath = ''
    global.ServerSettings = { authOpenIDSubfolderForRedirectURLs: '' }
    strategy = new OidcAuthStrategy()
    sinon.stub(strategy, 'getStrategy').returns({ _key: 'openid-client', _params: {} })
    sinon.stub(strategy, 'getClient').returns({ authorizationUrl: () => 'https://idp.example/authorize' })
    sinon.stub(strategy, 'getScope').returns('openid')
    sinon.stub(strategy, 'isValidRedirectUri').callsFake((uri) => uri === 'myapp://callback')
    sinon.stub(Logger, 'warn')
    sinon.stub(Logger, 'error')
    sinon.stub(Logger, 'debug')
    verifier = generators.codeVerifier()
    challenge = generators.codeChallenge(verifier)
  })

  afterEach(() => {
    sinon.restore()
  })

  it('/auth/openid stores what the callback needs for the state', () => {
    strategy.getAuthorizationUrl(makeReq({ response_type: 'code', redirect_uri: 'myapp://callback', state: 'st', code_challenge: challenge }))
    expect(strategy.openIdAuthSession.get('st')).to.deep.include({
      mobile_redirect_uri: 'myapp://callback',
      sso_redirect_uri: 'https://books.example.com/auth/openid/mobile-redirect',
      code_challenge: challenge,
      redirected: false
    })
  })

  it('/auth/openid does not store an entry when PKCE is missing', () => {
    const result = strategy.getAuthorizationUrl(makeReq({ response_type: 'code', redirect_uri: 'myapp://callback', state: 'st' }))
    expect(result.status).to.equal(400)
    expect(strategy.openIdAuthSession.has('st')).to.equal(false)
  })

  it('mobile-redirect redirects once and keeps the entry for the callback', () => {
    const res = startAndRedirect()
    expect(res.location).to.equal('myapp://callback?code=abc&state=st')
    expect(strategy.openIdAuthSession.has('st')).to.equal(true)

    const second = makeRes()
    strategy.handleMobileRedirect({ query: { state: 'st', code: 'abc' } }, second)
    expect(second.statusCode).to.equal(400)
    expect(second.location).to.equal(null)
  })

  it('restores the session for a client without a cookie, once', () => {
    startAndRedirect()
    const req = makeReq({ state: 'st', code: 'abc', code_verifier: verifier })
    expect(strategy.restoreMobileSession(req)).to.equal(true)
    expect(req.session['openid-client']).to.deep.include({
      state: 'st',
      response_type: 'code',
      code_verifier: verifier,
      mobile: 'myapp://callback',
      sso_redirect_uri: 'https://books.example.com/auth/openid/mobile-redirect'
    })
    expect(req.cookies.auth_method).to.equal('openid-mobile')
    expect(strategy.openIdAuthSession.has('st')).to.equal(false)

    expect(strategy.restoreMobileSession(makeReq({ state: 'st', code: 'abc', code_verifier: verifier }))).to.equal(false)
  })

  it('does not restore, or use up the entry, when the code_verifier does not match the code_challenge', () => {
    startAndRedirect()
    const req = makeReq({ state: 'st', code: 'abc', code_verifier: generators.codeVerifier() })
    expect(strategy.restoreMobileSession(req)).to.equal(false)
    expect(req.session['openid-client']).to.equal(undefined)
    expect(strategy.openIdAuthSession.has('st')).to.equal(true)
    expect(strategy.restoreMobileSession(makeReq({ state: 'st', code: 'abc', code_verifier: verifier }))).to.equal(true)
  })

  it('does not restore before mobile-redirect ran, for an unknown state, or for malformed parameters', () => {
    strategy.getAuthorizationUrl(makeReq({ response_type: 'code', redirect_uri: 'myapp://callback', state: 'st', code_challenge: challenge }))
    expect(strategy.restoreMobileSession(makeReq({ state: 'st', code: 'abc', code_verifier: verifier }))).to.equal(false)

    strategy.handleMobileRedirect({ query: { state: 'st', code: 'abc' } }, makeRes())
    expect(strategy.restoreMobileSession(makeReq({ state: 'st', code: 'abc' }))).to.equal(false)
    expect(strategy.restoreMobileSession(makeReq({ state: 'st', code: 'abc', code_verifier: [verifier] }))).to.equal(false)
    expect(strategy.restoreMobileSession(makeReq({ state: 'st', code: 'abc', code_verifier: 'short' }))).to.equal(false)
    expect(strategy.restoreMobileSession(makeReq({ state: 'other', code: 'abc', code_verifier: verifier }))).to.equal(false)
    expect(strategy.openIdAuthSession.has('st')).to.equal(true)
  })
})
