const { expect } = require('chai')
const sinon = require('sinon')

describe('Auth', () => {
  let Auth
  let auth

  before(() => {
    global.RouterBasePath = global.RouterBasePath || ''
    Auth = require('../../server/Auth')
  })

  beforeEach(() => {
    auth = new Auth()
  })

  afterEach(() => {
    sinon.restore()
  })

  function createRes() {
    return {
      redirect: sinon.spy(),
      json: sinon.spy(),
      clearCookie: sinon.spy()
    }
  }

  const userResponse = {
    user: { id: 'user-1', accessToken: 'access.jwt.token', refreshToken: 'refresh.jwt.token' }
  }

  describe('handleLoginSuccessBasedOnCookie', () => {
    it('redirects web oidc logins to the callback without any token in the url', async () => {
      const handleLoginSuccess = sinon.stub(auth, 'handleLoginSuccess').resolves(userResponse)
      const req = { cookies: { auth_method: 'openid', auth_cb: 'https://abs.example.com/login/' } }
      const res = createRes()

      await auth.handleLoginSuccessBasedOnCookie(req, res)

      // web login: tokens are not returned, refresh token goes into the httpOnly cookie
      expect(handleLoginSuccess.calledOnceWith(req, res, false)).to.be.true
      expect(res.redirect.calledOnce).to.be.true
      const [status, url] = res.redirect.firstCall.args
      expect(status).to.equal(302)
      expect(url).to.equal('https://abs.example.com/login/?oidcLogin=1')
      expect(url).to.not.include('access.jwt.token')
      expect(url).to.not.include('refresh.jwt.token')
      expect(url).to.not.include('Token')
      expect(res.clearCookie.calledWith('auth_cb')).to.be.true
      expect(res.clearCookie.calledWith('auth_state')).to.be.true
    })

    it('passes the state back url encoded', async () => {
      sinon.stub(auth, 'handleLoginSuccess').resolves(userResponse)
      const req = { cookies: { auth_method: 'openid', auth_cb: '/login/', auth_state: 'a b&c=d' } }
      const res = createRes()

      await auth.handleLoginSuccessBasedOnCookie(req, res)

      const url = res.redirect.firstCall.args[1]
      expect(url).to.equal('/login/?oidcLogin=1&state=a+b%26c%3Dd')
      expect(new URL(url, 'https://abs.example.com').searchParams.get('state')).to.equal('a b&c=d')
    })

    it('still returns tokens as json for mobile oidc logins', async () => {
      const handleLoginSuccess = sinon.stub(auth, 'handleLoginSuccess').resolves(userResponse)
      const req = { cookies: { auth_method: 'openid-mobile' } }
      const res = createRes()

      await auth.handleLoginSuccessBasedOnCookie(req, res)

      expect(handleLoginSuccess.calledOnceWith(req, res, true)).to.be.true
      expect(res.json.calledOnceWith(userResponse)).to.be.true
      expect(res.redirect.called).to.be.false
    })

    it('redirects to the login page with an error when the callback cookie is missing', async () => {
      sinon.stub(auth, 'handleLoginSuccess').resolves(userResponse)
      const req = { cookies: { auth_method: 'openid' } }
      const res = createRes()

      await auth.handleLoginSuccessBasedOnCookie(req, res)

      const url = res.redirect.firstCall.args[0]
      expect(url).to.match(/^\/login\?error=/)
      expect(url).to.not.include('access.jwt.token')
    })
  })
})
