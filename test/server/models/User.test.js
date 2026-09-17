const { expect } = require('chai')
const sinon = require('sinon')
const User = require('../../../server/models/User')

describe('User model', () => {
  describe('case-insensitive lookup helpers', () => {
    afterEach(() => {
      sinon.restore()
    })

    it('should query usernames case-insensitively', async () => {
      User.sequelize = {
        models: {
          mediaProgress: {}
        }
      }

      const findOneStub = sinon.stub(User, 'findOne').resolves(null)

      await User.getUserByUsername('Madison')

      expect(findOneStub.calledOnce).to.equal(true)
      const options = findOneStub.firstCall.args[0]
      expect(options.where.attribute.fn).to.equal('LOWER')
      expect(options.where.attribute.args[0].col).to.equal('username')
      expect(options.where.logic).to.equal('madison')
    })

    it('should query emails case-insensitively', async () => {
      User.sequelize = {
        models: {
          mediaProgress: {}
        }
      }

      const findOneStub = sinon.stub(User, 'findOne').resolves(null)

      await User.getUserByEmail('Example.User@Example.com')

      expect(findOneStub.calledOnce).to.equal(true)
      const options = findOneStub.firstCall.args[0]
      expect(options.where.attribute.fn).to.equal('LOWER')
      expect(options.where.attribute.args[0].col).to.equal('email')
      expect(options.where.logic).to.equal('example.user@example.com')
    })

    it('should hit the user cache for mixed-case username lookups', async () => {
      User.sequelize = {
        models: {
          mediaProgress: {}
        }
      }
      const cachedUser = { id: 'cache-test-user-1', username: 'CacheTestUser', email: 'cachetest@example.com', extraData: {} }
      const findOneStub = sinon.stub(User, 'findOne').resolves(cachedUser)

      await User.getUserByUsername('CacheTestUser')
      await User.getUserByUsername('cachetestuser')
      await User.getUserByUsername('CACHETESTUSER')

      expect(findOneStub.callCount).to.equal(1)
    })

    it('should hit the user cache for mixed-case email lookups', async () => {
      User.sequelize = {
        models: {
          mediaProgress: {}
        }
      }
      const cachedUser = { id: 'cache-test-user-2', username: 'CacheEmailUser', email: 'CacheMail@Example.com', extraData: {} }
      const findOneStub = sinon.stub(User, 'findOne').resolves(cachedUser)

      await User.getUserByEmail('CacheMail@Example.com')
      await User.getUserByEmail('cachemail@example.com')
      await User.getUserByEmail('CACHEMAIL@EXAMPLE.COM')

      expect(findOneStub.callCount).to.equal(1)
    })
  })

  describe('getUserByIdOrOldId', () => {
    let originalSequelize

    beforeEach(() => {
      originalSequelize = User.sequelize
    })

    afterEach(() => {
      User.sequelize = originalSequelize
      sinon.restore()
    })

    it('should resolve UUID ids via primary-key lookup on postgres', async () => {
      User.sequelize = {
        getDialect: () => 'postgres',
        models: {
          mediaProgress: {}
        }
      }

      const user = { id: 'e8e677b2-da16-4220-ab67-443b7714caf9' }
      const findByPkStub = sinon.stub(User, 'findByPk').resolves(user)
      const findOneStub = sinon.stub(User, 'findOne').resolves(null)

      const result = await User.getUserByIdOrOldId('e8e677b2-da16-4220-ab67-443b7714caf9')

      expect(result).to.equal(user)
      expect(findByPkStub.calledOnce).to.equal(true)
      expect(findOneStub.called).to.equal(false)
    })

    it('should resolve uppercase UUID ids via primary-key lookup on postgres', async () => {
      User.sequelize = {
        getDialect: () => 'postgres',
        models: {
          mediaProgress: {}
        }
      }

      const uppercaseUuid = 'E8E677B2-DA16-4220-AB67-443B7714CAF9'
      const user = { id: uppercaseUuid }
      const findByPkStub = sinon.stub(User, 'findByPk').resolves(user)
      const findOneStub = sinon.stub(User, 'findOne').resolves(null)

      const result = await User.getUserByIdOrOldId(uppercaseUuid)

      expect(result).to.equal(user)
      expect(findByPkStub.calledOnceWithExactly(uppercaseUuid, { include: User.sequelize.models.mediaProgress })).to.equal(true)
      expect(findOneStub.called).to.equal(false)
    })

    it('should query legacy oldUserId with postgres-safe JSON matcher', async () => {
      User.sequelize = {
        getDialect: () => 'postgres',
        models: {
          mediaProgress: {}
        }
      }

      const findByPkStub = sinon.stub(User, 'findByPk').resolves(null)
      const findOneStub = sinon.stub(User, 'findOne').resolves(null)

      await User.getUserByIdOrOldId('root')

      expect(findByPkStub.called).to.equal(false)
      expect(findOneStub.calledOnce).to.equal(true)

      const options = findOneStub.firstCall.args[0]
      expect(options.where.attribute.val).to.equal("extradata#>>'{oldUserId}'")
      expect(options.where.logic).to.equal('root')
    })

    it('should keep sqlite oldUserId matcher unchanged', async () => {
      User.sequelize = {
        getDialect: () => 'sqlite',
        models: {
          mediaProgress: {}
        }
      }

      const findOneStub = sinon.stub(User, 'findOne').resolves(null)

      await User.getUserByIdOrOldId('root')

      expect(findOneStub.calledOnce).to.equal(true)

      const options = findOneStub.firstCall.args[0]
      expect(options.where).to.deep.equal({ 'extraData.oldUserId': 'root' })
    })
  })
})
