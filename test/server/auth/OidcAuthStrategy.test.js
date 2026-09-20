const { expect } = require('chai')
const sinon = require('sinon')

require('../../../server/Auth')
const OidcAuthStrategy = require('../../../server/auth/OidcAuthStrategy')
const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')
const OpenIDClient = require('openid-client')
const ServerSettings = require('../../../server/objects/settings/ServerSettings')
const User = require('../../../server/models/User')

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

describe('OidcAuthStrategy - effective OpenID settings', () => {
  /** @type {OidcAuthStrategy} */
  let strategy
  let originalSequelize

  beforeEach(() => {
    global.MetadataPath = '/metadata'
    global.RouterBasePath = '/abs'
    strategy = new OidcAuthStrategy()
    originalSequelize = Database.sequelize
    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'warn')
    sinon.stub(Logger, 'error')
  })

  afterEach(() => {
    Database.sequelize = originalSequelize
    sinon.restore()
  })

  function setEffectiveSettings(overrides = {}) {
    global.ServerSettings = {
      authOpenIDIssuerURL: 'https://env.example.com',
      authOpenIDAuthorizationURL: 'https://env.example.com/authorize',
      authOpenIDTokenURL: 'https://env.example.com/token',
      authOpenIDUserInfoURL: 'https://env.example.com/userinfo',
      authOpenIDJwksURL: 'https://env.example.com/jwks',
      authOpenIDLogoutURL: 'https://env.example.com/logout',
      authOpenIDClientID: 'environment-client',
      authOpenIDClientSecret: 'environment-secret',
      authOpenIDTokenSigningAlgorithm: 'RS256',
      authOpenIDSubfolderForRedirectURLs: '/abs',
      authOpenIDAutoRegister: false,
      authOpenIDGroupClaim: '',
      authOpenIDAdvancedPermsClaim: '',
      authOpenIDMobileRedirectURIs: ['audiobookshelf://oauth'],
      ...overrides
    }
  }

  it('creates the issuer and client from effective settings', () => {
    setEffectiveSettings()
    Database.serverSettings = new ServerSettings()
    let issuerMetadata
    let clientMetadata
    const clientConstructor = sinon.spy(function (metadata) {
      clientMetadata = metadata
    })
    sinon.stub(OpenIDClient, 'Issuer').callsFake(function (metadata) {
      issuerMetadata = metadata
      return { Client: clientConstructor }
    })

    strategy.getClient()

    expect(issuerMetadata).to.deep.include({
      issuer: 'https://env.example.com',
      token_endpoint: 'https://env.example.com/token',
      jwks_uri: 'https://env.example.com/jwks'
    })
    expect(clientMetadata).to.deep.equal({
      client_id: 'environment-client',
      client_secret: 'environment-secret',
      id_token_signed_response_alg: 'RS256'
    })
  })

  it('uses effective group and advanced permission claims', async () => {
    setEffectiveSettings({ authOpenIDGroupClaim: 'groups', authOpenIDAdvancedPermsClaim: 'abs_permissions' })
    const user = {
      type: 'user',
      username: 'alice',
      save: sinon.stub().resolves(),
      updatePermissionsFromExternalJSON: sinon.stub().resolves(true)
    }

    expect(strategy.validateGroupClaim({ groups: ['admin'] })).to.equal(true)
    await strategy.setUserGroup(user, { groups: ['admin'] })
    await strategy.updateUserPermissions(user, { abs_permissions: { download: true } })

    expect(user.type).to.equal('admin')
    expect(user.save.calledOnce).to.equal(true)
    user.type = 'user'
    await strategy.updateUserPermissions(user, { abs_permissions: { download: true } })
    expect(user.updatePermissionsFromExternalJSON.calledWith({ download: true })).to.equal(true)
  })

  it('uses effective auto-registration settings', async () => {
    setEffectiveSettings({ authOpenIDAutoRegister: true })
    const user = { isActive: true, type: 'user' }
    const userModel = {
      findUserFromOpenIdUserInfo: sinon.stub().resolves(null),
      createUserFromOpenIdUserInfo: sinon.stub().resolves(user)
    }
    Database.sequelize = { models: { user: userModel } }
    sinon.stub(strategy, 'setUserGroup').resolves()
    sinon.stub(strategy, 'updateUserPermissions').resolves()
    const done = sinon.spy()

    await strategy.verifyCallback({ id_token: 'token' }, { sub: 'subject' }, done)

    expect(userModel.createUserFromOpenIdUserInfo.calledOnce).to.equal(true)
    expect(done.calledWith(null, user)).to.equal(true)
  })

  it('uses the effective mobile redirect whitelist', () => {
    setEffectiveSettings({ authOpenIDMobileRedirectURIs: ['plappa://oauth'] })
    expect(strategy.isValidRedirectUri('plappa://oauth')).to.equal(true)
    expect(strategy.isValidRedirectUri('audiobookshelf://oauth')).to.equal(false)

    global.ServerSettings.authOpenIDMobileRedirectURIs = ['*']
    expect(strategy.isValidRedirectUri('custom://callback')).to.equal(true)
  })

  it('uses the effective match-existing mode when finding users', async () => {
    setEffectiveSettings({ authOpenIDMatchExistingBy: 'username' })
    const user = {
      isActive: true,
      extraData: {},
      changed: sinon.spy(),
      save: sinon.stub().resolves()
    }
    sinon.stub(User, 'getUserByOpenIDSub').resolves(null)
    sinon.stub(User, 'getUserByUsername').resolves(user)

    const matchedUser = await User.findUserFromOpenIdUserInfo({ sub: 'subject', preferred_username: 'alice' })

    expect(User.getUserByUsername.calledWith('alice')).to.equal(true)
    expect(matchedUser).to.equal(user)
    expect(user.extraData.authOpenIDSub).to.equal('subject')
  })

  it('uses the effective redirect subfolder for authorization callbacks', () => {
    setEffectiveSettings({ authOpenIDSubfolderForRedirectURLs: '/environment-base' })
    strategy.client = { authorizationUrl: sinon.stub().returns('https://env.example.com/authorize') }
    strategy.strategy = { _key: 'openid', _params: {} }
    sinon.stub(strategy, 'generatePkce').returns({ code_challenge: 'challenge', code_challenge_method: 'S256', code_verifier: 'verifier' })
    const req = {
      secure: true,
      query: {},
      session: {},
      get(header) {
        if (header === 'host') return 'books.example.com'
        return null
      }
    }

    expect(strategy.getAuthorizationUrl(req).authorizationUrl).to.equal('https://env.example.com/authorize')
    expect(strategy.client.authorizationUrl.firstCall.args[0].redirect_uri).to.equal('https://books.example.com/environment-base/auth/openid/callback')
  })
})
