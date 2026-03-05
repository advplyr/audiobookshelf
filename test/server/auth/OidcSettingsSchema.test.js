const { expect } = require('chai')
const { validateSettings } = require('../../../server/auth/OidcSettingsSchema')

describe('OidcSettingsSchema - validateSettings', function () {
  const validSettings = {
    authOpenIDIssuerURL: 'https://auth.example.com',
    authOpenIDAuthorizationURL: 'https://auth.example.com/authorize',
    authOpenIDTokenURL: 'https://auth.example.com/token',
    authOpenIDUserInfoURL: 'https://auth.example.com/userinfo',
    authOpenIDJwksURL: 'https://auth.example.com/jwks',
    authOpenIDClientID: 'my-client-id',
    authOpenIDClientSecret: 'my-client-secret',
    authOpenIDTokenSigningAlgorithm: 'RS256'
  }

  it('should pass with valid required settings', function () {
    const result = validateSettings(validSettings)
    expect(result.valid).to.be.true
  })

  it('should fail when required fields are missing', function () {
    const result = validateSettings({})
    expect(result.valid).to.be.false
    expect(result.errors).to.include('Issuer URL is required')
    expect(result.errors).to.include('Client ID is required')
    expect(result.errors).to.include('Client Secret is required')
  })

  it('should fail with invalid URL', function () {
    const result = validateSettings({
      ...validSettings,
      authOpenIDIssuerURL: 'not-a-url'
    })
    expect(result.valid).to.be.false
    expect(result.errors).to.include('Issuer URL: Invalid URL')
  })

  it('should pass with valid optional fields', function () {
    const result = validateSettings({
      ...validSettings,
      authOpenIDLogoutURL: 'https://auth.example.com/logout',
      authOpenIDButtonText: 'Login with SSO',
      authOpenIDAutoLaunch: false,
      authOpenIDAutoRegister: true,
      authOpenIDScopes: 'openid profile email groups',
      authOpenIDGroupClaim: 'groups'
    })
    expect(result.valid).to.be.true
  })

  it('should fail with invalid boolean type', function () {
    const result = validateSettings({
      ...validSettings,
      authOpenIDAutoLaunch: 'yes'
    })
    expect(result.valid).to.be.false
    expect(result.errors).to.include('Auto Launch: Expected boolean')
  })

  it('should fail with invalid claim name', function () {
    const result = validateSettings({
      ...validSettings,
      authOpenIDGroupClaim: '123invalid'
    })
    expect(result.valid).to.be.false
    expect(result.errors).to.include('Group Claim: Invalid claim name')
  })

  it('should pass with valid claim name', function () {
    const result = validateSettings({
      ...validSettings,
      authOpenIDGroupClaim: 'my-groups_claim'
    })
    expect(result.valid).to.be.true
  })

  it('should pass with URN-style claim name (e.g. ZITADEL)', function () {
    const result = validateSettings({
      ...validSettings,
      authOpenIDGroupClaim: 'urn:zitadel:iam:org:project:roles'
    })
    expect(result.valid).to.be.true
  })

  it('should fail with invalid group map values', function () {
    const result = validateSettings({
      ...validSettings,
      authOpenIDGroupMap: { 'my-group': 'superadmin' }
    })
    expect(result.valid).to.be.false
    expect(result.errors[0]).to.include('Invalid value "superadmin"')
  })

  it('should pass with valid group map', function () {
    const result = validateSettings({
      ...validSettings,
      authOpenIDGroupMap: { 'oidc-admins': 'admin', 'oidc-users': 'user', 'oidc-guests': 'guest' }
    })
    expect(result.valid).to.be.true
  })

  it('should fail with non-object group map', function () {
    const result = validateSettings({
      ...validSettings,
      authOpenIDGroupMap: 'not-an-object'
    })
    expect(result.valid).to.be.false
    expect(result.errors).to.include('Group Mapping: Expected object')
  })

  it('should fail with invalid mobile redirect URIs', function () {
    const result = validateSettings({
      ...validSettings,
      authOpenIDMobileRedirectURIs: 'not-an-array'
    })
    expect(result.valid).to.be.false
    expect(result.errors).to.include('Mobile Redirect URIs: Expected array')
  })

  it('should pass with valid redirect URI', function () {
    const result = validateSettings({
      ...validSettings,
      authOpenIDMobileRedirectURIs: ['audiobookshelf://oauth']
    })
    expect(result.valid).to.be.true
  })

  it('should fail with wildcard URI', function () {
    const result = validateSettings({
      ...validSettings,
      authOpenIDMobileRedirectURIs: ['*']
    })
    expect(result.valid).to.be.false
    expect(result.errors[0]).to.include('Invalid URI')
  })

  it('should not hang on pathological URI input', function () {
    this.timeout(1000)
    const result = validateSettings({
      ...validSettings,
      authOpenIDMobileRedirectURIs: ['a://-/' + '/'.repeat(100) + '!']
    })
    expect(result.valid).to.be.false
    expect(result.errors[0]).to.include('Invalid URI')
  })

  it('should accept URI with path segments', function () {
    const result = validateSettings({
      ...validSettings,
      authOpenIDMobileRedirectURIs: ['https://example.com/path/to/callback']
    })
    expect(result.valid).to.be.true
  })

  it('should reject unknown keys', function () {
    const result = validateSettings({
      ...validSettings,
      unknownSetting: 'value'
    })
    expect(result.valid).to.be.false
    expect(result.errors).to.include('Unknown setting: "unknownSetting"')
  })

  it('should skip validation for empty optional fields', function () {
    const result = validateSettings({
      ...validSettings,
      authOpenIDLogoutURL: '',
      authOpenIDGroupClaim: '',
      authOpenIDGroupMap: {}
    })
    expect(result.valid).to.be.true
  })
})
