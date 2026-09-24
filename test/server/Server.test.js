const { expect } = require('chai')
const sinon = require('sinon')

const Database = require('../../server/Database')
const Logger = require('../../server/Logger')
const Server = require('../../server/Server')
const ServerSettings = require('../../server/objects/settings/ServerSettings')

describe('Server status OpenID environment settings', () => {
  beforeEach(() => {
    global.MetadataPath = '/metadata'
    global.ConfigPath = '/config'
    global.RouterBasePath = ''
    ServerSettings.OPENID_ENV_KEYS.forEach((key) => delete process.env[key])
    Object.assign(process.env, {
      AUTH_OPENID_ISSUER_URL: 'https://env.example.com',
      AUTH_OPENID_AUTHORIZATION_URL: 'https://env.example.com/authorize',
      AUTH_OPENID_TOKEN_URL: 'https://env.example.com/token',
      AUTH_OPENID_USERINFO_URL: 'https://env.example.com/userinfo',
      AUTH_OPENID_JWKS_URL: 'https://env.example.com/jwks',
      AUTH_OPENID_CLIENT_ID: 'environment-client',
      AUTH_OPENID_CLIENT_SECRET: 'environment-secret',
      AUTH_OPENID_BUTTON_TEXT: 'Company SSO',
      AUTH_OPENID_AUTO_LAUNCH: '1'
    })
    sinon.stub(Logger, 'info')
  })

  afterEach(() => {
    ServerSettings.OPENID_ENV_KEYS.forEach((key) => delete process.env[key])
    sinon.restore()
  })

  it('reports the effective OpenID method and login form data', () => {
    Database.serverSettings = new ServerSettings({ metadataFileFormat: 'json', authActiveAuthMethods: ['local'], language: 'en-us' })
    global.ServerSettings = Database.serverSettings.getEffectiveServerSettings()
    const server = Object.create(Server.prototype)

    const status = server.getStatusPayload()

    expect(status.authMethods).to.deep.equal(['local', 'openid'])
    expect(status.authFormData).to.deep.include({ authOpenIDButtonText: 'Company SSO', authOpenIDAutoLaunch: true })
    expect(status.authFormData).not.to.have.property('authOpenIDClientSecret')
  })
})
