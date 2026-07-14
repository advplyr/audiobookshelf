const { expect } = require('chai')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')
const User = require('../../../server/models/User')
const OidcAuthStrategy = require('../../../server/auth/OidcAuthStrategy')

describe('OidcAuthStrategy', () => {
  let strategy
  let originalServerSettings
  let originalUserModel

  beforeEach(() => {
    strategy = new OidcAuthStrategy()
    originalServerSettings = Database.serverSettings
    originalUserModel = Database.userModel
    Database.userModel = User
    sinon.stub(Logger, 'info')
  })

  afterEach(() => {
    Database.serverSettings = originalServerSettings
    Database.userModel = originalUserModel
    sinon.restore()
  })

  const fakeUser = (type) => ({ type, username: 'tester', save: sinon.stub().resolves() })

  describe('setUserGroup', () => {
    it('maps a configured admin group to the admin role', async () => {
      Database.serverSettings = { authOpenIDGroupClaim: 'groups', authOpenIDAdminGroups: 'syncloud', authOpenIDGroupDefaultRole: null }
      const user = fakeUser('user')

      await strategy.setUserGroup(user, { groups: ['syncloud'] })

      expect(user.type).to.equal('admin')
      expect(user.permissions.upload).to.be.true
      expect(user.save.calledOnce).to.be.true
    })

    it('still maps built-in role names when admin groups are configured', async () => {
      Database.serverSettings = { authOpenIDGroupClaim: 'groups', authOpenIDAdminGroups: 'syncloud', authOpenIDGroupDefaultRole: null }
      const user = fakeUser('guest')

      await strategy.setUserGroup(user, { groups: ['User'] })

      expect(user.type).to.equal('user')
    })

    it('falls back to the default role when no group matches', async () => {
      Database.serverSettings = { authOpenIDGroupClaim: 'groups', authOpenIDAdminGroups: '', authOpenIDGroupDefaultRole: 'user' }
      const user = fakeUser('guest')

      await strategy.setUserGroup(user, { groups: ['some-unrelated-group'] })

      expect(user.type).to.equal('user')
    })

    it('denies login when no group matches and no default role is set', async () => {
      Database.serverSettings = { authOpenIDGroupClaim: 'groups', authOpenIDAdminGroups: '', authOpenIDGroupDefaultRole: null }
      const user = fakeUser('user')

      let error
      try {
        await strategy.setUserGroup(user, { groups: ['some-unrelated-group'] })
      } catch (e) {
        error = e
      }

      expect(error).to.be.an('error')
    })

    it('does nothing when no group claim is configured', async () => {
      Database.serverSettings = { authOpenIDGroupClaim: '' }
      const user = fakeUser('user')

      await strategy.setUserGroup(user, { groups: ['syncloud'] })

      expect(user.type).to.equal('user')
      expect(user.save.called).to.be.false
    })
  })
})
