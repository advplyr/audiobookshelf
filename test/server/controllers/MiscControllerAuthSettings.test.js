const { expect } = require('chai')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')
const MiscController = require('../../../server/controllers/MiscController')
const ServerSettings = require('../../../server/objects/settings/ServerSettings')

const REQUIRED_ENV = {
  AUTH_OPENID_ISSUER_URL: 'https://env.example.com',
  AUTH_OPENID_AUTHORIZATION_URL: 'https://env.example.com/authorize',
  AUTH_OPENID_TOKEN_URL: 'https://env.example.com/token',
  AUTH_OPENID_USERINFO_URL: 'https://env.example.com/userinfo',
  AUTH_OPENID_JWKS_URL: 'https://env.example.com/jwks',
  AUTH_OPENID_CLIENT_ID: 'environment-client',
  AUTH_OPENID_CLIENT_SECRET: 'environment-secret'
}

function persistedSettings(overrides = {}) {
  return new ServerSettings({
    metadataFileFormat: 'json',
    authActiveAuthMethods: ['local'],
    authOpenIDIssuerURL: 'https://db.example.com',
    authOpenIDAuthorizationURL: 'https://db.example.com/authorize',
    authOpenIDTokenURL: 'https://db.example.com/token',
    authOpenIDUserInfoURL: 'https://db.example.com/userinfo',
    authOpenIDJwksURL: 'https://db.example.com/jwks',
    authOpenIDClientID: 'database-client',
    authOpenIDClientSecret: 'database-secret',
    authOpenIDTokenSigningAlgorithm: 'RS256',
    ...overrides
  })
}

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code
      return this
    },
    send(body) {
      this.body = body
      return this
    },
    sendStatus(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    }
  }
}

describe('MiscController OpenID environment settings', () => {
  let originalSequelize

  beforeEach(() => {
    global.MetadataPath = '/metadata'
    global.RouterBasePath = ''
    ServerSettings.OPENID_ENV_KEYS.forEach((key) => delete process.env[key])
    Object.assign(process.env, REQUIRED_ENV)
    originalSequelize = Database.sequelize
    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'warn')
    sinon.stub(Logger, 'error')
    sinon.stub(Logger, 'debug')
  })

  afterEach(() => {
    ServerSettings.OPENID_ENV_KEYS.forEach((key) => delete process.env[key])
    Database.sequelize = originalSequelize
    sinon.restore()
  })

  it('returns effective settings and the environment ownership flag to admins', () => {
    Database.serverSettings = persistedSettings()
    const res = response()

    MiscController.getAuthSettings({ user: { isAdminOrUp: true } }, res)

    expect(res.body.authOpenIDEnvSet).to.equal(true)
    expect(res.body.authOpenIDIssuerURL).to.equal('https://env.example.com')
    expect(res.body.authOpenIDClientSecret).to.equal('environment-secret')
    expect(res.body.authActiveAuthMethods).to.deep.equal(['local', 'openid'])
  })

  it('keeps the auth settings endpoint forbidden for non-admin users', () => {
    Database.serverSettings = persistedSettings()
    const res = response()

    MiscController.getAuthSettings({ user: { isAdminOrUp: false, username: 'reader' } }, res)

    expect(res.statusCode).to.equal(403)
    expect(res.body).to.equal(undefined)
  })

  it('accepts matching round-tripped OpenID fields without persisting their environment values', async () => {
    Database.serverSettings = persistedSettings()
    let persisted
    const updateSettingObj = sinon.stub().callsFake((value) => {
      persisted = value
      return Promise.resolve()
    })
    Database.sequelize = { models: { setting: { updateSettingObj } } }
    global.ServerSettings = Database.serverSettings.getEffectiveServerSettings()
    const res = response()
    const auth = { useAuthStrategy: sinon.spy(), unuseAuthStrategy: sinon.spy() }

    await MiscController.updateAuthSettings.call(
      { auth },
      {
        user: { isAdminOrUp: true },
        body: {
          ...Database.serverSettings.effectiveAuthenticationSettings,
          authLoginCustomMessage: 'Welcome'
        }
      },
      res
    )

    expect(res.body.updated).to.equal(true)
    expect(Database.serverSettings.authLoginCustomMessage).to.equal('Welcome')
    expect(Database.serverSettings.authActiveAuthMethods).to.deep.equal(['local'])
    expect(Database.serverSettings.authOpenIDIssuerURL).to.equal('https://db.example.com')
    expect(Database.serverSettings.authOpenIDClientSecret).to.equal('database-secret')
    expect(persisted.authOpenIDClientSecret).to.equal('database-secret')
    expect(JSON.stringify(persisted)).not.to.include('environment-secret')
  })

  it('rejects a changed environment-controlled OpenID field without applying other updates', async () => {
    Database.serverSettings = persistedSettings()
    const updateSettingObj = sinon.stub().resolves()
    Database.sequelize = { models: { setting: { updateSettingObj } } }
    global.ServerSettings = Database.serverSettings.getEffectiveServerSettings()
    const res = response()
    const auth = { useAuthStrategy: sinon.spy(), unuseAuthStrategy: sinon.spy() }

    await MiscController.updateAuthSettings.call(
      { auth },
      {
        user: { isAdminOrUp: true },
        body: {
          ...Database.serverSettings.effectiveAuthenticationSettings,
          authLoginCustomMessage: 'This must not be saved',
          authOpenIDIssuerURL: 'https://changed.example.com'
        }
      },
      res
    )

    expect(res.statusCode).to.equal(400)
    expect(res.body).to.equal('OpenID Connect settings are controlled by environment variables')
    expect(Database.serverSettings.authLoginCustomMessage).to.equal(null)
    expect(Database.serverSettings.authOpenIDIssuerURL).to.equal('https://db.example.com')
    expect(updateSettingObj.called).to.equal(false)
    expect(auth.useAuthStrategy.called).to.equal(false)
    expect(auth.unuseAuthStrategy.called).to.equal(false)
  })

  it('preserves persisted OpenID membership when a client changes local membership', async () => {
    Database.serverSettings = persistedSettings({ authActiveAuthMethods: ['openid'] })
    Database.sequelize = { models: { setting: { updateSettingObj: sinon.stub().resolves() } } }
    global.ServerSettings = Database.serverSettings.getEffectiveServerSettings()
    const auth = { useAuthStrategy: sinon.spy(), unuseAuthStrategy: sinon.spy() }

    await MiscController.updateAuthSettings.call(
      { auth },
      { user: { isAdminOrUp: true }, body: { authActiveAuthMethods: ['local'] } },
      response()
    )

    expect(Database.serverSettings.authActiveAuthMethods).to.deep.equal(['local', 'openid'])
  })

  it('does not leak environment values during an unrelated server settings update', async () => {
    Database.serverSettings = persistedSettings()
    let persisted
    Database.sequelize = {
      models: {
        setting: {
          updateSettingObj: sinon.stub().callsFake((value) => {
            persisted = value
            return Promise.resolve()
          })
        }
      }
    }

    Database.serverSettings.language = 'de-de'
    await Database.updateServerSettings()

    expect(global.ServerSettings.authOpenIDClientSecret).to.equal('environment-secret')
    expect(persisted.authOpenIDClientSecret).to.equal('database-secret')
    expect(JSON.stringify(persisted)).not.to.include('environment-secret')
  })
})
