const { expect } = require('chai')
const sinon = require('sinon')

const Logger = require('../../../../server/Logger')
const ServerSettings = require('../../../../server/objects/settings/ServerSettings')

const REQUIRED_ENV = {
  AUTH_OPENID_ISSUER_URL: 'https://auth.example.com/application/o/audiobookshelf/',
  AUTH_OPENID_AUTHORIZATION_URL: 'https://auth.example.com/application/o/authorize/',
  AUTH_OPENID_TOKEN_URL: 'https://auth.example.com/application/o/token/',
  AUTH_OPENID_USERINFO_URL: 'https://auth.example.com/application/o/userinfo/',
  AUTH_OPENID_JWKS_URL: 'https://auth.example.com/application/o/audiobookshelf/jwks/',
  AUTH_OPENID_CLIENT_ID: 'audiobookshelf',
  AUTH_OPENID_CLIENT_SECRET: 'environment-secret'
}

function setOpenIDEnv(values = REQUIRED_ENV) {
  Object.assign(process.env, values)
}

function persistedSettings(overrides = {}) {
  return {
    metadataFileFormat: 'json',
    authActiveAuthMethods: ['local'],
    authOpenIDIssuerURL: 'https://db.example.com',
    authOpenIDAuthorizationURL: 'https://db.example.com/authorize',
    authOpenIDTokenURL: 'https://db.example.com/token',
    authOpenIDUserInfoURL: 'https://db.example.com/userinfo',
    authOpenIDJwksURL: 'https://db.example.com/jwks',
    authOpenIDClientID: 'database-client',
    authOpenIDClientSecret: 'database-secret',
    authOpenIDTokenSigningAlgorithm: 'ES256',
    ...overrides
  }
}

