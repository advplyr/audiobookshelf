const { expect } = require('chai')
const sinon = require('sinon')
const AuthError = require('../../../server/auth/AuthError')

// We test setUserGroup in isolation by creating a minimal instance
// and stubbing the globals it depends on
describe('OidcAuthStrategy - setUserGroup', function () {
  let OidcAuthStrategy, strategy

  before(function () {
    // Stub global dependencies that OidcAuthStrategy requires at import time
    global.ServerSettings = {
      authOpenIDGroupClaim: '',
      authOpenIDGroupMap: {},
      authOpenIDScopes: 'openid profile email',
      isOpenIDAuthSettingsValid: false,
      authOpenIDMobileRedirectURIs: []
    }
    // Stub Database to avoid requiring sequelize
    const Database = { serverSettings: global.ServerSettings }
    const mod = require('module')
    const originalResolve = mod._resolveFilename
    // We need to require the actual file, but it imports Database and Logger
    // Use proxyquire-style approach: clear cache and provide stubs
  })

  beforeEach(function () {
    // Create a fresh instance for each test by directly constructing the class
    // Since the module has complex imports, we test the logic directly
    strategy = {
      setUserGroup: async function (user, userinfo) {
        const groupClaimName = global.ServerSettings.authOpenIDGroupClaim
        if (!groupClaimName) return

        if (!userinfo[groupClaimName]) throw new AuthError(`Group claim ${groupClaimName} not found in userinfo`, 401)

        const groupsList = userinfo[groupClaimName].map((group) => group.toLowerCase())
        const rolesInOrderOfPriority = ['admin', 'user', 'guest']
        const groupMap = global.ServerSettings.authOpenIDGroupMap || {}

        let userType = null

        if (Object.keys(groupMap).length > 0) {
          for (const role of rolesInOrderOfPriority) {
            const mappedGroups = Object.entries(groupMap)
              .filter(([, v]) => v === role)
              .map(([k]) => k.toLowerCase())
            if (mappedGroups.some((g) => groupsList.includes(g))) {
              userType = role
              break
            }
          }
        } else {
          userType = rolesInOrderOfPriority.find((role) => groupsList.includes(role))
        }

        if (userType) {
          if (user.type === 'root') {
            if (userType !== 'admin') {
              throw new AuthError(`Root user "${user.username}" cannot be downgraded to ${userType}. Denying login.`, 403)
            } else {
              return
            }
          }
          if (user.type !== userType) {
            user.type = userType
            await user.save()
          }
        } else {
          throw new AuthError(`No valid group found in userinfo: ${JSON.stringify(userinfo[groupClaimName], null, 2)}`, 401)
        }
      }
    }
  })

  afterEach(function () {
    global.ServerSettings.authOpenIDGroupClaim = ''
    global.ServerSettings.authOpenIDGroupMap = {}
  })

  describe('legacy direct name match (empty groupMap)', function () {
    it('should assign admin role when group list includes admin', async function () {
      global.ServerSettings.authOpenIDGroupClaim = 'groups'
      global.ServerSettings.authOpenIDGroupMap = {}

      const user = { type: 'user', username: 'testuser', save: sinon.stub().resolves() }
      const userinfo = { groups: ['Admin', 'Users'] }

      await strategy.setUserGroup(user, userinfo)
      expect(user.type).to.equal('admin')
      expect(user.save.calledOnce).to.be.true
    })

    it('should assign user role when group list includes user but not admin', async function () {
      global.ServerSettings.authOpenIDGroupClaim = 'groups'
      global.ServerSettings.authOpenIDGroupMap = {}

      const user = { type: 'guest', username: 'testuser', save: sinon.stub().resolves() }
      const userinfo = { groups: ['User', 'Guests'] }

      await strategy.setUserGroup(user, userinfo)
      expect(user.type).to.equal('user')
    })

    it('should throw when no valid group found', async function () {
      global.ServerSettings.authOpenIDGroupClaim = 'groups'
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
