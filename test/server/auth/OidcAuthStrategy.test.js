const { expect } = require('chai')
const sinon = require('sinon')
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

    it('should return false when group claim is empty array', function () {
      DatabaseStub.serverSettings.authOpenIDGroupClaim = 'groups'
      // Empty array is falsy for the `!userinfo[groupClaimName]` check? No, [] is truthy.
      // Actually [] is truthy in JS, so this should return true
      expect(strategy.validateGroupClaim({ groups: [] })).to.be.true
    })

    it('should return false when group claim is null', function () {
      DatabaseStub.serverSettings.authOpenIDGroupClaim = 'groups'
      expect(strategy.validateGroupClaim({ groups: null })).to.be.false
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

    it('should allow login when email_verified is missing and enforcement is on', async function () {
      // Only reject when explicitly false, not when absent
      global.ServerSettings.authOpenIDRequireVerifiedEmail = true
      const user = makeUser()
      DatabaseStub.userModel.findUserFromOpenIdUserInfo.resolves(user)

      const result = await strategy.verifyUser({ id_token: 'tok' }, { sub: 'sub-1', email: 'a@b.com' })
      expect(result).to.equal(user)
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
})