describe('ServerSettings OpenID environment configuration', () => {
  beforeEach(() => {
    global.MetadataPath = '/metadata'
    global.RouterBasePath = '/audiobookshelf'
    ServerSettings.OPENID_ENV_KEYS.forEach((key) => delete process.env[key])
    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'error')
  })

  afterEach(() => {
    ServerSettings.OPENID_ENV_KEYS.forEach((key) => delete process.env[key])
    sinon.restore()
  })

  it('leaves persisted behavior unchanged when no OpenID environment variable is set', () => {
    const settings = new ServerSettings(persistedSettings({ authActiveAuthMethods: ['local', 'openid'] }))

    expect(settings.authOpenIDEnvSet).to.equal(false)
    expect(settings.getEffectiveServerSettings()).to.deep.equal(settings.toJSON())
    expect(settings.effectiveAuthenticationSettings.authOpenIDEnvSet).to.equal(false)
  })

  it('treats any recognized variable as ownership of the complete OpenID block', () => {
    process.env.AUTH_OPENID_BUTTON_TEXT = 'Company login'
    const settings = new ServerSettings(persistedSettings({ authActiveAuthMethods: ['openid'] }))
    const effective = settings.getEffectiveServerSettings()

    expect(settings.authOpenIDEnvSet).to.equal(true)
    expect(effective.authOpenIDIssuerURL).to.equal(null)
    expect(effective.authActiveAuthMethods).to.deep.equal(['local'])
    expect(settings.toJSON().authOpenIDIssuerURL).to.equal('https://db.example.com')
    expect(Logger.error.calledWithMatch('Invalid OpenID Connect environment configuration')).to.equal(true)
  })

  it('overrides runtime settings and activates OpenID without mutating persisted values', () => {
    setOpenIDEnv()
    const settings = new ServerSettings(persistedSettings())
    const effective = settings.getEffectiveServerSettings()

    expect(effective.authActiveAuthMethods).to.deep.equal(['local', 'openid'])
    expect(effective.authOpenIDIssuerURL).to.equal(REQUIRED_ENV.AUTH_OPENID_ISSUER_URL)
    expect(effective.authOpenIDClientSecret).to.equal('environment-secret')
    expect(settings.authActiveAuthMethods).to.deep.equal(['local'])
    expect(settings.authOpenIDIssuerURL).to.equal('https://db.example.com')
    expect(settings.toJSON().authOpenIDClientSecret).to.equal('database-secret')
    expect(settings.effectiveAuthenticationSettings.authOpenIDEnvSet).to.equal(true)
    expect(Logger.info.calledWith('[ServerSettings] Using OpenID Connect settings from environment variables')).to.equal(true)
  })

  it('restores database managed behavior after environment variables are removed', () => {
    setOpenIDEnv()
    const settings = new ServerSettings(persistedSettings({ authActiveAuthMethods: ['openid'] }))
    expect(settings.getEffectiveServerSettings().authOpenIDIssuerURL).to.equal(REQUIRED_ENV.AUTH_OPENID_ISSUER_URL)

    ServerSettings.OPENID_ENV_KEYS.forEach((key) => delete process.env[key])
    expect(settings.getEffectiveServerSettings().authOpenIDIssuerURL).to.equal('https://db.example.com')
    expect(settings.getEffectiveServerSettings().authActiveAuthMethods).to.deep.equal(['openid'])
  })

  it('applies all documented defaults including the router base path', () => {
    setOpenIDEnv()
    const envSettings = new ServerSettings().getOpenIDSettingsFromEnv()

    expect(envSettings).to.include({
      isValid: true,
      authOpenIDLogoutURL: null,
      authOpenIDTokenSigningAlgorithm: 'RS256',
      authOpenIDButtonText: 'Login with OpenId',
      authOpenIDAutoLaunch: false,
      authOpenIDAutoRegister: false,
      authOpenIDMatchExistingBy: null,
      authOpenIDGroupClaim: '',
      authOpenIDAdvancedPermsClaim: '',
      authOpenIDSubfolderForRedirectURLs: '/audiobookshelf'
    })
    expect(envSettings.authOpenIDMobileRedirectURIs).to.deep.equal(['audiobookshelf://oauth'])
  })

  it('preserves an explicitly empty redirect subfolder', () => {
    setOpenIDEnv({ ...REQUIRED_ENV, AUTH_OPENID_SUBFOLDER_FOR_REDIRECT_URLS: '' })
    expect(new ServerSettings().getOpenIDSettingsFromEnv().authOpenIDSubfolderForRedirectURLs).to.equal('')
  })

  it('reports every missing mandatory endpoint or credential', () => {
    process.env.AUTH_OPENID_AUTO_LAUNCH = '1'
    const parsed = new ServerSettings().getOpenIDSettingsFromEnv()

    expect(parsed.isValid).to.equal(false)
    expect(parsed.missingRequiredVariables).to.have.members(Object.keys(REQUIRED_ENV))
  })

  it('uses only the exact string 1 for boolean values', () => {
    for (const [value, expected] of [
      ['1', true],
      ['true', false],
      ['0', false]
    ]) {
      process.env.AUTH_OPENID_AUTO_REGISTER = value
      expect(new ServerSettings().getOpenIDSettingsFromEnv().authOpenIDAutoRegister).to.equal(expected)
    }
  })

  it('parses comma separated mobile redirect URIs and supports an explicitly empty list', () => {
    setOpenIDEnv({ ...REQUIRED_ENV, AUTH_OPENID_MOBILE_REDIRECT_URIS: 'audiobookshelf://oauth, plappa://oauth, ' })
    expect(new ServerSettings().getOpenIDSettingsFromEnv().authOpenIDMobileRedirectURIs).to.deep.equal(['audiobookshelf://oauth', 'plappa://oauth'])

    process.env.AUTH_OPENID_MOBILE_REDIRECT_URIS = ''
    const parsed = new ServerSettings().getOpenIDSettingsFromEnv()
    expect(parsed.authOpenIDMobileRedirectURIs).to.deep.equal([])
    expect(parsed.isValid).to.equal(true)
  })

  it('validates wildcard and custom scheme redirect URI lists', () => {
    setOpenIDEnv({ ...REQUIRED_ENV, AUTH_OPENID_MOBILE_REDIRECT_URIS: '*' })
    expect(new ServerSettings().getOpenIDSettingsFromEnv().isValid).to.equal(true)

    process.env.AUTH_OPENID_MOBILE_REDIRECT_URIS = '*,audiobookshelf://oauth'
    expect(new ServerSettings().getOpenIDSettingsFromEnv().invalidVariables).to.include('AUTH_OPENID_MOBILE_REDIRECT_URIS')

    process.env.AUTH_OPENID_MOBILE_REDIRECT_URIS = 'not-a-uri'
    expect(new ServerSettings().getOpenIDSettingsFromEnv().isValid).to.equal(false)
  })

  it('validates claim names', () => {
    setOpenIDEnv({ ...REQUIRED_ENV, AUTH_OPENID_GROUP_CLAIM: 'groups_1', AUTH_OPENID_ADVANCED_PERMS_CLAIM: 'abs-permissions' })
    expect(new ServerSettings().getOpenIDSettingsFromEnv().isValid).to.equal(true)

    process.env.AUTH_OPENID_GROUP_CLAIM = '1groups'
    process.env.AUTH_OPENID_ADVANCED_PERMS_CLAIM = 'abs.permissions'
    const parsed = new ServerSettings().getOpenIDSettingsFromEnv()
    expect(parsed.invalidVariables).to.have.members(['AUTH_OPENID_GROUP_CLAIM', 'AUTH_OPENID_ADVANCED_PERMS_CLAIM'])
  })

  it('accepts only email, username, or an empty match-existing mode', () => {
    setOpenIDEnv()
    for (const value of ['email', 'username', '']) {
      process.env.AUTH_OPENID_MATCH_EXISTING_BY = value
      const parsed = new ServerSettings().getOpenIDSettingsFromEnv()
      expect(parsed.isValid).to.equal(true)
      expect(parsed.authOpenIDMatchExistingBy).to.equal(value || null)
    }

    process.env.AUTH_OPENID_MATCH_EXISTING_BY = 'sub'
    expect(new ServerSettings().getOpenIDSettingsFromEnv().isValid).to.equal(false)
  })

  it('sanitizes the effective browser settings', () => {
    setOpenIDEnv({ ...REQUIRED_ENV, AUTH_OPENID_BUTTON_TEXT: 'SSO', AUTH_OPENID_AUTO_LAUNCH: '1' })
    const browserSettings = new ServerSettings(persistedSettings()).toJSONForBrowser()

    expect(browserSettings.authActiveAuthMethods).to.deep.equal(['local', 'openid'])
    expect(browserSettings.authOpenIDButtonText).to.equal('SSO')
    expect(browserSettings.authOpenIDAutoLaunch).to.equal(true)
    expect(browserSettings).not.to.have.any.keys('authOpenIDClientID', 'authOpenIDClientSecret', 'authOpenIDMobileRedirectURIs', 'authOpenIDGroupClaim', 'authOpenIDAdvancedPermsClaim')
  })
})
