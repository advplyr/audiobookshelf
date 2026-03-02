const { expect } = require('chai')
const sinon = require('sinon')
const sequelize = require('sequelize')

const User = require('../../../server/models/User')

describe('User model', () => {
  describe('getUserByIdOrOldId', () => {
    let originalSequelize

    beforeEach(() => {
      originalSequelize = User.sequelize
    })

    afterEach(() => {
      User.sequelize = originalSequelize
      sinon.restore()
    })

    it('should cast id to text on postgres when checking legacy token ids', async () => {
      User.sequelize = {
        getDialect: () => 'postgres',
        models: {
          mediaProgress: {}
        }
      }

      const findOneStub = sinon.stub(User, 'findOne').resolves(null)

      await User.getUserByIdOrOldId('root')

      expect(findOneStub.calledOnce).to.equal(true)

      const options = findOneStub.firstCall.args[0]
      const whereOr = options.where[sequelize.Op.or]

      expect(whereOr).to.have.length(2)
      expect(whereOr[0].attribute.type).to.equal('text')
      expect(whereOr[1]).to.deep.equal({ 'extraData.oldUserId': 'root' })
    })
  })
})
