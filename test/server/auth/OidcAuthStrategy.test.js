const { expect } = require('chai')
const sinon = require('sinon')
const AuthError = require('../../../server/auth/AuthError')

// Test the real OidcAuthStrategy.setUserGroup method by stubbing its dependencies
describe('OidcAuthStrategy - setUserGroup', function () {
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
      authOpenIDMobileRedirectURIs: []
    }

    DatabaseStub = {
      serverSettings: global.ServerSettings
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

    global.ServerSettings.authOpenIDGroupClaim = ''
    global.ServerSettings.authOpenIDGroupMap = {}
    sinon.restore()
  })

  describe('legacy direct name match (empty groupMap)', function () {
    it('should assign admin role when group list includes admin', async function () {
      global.ServerSettings.authOpenIDGroupClaim = 'groups'
      DatabaseStub.serverSettings.authOpenIDGroupClaim = 'groups'
      global.ServerSettings.authOpenIDGroupMap = {}

      const user = { type: 'user', username: 'testuser', save: sinon.stub().resolves() }
      const userinfo = { groups: ['Admin', 'Users'] }

      await strategy.setUserGroup(user, userinfo)
      expect(user.type).to.equal('admin')
      expect(user.save.calledOnce).to.be.true
    })

    it('should assign user role when group list includes user but not admin', async function () {
      global.ServerSettings.authOpenIDGroupClaim = 'groups'
      DatabaseStub.serverSettings.authOpenIDGroupClaim = 'groups'
      global.ServerSettings.authOpenIDGroupMap = {}

      const user = { type: 'guest', username: 'testuser', save: sinon.stub().resolves() }
      const userinfo = { groups: ['User', 'Guests'] }

      await strategy.setUserGroup(user, userinfo)
      expect(user.type).to.equal('user')
    })

    it('should throw when no valid group found', async function () {
      global.ServerSettings.authOpenIDGroupClaim = 'groups'
      DatabaseStub.serverSettings.authOpenIDGroupClaim = 'groups'
      global.ServerSettings.authOpenIDGroupMap = {}

      const user = { type: 'user', username: 'testuser', save: sinon.stub().resolves() }
      const userinfo = { groups: ['unknown-group'] }

      try {
        await strategy.setUserGroup(user, userinfo)
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
      global.ServerSettings.authOpenIDGroupClaim = 'groups'
      DatabaseStub.serverSettings.authOpenIDGroupClaim = 'groups'
      global.ServerSettings.authOpenIDGroupMap = {
        'oidc-admins': 'admin',
        'oidc-users': 'user',
        'oidc-guests': 'guest'
      }

      const user = { type: 'guest', username: 'testuser', save: sinon.stub().resolves() }
      const userinfo = { groups: ['oidc-users'] }

      await strategy.setUserGroup(user, userinfo)
      expect(user.type).to.equal('user')
    })

    it('should prioritize admin over user', async function () {
      global.ServerSettings.authOpenIDGroupClaim = 'groups'
      DatabaseStub.serverSettings.authOpenIDGroupClaim = 'groups'
      global.ServerSettings.authOpenIDGroupMap = {
        'team-leads': 'admin',
        'developers': 'user'
      }

      const user = { type: 'user', username: 'testuser', save: sinon.stub().resolves() }
      const userinfo = { groups: ['developers', 'team-leads'] }

      await strategy.setUserGroup(user, userinfo)
      expect(user.type).to.equal('admin')
    })

    it('should be case-insensitive for group matching', async function () {
      global.ServerSettings.authOpenIDGroupClaim = 'groups'
      DatabaseStub.serverSettings.authOpenIDGroupClaim = 'groups'
      global.ServerSettings.authOpenIDGroupMap = {
        'MyAdmins': 'admin'
      }

      const user = { type: 'user', username: 'testuser', save: sinon.stub().resolves() }
      const userinfo = { groups: ['myadmins'] }

      await strategy.setUserGroup(user, userinfo)
      expect(user.type).to.equal('admin')
    })

    it('should throw when no mapped group matches', async function () {
      global.ServerSettings.authOpenIDGroupClaim = 'groups'
      DatabaseStub.serverSettings.authOpenIDGroupClaim = 'groups'
      global.ServerSettings.authOpenIDGroupMap = {
        'admins': 'admin'
      }

      const user = { type: 'user', username: 'testuser', save: sinon.stub().resolves() }
      const userinfo = { groups: ['random-group'] }

      try {
        await strategy.setUserGroup(user, userinfo)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(AuthError)
        expect(error.statusCode).to.equal(401)
      }
    })
  })

  describe('root user protection', function () {
    it('should not downgrade root user to non-admin', async function () {
      global.ServerSettings.authOpenIDGroupClaim = 'groups'
      DatabaseStub.serverSettings.authOpenIDGroupClaim = 'groups'
      global.ServerSettings.authOpenIDGroupMap = {}

      const user = { type: 'root', username: 'root', save: sinon.stub().resolves() }
      const userinfo = { groups: ['user'] }

      try {
        await strategy.setUserGroup(user, userinfo)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(AuthError)
        expect(error.statusCode).to.equal(403)
        expect(error.message).to.include('cannot be downgraded')
      }
    })

    it('should allow root user with admin group (no change)', async function () {
      global.ServerSettings.authOpenIDGroupClaim = 'groups'
      DatabaseStub.serverSettings.authOpenIDGroupClaim = 'groups'
      global.ServerSettings.authOpenIDGroupMap = {}

      const user = { type: 'root', username: 'root', save: sinon.stub().resolves() }
      const userinfo = { groups: ['admin'] }

      await strategy.setUserGroup(user, userinfo)
      expect(user.type).to.equal('root') // unchanged
      expect(user.save.called).to.be.false
    })
  })

  describe('no group claim configured', function () {
    it('should do nothing when authOpenIDGroupClaim is empty', async function () {
      global.ServerSettings.authOpenIDGroupClaim = ''
      DatabaseStub.serverSettings.authOpenIDGroupClaim = ''

      const user = { type: 'user', username: 'testuser', save: sinon.stub().resolves() }
      const userinfo = { groups: ['admin'] }

      await strategy.setUserGroup(user, userinfo)
      expect(user.type).to.equal('user') // unchanged
      expect(user.save.called).to.be.false
    })
  })

  describe('missing group claim in userinfo', function () {
    it('should throw when group claim is not in userinfo', async function () {
      global.ServerSettings.authOpenIDGroupClaim = 'groups'
      DatabaseStub.serverSettings.authOpenIDGroupClaim = 'groups'

      const user = { type: 'user', username: 'testuser', save: sinon.stub().resolves() }
      const userinfo = { email: 'test@example.com' }

      try {
        await strategy.setUserGroup(user, userinfo)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(AuthError)
        expect(error.statusCode).to.equal(401)
        expect(error.message).to.include('Group claim groups not found')
      }
    })
  })
})
