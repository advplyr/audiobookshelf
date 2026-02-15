const { expect } = require('chai')
const sinon = require('sinon')
const OpenIDClient = require('openid-client')
const AuthError = require('../../../server/auth/AuthError')

// Test the real OidcAuthStrategy by stubbing its module-level dependencies
describe('OidcAuthStrategy', function () {
  let OidcAuthStrategy, strategy
  let DatabaseStub

  beforeEach(function () {
    // Clear require cache so we get fresh stubs each test
    delete require.cache[require.resolve('../../../server/auth/OidcAuthStrategy')]

    global.ServerSettings = {
      authOpenIDGroupClaim: '',
      authOpenIDGroupMap: {},
      authOpenIDScopes: 'openid profile email',
      isOpenIDAuthSettingsValid: false,
      authOpenIDMobileRedirectURIs: ['audiobookshelf://oauth'],
      authOpenIDAutoRegister: false,
      authOpenIDRequireVerifiedEmail: false,
      authOpenIDAdvancedPermsClaim: ''
    }
    global.RouterBasePath = '/audiobookshelf'

    DatabaseStub = {
      serverSettings: global.ServerSettings,
      userModel: {
        findUserFromOpenIdUserInfo: sinon.stub(),
        createUserFromOpenIdUserInfo: sinon.stub()
      }
    }

    const LoggerStub = { info: sinon.stub(), warn: sinon.stub(), error: sinon.stub(), debug: sinon.stub() }

    // Stub dependencies in require cache
    const databasePath = require.resolve('../../../server/Database')
    const loggerPath = require.resolve('../../../server/Logger')

    // Save originals for cleanup
    this._originals = {
      databasePath,
      loggerPath,
      originalDatabase: require.cache[databasePath],
      originalLogger: require.cache[loggerPath]
    }

    // Replace with stubs
    require.cache[databasePath] = { id: databasePath, exports: DatabaseStub }
    require.cache[loggerPath] = { id: loggerPath, exports: LoggerStub }

    // Now require the real class
    OidcAuthStrategy = require('../../../server/auth/OidcAuthStrategy')
    strategy = new OidcAuthStrategy()
  })

  afterEach(function () {
    const { databasePath, loggerPath, originalDatabase, originalLogger } = this._originals
    if (originalDatabase) require.cache[databasePath] = originalDatabase
    else delete require.cache[databasePath]
    if (originalLogger) require.cache[loggerPath] = originalLogger
    else delete require.cache[loggerPath]

    delete require.cache[require.resolve('../../../server/auth/OidcAuthStrategy')]
    delete global.RouterBasePath
    sinon.restore()
  })

  // ── setUserGroup ─────────────────────────────────────────────────────

  describe('setUserGroup', function () {
    describe('legacy direct name match (empty groupMap)', function () {
      it('should assign admin role when group list includes admin', async function () {
        DatabaseStub.serverSettings.authOpenIDGroupClaim = 'groups'
        global.ServerSettings.authOpenIDGroupMap = {}

        const user = { type: 'user', username: 'testuser', save: sinon.stub().resolves() }
        await strategy.setUserGroup(user, { groups: ['Admin', 'Users'] })
        expect(user.type).to.equal('admin')
        expect(user.save.calledOnce).to.be.true
      })

      it('should assign user role when group list includes user but not admin', async function () {
        DatabaseStub.serverSettings.authOpenIDGroupClaim = 'groups'
        global.ServerSettings.authOpenIDGroupMap = {}

        const user = { type: 'guest', username: 'testuser', save: sinon.stub().resolves() }
        await strategy.setUserGroup(user, { groups: ['User', 'Guests'] })
        expect(user.type).to.equal('user')
      })

      it('should throw when no valid group found', async function () {
        DatabaseStub.serverSettings.authOpenIDGroupClaim = 'groups'
        global.ServerSettings.authOpenIDGroupMap = {}

        const user = { type: 'user', username: 'testuser', save: sinon.stub().resolves() }
        try {
          await strategy.setUserGroup(user, { groups: ['unknown-group'] })
          expect.fail('Should have thrown')
        } catch (error) {
          expect(error).to.be.instanceOf(AuthError)
          expect(error.statusCode).to.equal(401)
          expect(error.message).to.include('No valid group found')
        }
      })
    })

    describe('explicit group mapping', function () {
      it('should map custom group names to roles', async function () {
        DatabaseStub.serverSettings.authOpenIDGroupClaim = 'groups'
        global.ServerSettings.authOpenIDGroupMap = { 'oidc-admins': 'admin', 'oidc-users': 'user', 'oidc-guests': 'guest' }

        const user = { type: 'guest', username: 'testuser', save: sinon.stub().resolves() }
        await strategy.setUserGroup(user, { groups: ['oidc-users'] })
        expect(user.type).to.equal('user')
      })

      it('should prioritize admin over user', async function () {
        DatabaseStub.serverSettings.authOpenIDGroupClaim = 'groups'
        global.ServerSettings.authOpenIDGroupMap = { 'team-leads': 'admin', 'developers': 'user' }

        const user = { type: 'user', username: 'testuser', save: sinon.stub().resolves() }
        await strategy.setUserGroup(user, { groups: ['developers', 'team-leads'] })
        expect(user.type).to.equal('admin')
      })

      it('should be case-insensitive for group matching', async function () {
        DatabaseStub.serverSettings.authOpenIDGroupClaim = 'groups'
        global.ServerSettings.authOpenIDGroupMap = { 'MyAdmins': 'admin' }

        const user = { type: 'user', username: 'testuser', save: sinon.stub().resolves() }
        await strategy.setUserGroup(user, { groups: ['myadmins'] })
        expect(user.type).to.equal('admin')
      })

      it('should throw when no mapped group matches', async function () {
        DatabaseStub.serverSettings.authOpenIDGroupClaim = 'groups'
        global.ServerSettings.authOpenIDGroupMap = { 'admins': 'admin' }

        const user = { type: 'user', username: 'testuser', save: sinon.stub().resolves() }
        try {
          await strategy.setUserGroup(user, { groups: ['random-group'] })
          expect.fail('Should have thrown')
        } catch (error) {
          expect(error).to.be.instanceOf(AuthError)
          expect(error.statusCode).to.equal(401)
        }
      })
    })

    describe('root user protection', function () {
      it('should not downgrade root user to non-admin', async function () {
        DatabaseStub.serverSettings.authOpenIDGroupClaim = 'groups'
        global.ServerSettings.authOpenIDGroupMap = {}

        const user = { type: 'root', username: 'root', save: sinon.stub().resolves() }
        try {
          await strategy.setUserGroup(user, { groups: ['user'] })
          expect.fail('Should have thrown')
        } catch (error) {
          expect(error).to.be.instanceOf(AuthError)
          expect(error.statusCode).to.equal(403)
          expect(error.message).to.include('cannot be downgraded')
        }
      })

      it('should allow root user with admin group (no change)', async function () {
        DatabaseStub.serverSettings.authOpenIDGroupClaim = 'groups'
        global.ServerSettings.authOpenIDGroupMap = {}

        const user = { type: 'root', username: 'root', save: sinon.stub().resolves() }
        await strategy.setUserGroup(user, { groups: ['admin'] })
        expect(user.type).to.equal('root')
        expect(user.save.called).to.be.false
      })
    })

    describe('no group claim configured', function () {
      it('should do nothing when authOpenIDGroupClaim is empty', async function () {
        DatabaseStub.serverSettings.authOpenIDGroupClaim = ''

        const user = { type: 'user', username: 'testuser', save: sinon.stub().resolves() }
        await strategy.setUserGroup(user, { groups: ['admin'] })
        expect(user.type).to.equal('user')
        expect(user.save.called).to.be.false
      })
    })

    describe('single string claim', function () {
      it('should handle a single string group value', async function () {
        DatabaseStub.serverSettings.authOpenIDGroupClaim = 'groups'
        global.ServerSettings.authOpenIDGroupMap = {}

        const user = { type: 'guest', username: 'testuser', save: sinon.stub().resolves() }
        await strategy.setUserGroup(user, { groups: 'admin' })
        expect(user.type).to.equal('admin')
      })
    })

    describe('object-shaped claims (e.g. Zitadel)', function () {
      it('should extract group names from object keys with legacy match', async function () {
        DatabaseStub.serverSettings.authOpenIDGroupClaim = 'urn:zitadel:iam:org:project:roles'
        global.ServerSettings.authOpenIDGroupMap = {}

        const user = { type: 'user', username: 'testuser', save: sinon.stub().resolves() }
        await strategy.setUserGroup(user, {
          'urn:zitadel:iam:org:project:roles': {
            admin: { '359584706087354371': 'website.de' },
            user: { '359584706087354371': 'website.de' }
          }
        })
        expect(user.type).to.equal('admin')
      })

      it('should extract group names from object keys with explicit mapping', async function () {
        DatabaseStub.serverSettings.authOpenIDGroupClaim = 'urn:zitadel:iam:org:project:roles'
        global.ServerSettings.authOpenIDGroupMap = { 'zitadel-users': 'user', 'zitadel-admins': 'admin' }

        const user = { type: 'guest', username: 'testuser', save: sinon.stub().resolves() }
        await strategy.setUserGroup(user, {
          'urn:zitadel:iam:org:project:roles': {
            'zitadel-users': { '123': 'example.com' }
          }
        })
        expect(user.type).to.equal('user')
      })

      it('should throw when no matching group in object keys', async function () {
        DatabaseStub.serverSettings.authOpenIDGroupClaim = 'roles'
        global.ServerSettings.authOpenIDGroupMap = {}

        const user = { type: 'user', username: 'testuser', save: sinon.stub().resolves() }
        try {
          await strategy.setUserGroup(user, {
            roles: { 'some-unknown-role': { '123': 'example.com' } }
          })
          expect.fail('Should have thrown')
        } catch (error) {
          expect(error).to.be.instanceOf(AuthError)
          expect(error.statusCode).to.equal(401)
          expect(error.message).to.include('No valid group found')
        }
      })
    })

    describe('missing group claim in userinfo', function () {
      it('should throw when group claim is not in userinfo', async function () {
        DatabaseStub.serverSettings.authOpenIDGroupClaim = 'groups'

        const user = { type: 'user', username: 'testuser', save: sinon.stub().resolves() }
        try {
          await strategy.setUserGroup(user, { email: 'test@example.com' })
          expect.fail('Should have thrown')
        } catch (error) {
          expect(error).to.be.instanceOf(AuthError)
          expect(error.statusCode).to.equal(401)
          expect(error.message).to.include('Group claim groups not found')
        }
      })
    })
  })

  // ── validateGroupClaim ───────────────────────────────────────────────

  describe('validateGroupClaim', function () {
    it('should return true when no group claim is configured', function () {
      DatabaseStub.serverSettings.authOpenIDGroupClaim = ''
      expect(strategy.validateGroupClaim({ groups: ['admin'] })).to.be.true
      expect(strategy.validateGroupClaim({})).to.be.true
    })

    it('should return true when group claim exists in userinfo', function () {
      DatabaseStub.serverSettings.authOpenIDGroupClaim = 'groups'
      expect(strategy.validateGroupClaim({ groups: ['admin'] })).to.be.true
    })

    it('should return false when group claim is missing from userinfo', function () {
      DatabaseStub.serverSettings.authOpenIDGroupClaim = 'groups'
      expect(strategy.validateGroupClaim({ email: 'test@example.com' })).to.be.false
    })

    it('should return true when group claim is empty array', function () {
      DatabaseStub.serverSettings.authOpenIDGroupClaim = 'groups'
      // Empty array is falsy for the `!userinfo[groupClaimName]` check? No, [] is truthy.
      // Actually [] is truthy in JS, so this should return true
      expect(strategy.validateGroupClaim({ groups: [] })).to.be.true
    })

    it('should work with custom claim names', function () {
      DatabaseStub.serverSettings.authOpenIDGroupClaim = 'urn:zitadel:iam:org:project:roles'
      expect(strategy.validateGroupClaim({ 'urn:zitadel:iam:org:project:roles': ['admin'] })).to.be.true
      expect(strategy.validateGroupClaim({ groups: ['admin'] })).to.be.false
    })
  })

  // ── isValidRedirectUri ───────────────────────────────────────────────

  describe('isValidRedirectUri', function () {
    it('should accept URIs in the whitelist', function () {
      DatabaseStub.serverSettings.authOpenIDMobileRedirectURIs = ['audiobookshelf://oauth', 'myapp://callback']
      expect(strategy.isValidRedirectUri('audiobookshelf://oauth')).to.be.true
      expect(strategy.isValidRedirectUri('myapp://callback')).to.be.true
    })

    it('should reject URIs not in the whitelist', function () {
      DatabaseStub.serverSettings.authOpenIDMobileRedirectURIs = ['audiobookshelf://oauth']
      expect(strategy.isValidRedirectUri('evil://callback')).to.be.false
      expect(strategy.isValidRedirectUri('audiobookshelf://other')).to.be.false
    })

    it('should reject empty string', function () {
      DatabaseStub.serverSettings.authOpenIDMobileRedirectURIs = ['audiobookshelf://oauth']
      expect(strategy.isValidRedirectUri('')).to.be.false
    })

    it('should handle empty whitelist', function () {
      DatabaseStub.serverSettings.authOpenIDMobileRedirectURIs = []
      expect(strategy.isValidRedirectUri('audiobookshelf://oauth')).to.be.false
    })

    it('should require exact match (no partial matching)', function () {
      DatabaseStub.serverSettings.authOpenIDMobileRedirectURIs = ['audiobookshelf://oauth']
      expect(strategy.isValidRedirectUri('audiobookshelf://oauth/extra')).to.be.false
      expect(strategy.isValidRedirectUri('audiobookshelf://oaut')).to.be.false
    })
  })

  // ── isValidWebCallbackUrl ────────────────────────────────────────────

  describe('isValidWebCallbackUrl', function () {
    function makeReq(host, secure, xfp) {
      return {
        secure: !!secure,
        get: (header) => {
          if (header === 'host') return host
          if (header === 'x-forwarded-proto') return xfp || ''
          return ''
        }
      }
    }

    it('should accept relative URL starting with router base path', function () {
      global.RouterBasePath = '/audiobookshelf'
      const req = makeReq('example.com')
      expect(strategy.isValidWebCallbackUrl('/audiobookshelf/login', req)).to.be.true
      expect(strategy.isValidWebCallbackUrl('/audiobookshelf/', req)).to.be.true
    })

    it('should reject relative URL outside router base path', function () {
      global.RouterBasePath = '/audiobookshelf'
      const req = makeReq('example.com')
      expect(strategy.isValidWebCallbackUrl('/evil/path', req)).to.be.false
      expect(strategy.isValidWebCallbackUrl('/audiobookshel/typo', req)).to.be.false
    })

    it('should accept same-origin absolute URL with matching path', function () {
      global.RouterBasePath = '/audiobookshelf'
      const req = makeReq('example.com:3333', false)
      expect(strategy.isValidWebCallbackUrl('http://example.com:3333/audiobookshelf/login', req)).to.be.true
    })

    it('should reject absolute URL with different host', function () {
      global.RouterBasePath = '/audiobookshelf'
      const req = makeReq('example.com', false)
      expect(strategy.isValidWebCallbackUrl('http://evil.com/audiobookshelf/login', req)).to.be.false
    })

    it('should reject absolute URL with different protocol', function () {
      global.RouterBasePath = '/audiobookshelf'
      const req = makeReq('example.com', true)
      expect(strategy.isValidWebCallbackUrl('http://example.com/audiobookshelf/login', req)).to.be.false
    })

    it('should accept https URL when behind reverse proxy (x-forwarded-proto)', function () {
      global.RouterBasePath = '/audiobookshelf'
      const req = makeReq('example.com', false, 'https')
      expect(strategy.isValidWebCallbackUrl('https://example.com/audiobookshelf/login', req)).to.be.true
    })

    it('should handle multiple x-forwarded-proto values', function () {
      global.RouterBasePath = '/audiobookshelf'
      const req = makeReq('example.com', false, 'https, http')
      expect(strategy.isValidWebCallbackUrl('https://example.com/audiobookshelf/login', req)).to.be.true
    })

    it('should reject same-origin URL with path outside router base', function () {
      global.RouterBasePath = '/audiobookshelf'
      const req = makeReq('example.com', false)
      expect(strategy.isValidWebCallbackUrl('http://example.com/evil/path', req)).to.be.false
    })

    it('should reject null or empty callback URL', function () {
      const req = makeReq('example.com')
      expect(strategy.isValidWebCallbackUrl(null, req)).to.be.false
      expect(strategy.isValidWebCallbackUrl('', req)).to.be.false
    })

    it('should reject malformed URLs gracefully', function () {
      const req = makeReq('example.com')
      expect(strategy.isValidWebCallbackUrl('not-a-valid-url', req)).to.be.false
    })

    it('should work with root router base path', function () {
      global.RouterBasePath = ''
      const req = makeReq('example.com', false)
      expect(strategy.isValidWebCallbackUrl('http://example.com/login', req)).to.be.true
    })
  })

  // ── updateUserPermissions ────────────────────────────────────────────

  describe('updateUserPermissions', function () {
    it('should do nothing when no advanced permissions claim is configured', async function () {
      DatabaseStub.serverSettings.authOpenIDAdvancedPermsClaim = ''
      const user = { type: 'user', username: 'testuser', updatePermissionsFromExternalJSON: sinon.stub() }
      await strategy.updateUserPermissions(user, { perms: '{}' })
      expect(user.updatePermissionsFromExternalJSON.called).to.be.false
    })

    it('should skip admin users', async function () {
      DatabaseStub.serverSettings.authOpenIDAdvancedPermsClaim = 'abs_perms'
      const user = { type: 'admin', username: 'adminuser', updatePermissionsFromExternalJSON: sinon.stub() }
      await strategy.updateUserPermissions(user, { abs_perms: { canUpload: true } })
      expect(user.updatePermissionsFromExternalJSON.called).to.be.false
    })

    it('should skip root users', async function () {
      DatabaseStub.serverSettings.authOpenIDAdvancedPermsClaim = 'abs_perms'
      const user = { type: 'root', username: 'root', updatePermissionsFromExternalJSON: sinon.stub() }
      await strategy.updateUserPermissions(user, { abs_perms: { canUpload: true } })
      expect(user.updatePermissionsFromExternalJSON.called).to.be.false
    })

    it('should update permissions for non-admin user', async function () {
      DatabaseStub.serverSettings.authOpenIDAdvancedPermsClaim = 'abs_perms'
      const permsData = { canUpload: true, canDelete: false }
      const user = { type: 'user', username: 'testuser', updatePermissionsFromExternalJSON: sinon.stub().resolves(true) }

      await strategy.updateUserPermissions(user, { abs_perms: permsData })
      expect(user.updatePermissionsFromExternalJSON.calledOnce).to.be.true
      expect(user.updatePermissionsFromExternalJSON.firstCall.args[0]).to.deep.equal(permsData)
    })

    it('should throw when claim is configured but missing from userinfo', async function () {
      DatabaseStub.serverSettings.authOpenIDAdvancedPermsClaim = 'abs_perms'
      const user = { type: 'user', username: 'testuser', updatePermissionsFromExternalJSON: sinon.stub() }

      try {
        await strategy.updateUserPermissions(user, { email: 'test@example.com' })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(AuthError)
        expect(error.statusCode).to.equal(401)
        expect(error.message).to.include('abs_perms')
      }
    })

    it('should work for guest users', async function () {
      DatabaseStub.serverSettings.authOpenIDAdvancedPermsClaim = 'abs_perms'
      const user = { type: 'guest', username: 'guestuser', updatePermissionsFromExternalJSON: sinon.stub().resolves(false) }

      await strategy.updateUserPermissions(user, { abs_perms: { canUpload: false } })
      expect(user.updatePermissionsFromExternalJSON.calledOnce).to.be.true
    })
  })

  // ── verifyUser ───────────────────────────────────────────────────────

  describe('verifyUser', function () {
    function makeUser(overrides = {}) {
      return {
        id: 'user-123',
        username: 'testuser',
        type: 'user',
        isActive: true,
        save: sinon.stub().resolves(),
        destroy: sinon.stub().resolves(),
        updatePermissionsFromExternalJSON: sinon.stub().resolves(false),
        ...overrides
      }
    }

    it('should return existing user on successful verification', async function () {
      const existingUser = makeUser()
      DatabaseStub.userModel.findUserFromOpenIdUserInfo.resolves(existingUser)

      const tokenset = { id_token: 'test-id-token' }
      const userinfo = { sub: 'oidc-sub-123', email: 'test@example.com' }

      const result = await strategy.verifyUser(tokenset, userinfo)
      expect(result).to.equal(existingUser)
      expect(result.openid_id_token).to.equal('test-id-token')
      expect(DatabaseStub.userModel.findUserFromOpenIdUserInfo.calledOnce).to.be.true
    })

    it('should throw when userinfo has no sub', async function () {
      try {
        await strategy.verifyUser({ id_token: 'tok' }, { email: 'test@example.com' })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(AuthError)
        expect(error.message).to.include('no sub')
      }
    })

    it('should throw when group claim validation fails', async function () {
      DatabaseStub.serverSettings.authOpenIDGroupClaim = 'groups'

      try {
        await strategy.verifyUser({ id_token: 'tok' }, { sub: 'sub-1', email: 'test@example.com' })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(AuthError)
        expect(error.message).to.include('Group claim')
      }
    })

    it('should throw when email_verified is false and enforcement is on', async function () {
      global.ServerSettings.authOpenIDRequireVerifiedEmail = true
      DatabaseStub.userModel.findUserFromOpenIdUserInfo.resolves(makeUser())

      try {
        await strategy.verifyUser({ id_token: 'tok' }, { sub: 'sub-1', email: 'test@example.com', email_verified: false })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(AuthError)
        expect(error.message).to.include('not verified')
      }
    })

    it('should allow login when email_verified is true and enforcement is on', async function () {
      global.ServerSettings.authOpenIDRequireVerifiedEmail = true
      const user = makeUser()
      DatabaseStub.userModel.findUserFromOpenIdUserInfo.resolves(user)

      const result = await strategy.verifyUser({ id_token: 'tok' }, { sub: 'sub-1', email: 'a@b.com', email_verified: true })
      expect(result).to.equal(user)
    })

    it('should reject login when email_verified is missing and enforcement is on', async function () {
      global.ServerSettings.authOpenIDRequireVerifiedEmail = true

      try {
        await strategy.verifyUser({ id_token: 'tok' }, { sub: 'sub-1', email: 'a@b.com' })
        expect.fail('should have thrown')
      } catch (err) {
        expect(err.message).to.equal('Email is not verified')
        expect(err.statusCode).to.equal(401)
      }
    })

    it('should auto-register new user when enabled', async function () {
      global.ServerSettings.authOpenIDAutoRegister = true
      const newUser = makeUser({ username: 'newuser' })
      DatabaseStub.userModel.findUserFromOpenIdUserInfo.resolves(null)
      DatabaseStub.userModel.createUserFromOpenIdUserInfo.resolves(newUser)

      const result = await strategy.verifyUser({ id_token: 'tok' }, { sub: 'new-sub', email: 'new@example.com' })
      expect(result).to.equal(newUser)
      expect(DatabaseStub.userModel.createUserFromOpenIdUserInfo.calledOnce).to.be.true
    })

    it('should throw when user not found and auto-register is disabled', async function () {
      global.ServerSettings.authOpenIDAutoRegister = false
      DatabaseStub.userModel.findUserFromOpenIdUserInfo.resolves(null)

      try {
        await strategy.verifyUser({ id_token: 'tok' }, { sub: 'unknown-sub' })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(AuthError)
        expect(error.message).to.include('auto-register is disabled')
      }
    })

    it('should throw when user is inactive', async function () {
      DatabaseStub.userModel.findUserFromOpenIdUserInfo.resolves(makeUser({ isActive: false }))

      try {
        await strategy.verifyUser({ id_token: 'tok' }, { sub: 'sub-1' })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(AuthError)
        expect(error.message).to.include('not active')
      }
    })

    it('should throw when findUserFromOpenIdUserInfo returns error object', async function () {
      DatabaseStub.userModel.findUserFromOpenIdUserInfo.resolves({ error: 'already linked' })

      try {
        await strategy.verifyUser({ id_token: 'tok' }, { sub: 'sub-1' })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(AuthError)
        expect(error.message).to.include('already linked')
      }
    })

    it('should destroy new user if setUserGroup fails', async function () {
      global.ServerSettings.authOpenIDAutoRegister = true
      DatabaseStub.serverSettings.authOpenIDGroupClaim = 'groups'
      global.ServerSettings.authOpenIDGroupMap = {}
      const newUser = makeUser({ username: 'newuser' })
      DatabaseStub.userModel.findUserFromOpenIdUserInfo.resolves(null)
      DatabaseStub.userModel.createUserFromOpenIdUserInfo.resolves(newUser)

      try {
        // groups claim present but no valid role found
        await strategy.verifyUser({ id_token: 'tok' }, { sub: 'new-sub', groups: ['unknown-group'] })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(newUser.destroy.calledOnce).to.be.true
      }
    })

    it('should not destroy existing user on error', async function () {
      DatabaseStub.serverSettings.authOpenIDGroupClaim = 'groups'
      global.ServerSettings.authOpenIDGroupMap = {}
      const existingUser = makeUser()
      DatabaseStub.userModel.findUserFromOpenIdUserInfo.resolves(existingUser)

      try {
        await strategy.verifyUser({ id_token: 'tok' }, { sub: 'sub-1', groups: ['unknown-group'] })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(existingUser.destroy.called).to.be.false
      }
    })
  })

  // ── handleCallback ───────────────────────────────────────────────────

  describe('handleCallback', function () {
    let mockClient

    beforeEach(function () {
      mockClient = {
        callbackParams: sinon.stub().returns({ code: 'auth-code' }),
        callback: sinon.stub(),
        userinfo: sinon.stub()
      }
      sinon.stub(strategy, 'getClient').returns(mockClient)
    })

    it('should handle web flow using express session data', async function () {
      const mockUser = { id: 'user-1', username: 'test' }
      const mockTokenset = {
        access_token: 'at-123',
        id_token: 'idt-123',
        claims: sinon.stub().returns({ sid: 'session-456' })
      }
      mockClient.callback.resolves(mockTokenset)
      mockClient.userinfo.resolves({ sub: 'sub-1' })
      sinon.stub(strategy, 'verifyUser').resolves(mockUser)

      const req = {
        session: {
          oidc: {
            state: 'web-state',
            nonce: 'web-nonce',
            sso_redirect_uri: 'http://localhost/auth/openid/callback',
            code_verifier: 'web-verifier'
          }
        },
        query: {}
      }

      const result = await strategy.handleCallback(req)
      expect(result.user).to.equal(mockUser)
      expect(result.isMobileCallback).to.be.false

      // Verify token exchange was called with correct parameters
      expect(mockClient.callback.calledOnce).to.be.true
      const [redirectUri, , checks] = mockClient.callback.firstCall.args
      expect(redirectUri).to.equal('http://localhost/auth/openid/callback')
      expect(checks.state).to.equal('web-state')
      expect(checks.nonce).to.equal('web-nonce')
      expect(checks.code_verifier).to.equal('web-verifier')
      expect(checks.response_type).to.equal('code')
    })

    it('should fall back to openIdAuthSession Map for mobile flow', async function () {
      const mockUser = { id: 'user-1', username: 'test' }
      const mockTokenset = {
        access_token: 'at-123',
        id_token: 'idt-123',
        claims: sinon.stub().returns({})
      }
      mockClient.callback.resolves(mockTokenset)
      mockClient.userinfo.resolves({ sub: 'sub-1' })
      sinon.stub(strategy, 'verifyUser').resolves(mockUser)

      // Pre-populate Map as if getAuthorizationUrl stored mobile session
      // Note: mobile flow does not use nonce (relies on PKCE instead)
      strategy.openIdAuthSession.set('mobile-state', {
        sso_redirect_uri: 'http://localhost/auth/openid/mobile-redirect',
        mobile_redirect_uri: 'audiobookshelf://oauth'
      })

      const req = {
        session: {}, // No oidc session (mobile system browser != app)
        query: { state: 'mobile-state', code_verifier: 'mobile-verifier' }
      }

      const result = await strategy.handleCallback(req)
      expect(result.isMobileCallback).to.be.true
      expect(result.user).to.equal(mockUser)

      // Should delete the Map entry after use
      expect(strategy.openIdAuthSession.has('mobile-state')).to.be.false

      // Should use code_verifier from query; nonce is undefined for mobile flow
      const [, , checks] = mockClient.callback.firstCall.args
      expect(checks.nonce).to.be.undefined
      expect(checks.code_verifier).to.equal('mobile-verifier')
    })

    it('should throw AuthError when no session and no matching state', async function () {
      const req = {
        session: {},
        query: { state: 'unknown-state' }
      }

      try {
        await strategy.handleCallback(req)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(AuthError)
        expect(error.statusCode).to.equal(400)
        expect(error.message).to.include('No OIDC session found')
      }
    })

    it('should throw when no session and no state parameter at all', async function () {
      const req = {
        session: {},
        query: {}
      }

      try {
        await strategy.handleCallback(req)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(AuthError)
        expect(error.statusCode).to.equal(400)
      }
    })

    it('should extract sid from id_token claims for backchannel logout', async function () {
      const mockUser = { id: 'user-1' }
      const mockTokenset = {
        access_token: 'at-123',
        id_token: 'idt-123',
        claims: sinon.stub().returns({ sid: 'oidc-sid-789' })
      }
      mockClient.callback.resolves(mockTokenset)
      mockClient.userinfo.resolves({ sub: 'sub-1' })
      sinon.stub(strategy, 'verifyUser').resolves(mockUser)

      const req = {
        session: { oidc: { state: 's', nonce: 'n', sso_redirect_uri: 'http://x', code_verifier: 'v' } },
        query: {}
      }

      const result = await strategy.handleCallback(req)
      expect(result.user.openid_session_id).to.equal('oidc-sid-789')
    })

    it('should set openid_session_id to null when no sid in claims', async function () {
      const mockUser = { id: 'user-1' }
      const mockTokenset = {
        access_token: 'at-123',
        id_token: 'idt-123',
        claims: sinon.stub().returns({})
      }
      mockClient.callback.resolves(mockTokenset)
      mockClient.userinfo.resolves({ sub: 'sub-1' })
      sinon.stub(strategy, 'verifyUser').resolves(mockUser)

      const req = {
        session: { oidc: { state: 's', nonce: 'n', sso_redirect_uri: 'http://x', code_verifier: 'v' } },
        query: {}
      }

      const result = await strategy.handleCallback(req)
      expect(result.user.openid_session_id).to.be.null
    })


    it('should call userinfo with the access token', async function () {
      const mockUser = { id: 'user-1' }
      const mockTokenset = { access_token: 'the-access-token', id_token: 'idt', claims: () => ({}) }
      mockClient.callback.resolves(mockTokenset)
      mockClient.userinfo.resolves({ sub: 'sub-1' })
      sinon.stub(strategy, 'verifyUser').resolves(mockUser)

      const req = {
        session: { oidc: { state: 's', nonce: 'n', sso_redirect_uri: 'http://x', code_verifier: 'v' } },
        query: {}
      }

      await strategy.handleCallback(req)
      expect(mockClient.userinfo.calledOnceWith('the-access-token')).to.be.true
    })

    it('should propagate errors from token exchange', async function () {
      mockClient.callback.rejects(new Error('invalid_grant'))

      const req = {
        session: { oidc: { state: 's', nonce: 'n', sso_redirect_uri: 'http://x', code_verifier: 'v' } },
        query: {}
      }

      try {
        await strategy.handleCallback(req)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error.message).to.include('invalid_grant')
      }
    })

    it('should propagate errors from verifyUser', async function () {
      const mockTokenset = { access_token: 'at', id_token: 'idt', claims: () => ({}) }
      mockClient.callback.resolves(mockTokenset)
      mockClient.userinfo.resolves({ sub: 'sub-1' })
      sinon.stub(strategy, 'verifyUser').rejects(new AuthError('Group claim not found', 401))

      const req = {
        session: { oidc: { state: 's', nonce: 'n', sso_redirect_uri: 'http://x', code_verifier: 'v' } },
        query: {}
      }

      try {
        await strategy.handleCallback(req)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(AuthError)
        expect(error.message).to.include('Group claim not found')
      }
    })
  })

  // ── getAuthorizationUrl ──────────────────────────────────────────────

  describe('getAuthorizationUrl', function () {
    let mockClient

    beforeEach(function () {
      mockClient = {
        authorizationUrl: sinon.stub().returns('https://idp.example.com/authorize?params')
      }
      sinon.stub(strategy, 'getClient').returns(mockClient)
      sinon.stub(OpenIDClient.generators, 'random').returns('mock-state')
      sinon.stub(OpenIDClient.generators, 'nonce').returns('mock-nonce')
      global.ServerSettings.authOpenIDSubfolderForRedirectURLs = ''
    })

    function makeReq(overrides = {}) {
      const req = {
        secure: false,
        get: (header) => {
          if (header === 'host') return 'example.com:3333'
          if (header === 'x-forwarded-proto') return ''
          return ''
        },
        query: {},
        session: {},
        ...overrides
      }
      return req
    }

    it('should generate authorization URL for web flow', function () {
      sinon.stub(strategy, 'generatePkce').returns({
        code_challenge: 'challenge-123',
        code_challenge_method: 'S256',
        code_verifier: 'verifier-123'
      })

      const result = strategy.getAuthorizationUrl(makeReq(), false, '/login')

      expect(result.authorizationUrl).to.equal('https://idp.example.com/authorize?params')
      expect(result.isMobileFlow).to.be.false
      expect(mockClient.authorizationUrl.calledOnce).to.be.true

      const params = mockClient.authorizationUrl.firstCall.args[0]
      expect(params.redirect_uri).to.equal('http://example.com:3333/auth/openid/callback')
      expect(params.state).to.equal('mock-state')
      expect(params.nonce).to.equal('mock-nonce')
      expect(params.response_type).to.equal('code')
      expect(params.code_challenge).to.equal('challenge-123')
      expect(params.code_challenge_method).to.equal('S256')
    })

    it('should store OIDC data in express session for web flow', function () {
      sinon.stub(strategy, 'generatePkce').returns({
        code_challenge: 'c', code_challenge_method: 'S256', code_verifier: 'v'
      })

      const req = makeReq()
      strategy.getAuthorizationUrl(req, false, '/login')

      expect(req.session.oidc).to.deep.include({
        state: 'mock-state',
        nonce: 'mock-nonce',
        isMobile: false,
        code_verifier: 'v',
        callbackUrl: '/login'
      })
    })

    it('should reject state parameter on web flow', function () {
      const req = makeReq({ query: { state: 'evil-state' } })
      sinon.stub(strategy, 'generatePkce').returns({
        code_challenge: 'c', code_challenge_method: 'S256', code_verifier: 'v'
      })

      const result = strategy.getAuthorizationUrl(req, false, '/login')
      expect(result.status).to.equal(400)
      expect(result.error).to.include('not allowed on web flow')
    })

    it('should reject invalid response_type', function () {
      const req = makeReq({ query: { response_type: 'token' } })
      const result = strategy.getAuthorizationUrl(req, false, '/login')
      expect(result.status).to.equal(400)
      expect(result.error).to.include('only code supported')
    })

    it('should generate authorization URL for mobile flow', function () {
      sinon.stub(strategy, 'generatePkce').returns({
        code_challenge: 'mob-c', code_challenge_method: 'S256'
      })
      sinon.stub(strategy, 'isValidRedirectUri').returns(true)
      sinon.stub(strategy, 'cleanupStaleAuthSessions')

      const req = makeReq({
        query: { redirect_uri: 'audiobookshelf://oauth', state: 'mobile-state' }
      })

      const result = strategy.getAuthorizationUrl(req, true, null)

      expect(result.isMobileFlow).to.be.true
      const params = mockClient.authorizationUrl.firstCall.args[0]
      expect(params.redirect_uri).to.equal('http://example.com:3333/auth/openid/mobile-redirect')
      // Mobile uses client-supplied state
      expect(params.state).to.equal('mobile-state')
    })

    it('should store mobile session in openIdAuthSession Map', function () {
      sinon.stub(strategy, 'generatePkce').returns({
        code_challenge: 'c', code_challenge_method: 'S256'
      })
      sinon.stub(strategy, 'isValidRedirectUri').returns(true)
      sinon.stub(strategy, 'cleanupStaleAuthSessions')

      const req = makeReq({
        query: { redirect_uri: 'audiobookshelf://oauth', state: 'mob-state' }
      })

      strategy.getAuthorizationUrl(req, true, null)

      expect(strategy.openIdAuthSession.has('mob-state')).to.be.true
      const stored = strategy.openIdAuthSession.get('mob-state')
      expect(stored.mobile_redirect_uri).to.equal('audiobookshelf://oauth')
      expect(stored.nonce).to.be.undefined
      expect(stored.sso_redirect_uri).to.include('/auth/openid/mobile-redirect')
    })

    it('should reject invalid mobile redirect_uri', function () {
      sinon.stub(strategy, 'isValidRedirectUri').returns(false)
      sinon.stub(strategy, 'cleanupStaleAuthSessions')

      const req = makeReq({
        query: { redirect_uri: 'evil://callback' }
      })

      const result = strategy.getAuthorizationUrl(req, true, null)
      expect(result.status).to.equal(400)
      expect(result.error).to.include('Invalid redirect_uri')
    })

    it('should return error when PKCE fails for mobile', function () {
      sinon.stub(strategy, 'generatePkce').returns({ error: 'code_challenge required for mobile flow (PKCE)' })
      sinon.stub(strategy, 'isValidRedirectUri').returns(true)
      sinon.stub(strategy, 'cleanupStaleAuthSessions')

      const req = makeReq({
        query: { redirect_uri: 'audiobookshelf://oauth', state: 's' }
      })

      const result = strategy.getAuthorizationUrl(req, true, null)
      expect(result.status).to.equal(400)
      expect(result.error).to.include('code_challenge required')
    })

    it('should use subfolder in redirect URI when configured', function () {
      global.ServerSettings.authOpenIDSubfolderForRedirectURLs = '/audiobookshelf'
      sinon.stub(strategy, 'generatePkce').returns({
        code_challenge: 'c', code_challenge_method: 'S256', code_verifier: 'v'
      })

      strategy.getAuthorizationUrl(makeReq(), false, '/login')

      const params = mockClient.authorizationUrl.firstCall.args[0]
      expect(params.redirect_uri).to.equal('http://example.com:3333/audiobookshelf/auth/openid/callback')
    })

    it('should use https when request is secure', function () {
      sinon.stub(strategy, 'generatePkce').returns({
        code_challenge: 'c', code_challenge_method: 'S256', code_verifier: 'v'
      })

      const req = makeReq({ secure: true })
      strategy.getAuthorizationUrl(req, false, '/login')

      const params = mockClient.authorizationUrl.firstCall.args[0]
      expect(params.redirect_uri).to.match(/^https:/)
    })

    it('should use https when x-forwarded-proto is https', function () {
      sinon.stub(strategy, 'generatePkce').returns({
        code_challenge: 'c', code_challenge_method: 'S256', code_verifier: 'v'
      })

      const req = {
        secure: false,
        get: (h) => {
          if (h === 'host') return 'example.com'
          if (h === 'x-forwarded-proto') return 'https'
          return ''
        },
        query: {},
        session: {}
      }
      strategy.getAuthorizationUrl(req, false, '/login')

      const params = mockClient.authorizationUrl.firstCall.args[0]
      expect(params.redirect_uri).to.match(/^https:/)
    })

    it('should generate state for mobile flow when client does not supply one', function () {
      sinon.stub(strategy, 'generatePkce').returns({
        code_challenge: 'c', code_challenge_method: 'S256'
      })
      sinon.stub(strategy, 'isValidRedirectUri').returns(true)
      sinon.stub(strategy, 'cleanupStaleAuthSessions')

      const req = makeReq({
        query: { redirect_uri: 'audiobookshelf://oauth' }
      })

      strategy.getAuthorizationUrl(req, true, null)

      // When no state in query, generators.random() is called
      expect(OpenIDClient.generators.random.calledOnce).to.be.true
      const params = mockClient.authorizationUrl.firstCall.args[0]
      expect(params.state).to.equal('mock-state')
    })

    it('should use scope from getScope()', function () {
      global.ServerSettings.authOpenIDScopes = 'openid profile email groups'
      sinon.stub(strategy, 'generatePkce').returns({
        code_challenge: 'c', code_challenge_method: 'S256', code_verifier: 'v'
      })

      strategy.getAuthorizationUrl(makeReq(), false, '/login')

      const params = mockClient.authorizationUrl.firstCall.args[0]
      expect(params.scope).to.equal('openid profile email groups')
    })
  })

  // ── generatePkce ─────────────────────────────────────────────────────

  describe('generatePkce', function () {
    it('should generate PKCE for web flow', function () {
      sinon.stub(OpenIDClient.generators, 'codeVerifier').returns('gen-verifier')
      sinon.stub(OpenIDClient.generators, 'codeChallenge').returns('gen-challenge')

      const result = strategy.generatePkce({ query: {} }, false)
      expect(result.code_verifier).to.equal('gen-verifier')
      expect(result.code_challenge).to.equal('gen-challenge')
      expect(result.code_challenge_method).to.equal('S256')
    })

    it('should use client-provided code_challenge for mobile', function () {
      const req = { query: { code_challenge: 'client-challenge', code_challenge_method: 'S256' } }
      const result = strategy.generatePkce(req, true)

      expect(result.code_challenge).to.equal('client-challenge')
      expect(result.code_challenge_method).to.equal('S256')
      expect(result.code_verifier).to.be.undefined
    })

    it('should default code_challenge_method to S256 for mobile', function () {
      const req = { query: { code_challenge: 'cc' } }
      const result = strategy.generatePkce(req, true)

      expect(result.code_challenge_method).to.equal('S256')
    })

    it('should error when mobile has no code_challenge', function () {
      const result = strategy.generatePkce({ query: {} }, true)
      expect(result.error).to.include('code_challenge required')
    })

    it('should error when mobile uses non-S256 method', function () {
      const req = { query: { code_challenge: 'cc', code_challenge_method: 'plain' } }
      const result = strategy.generatePkce(req, true)
      expect(result.error).to.include('Only S256')
    })
  })

  // ── handleMobileRedirect ─────────────────────────────────────────────

  describe('handleMobileRedirect', function () {
    let res

    beforeEach(function () {
      res = {
        redirect: sinon.stub(),
        status: sinon.stub().returnsThis(),
        send: sinon.stub()
      }
    })

    it('should redirect to mobile app with code on success', function () {
      strategy.openIdAuthSession.set('valid-state', {
        mobile_redirect_uri: 'audiobookshelf://oauth',
        nonce: 'n',
        sso_redirect_uri: 'http://localhost/auth/openid/mobile-redirect'
      })

      const req = { query: { state: 'valid-state', code: 'auth-code-123' } }
      strategy.handleMobileRedirect(req, res)

      expect(res.redirect.calledOnce).to.be.true
      const redirectUrl = res.redirect.firstCall.args[0]
      expect(redirectUrl).to.include('audiobookshelf://oauth')
      expect(redirectUrl).to.include('code=auth-code-123')
      expect(redirectUrl).to.include('state=valid-state')
      // Should keep Map entry for the callback
      expect(strategy.openIdAuthSession.has('valid-state')).to.be.true
    })

    it('should forward IdP error to mobile app and clean up Map', function () {
      strategy.openIdAuthSession.set('err-state', {
        mobile_redirect_uri: 'audiobookshelf://oauth',
        nonce: 'n',
        sso_redirect_uri: 'http://localhost/auth/openid/mobile-redirect'
      })

      const req = { query: { state: 'err-state', error: 'access_denied', error_description: 'User denied' } }
      strategy.handleMobileRedirect(req, res)

      expect(res.redirect.calledOnce).to.be.true
      const redirectUrl = res.redirect.firstCall.args[0]
      expect(redirectUrl).to.include('error=access_denied')
      expect(redirectUrl).to.include('error_description=User+denied')
      // Should clean up Map on error
      expect(strategy.openIdAuthSession.has('err-state')).to.be.false
    })

    it('should return 400 when state is missing', function () {
      const req = { query: {} }
      strategy.handleMobileRedirect(req, res)

      expect(res.status.calledWith(400)).to.be.true
      expect(res.send.calledOnce).to.be.true
    })

    it('should return 400 when state is not in Map', function () {
      const req = { query: { state: 'unknown-state', code: 'code-123' } }
      strategy.handleMobileRedirect(req, res)

      expect(res.status.calledWith(400)).to.be.true
    })

    it('should return 400 when Map entry has no mobile_redirect_uri', function () {
      strategy.openIdAuthSession.set('no-uri-state', {
        nonce: 'n',
        sso_redirect_uri: 'http://localhost/auth/openid/mobile-redirect'
        // missing mobile_redirect_uri
      })

      const req = { query: { state: 'no-uri-state', code: 'code-123' } }
      strategy.handleMobileRedirect(req, res)

      expect(res.status.calledWith(400)).to.be.true
    })
  })

  // ── cleanupStaleAuthSessions ─────────────────────────────────────────

  describe('cleanupStaleAuthSessions', function () {
    it('should remove sessions older than 10 minutes', function () {
      const now = Date.now()
      strategy.openIdAuthSession.set('old', { created_at: now - 11 * 60 * 1000 })
      strategy.openIdAuthSession.set('fresh', { created_at: now - 1000 })

      strategy.cleanupStaleAuthSessions()

      expect(strategy.openIdAuthSession.has('old')).to.be.false
      expect(strategy.openIdAuthSession.has('fresh')).to.be.true
    })

    it('should enforce maximum size of 1000', function () {
      for (let i = 0; i < 1050; i++) {
        strategy.openIdAuthSession.set(`state-${i}`, { created_at: Date.now() })
      }

      strategy.cleanupStaleAuthSessions()

      expect(strategy.openIdAuthSession.size).to.be.at.most(1000)
    })

    it('should evict oldest entries first when over limit', function () {
      const now = Date.now()
      for (let i = 0; i < 1050; i++) {
        strategy.openIdAuthSession.set(`state-${i}`, { created_at: now + i })
      }

      strategy.cleanupStaleAuthSessions()

      // Oldest entries (lowest i) should be evicted
      expect(strategy.openIdAuthSession.has('state-0')).to.be.false
      // Newest entries should survive
      expect(strategy.openIdAuthSession.has('state-1049')).to.be.true
    })
  })
})
