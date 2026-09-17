const { expect } = require('chai')
const sinon = require('sinon')
const { up } = require('../../../server/migrations/v2.26.0-create-auth-tables')
const { Sequelize } = require('sequelize')
const Logger = require('../../../server/Logger')

describe('migration-v2.26.0-create-auth-tables', () => {
  let sequelize
  let queryInterface

  beforeEach(() => {
    sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    queryInterface = sequelize.getQueryInterface()
    sinon.stub(Logger, 'info')
  })

  afterEach(async () => {
    sinon.restore()
    await sequelize.close()
  })

  it('creates session user-agent and refresh-token columns as TEXT', async () => {
    await up({ context: { queryInterface, logger: Logger } })

    const tableDescription = await queryInterface.describeTable('sessions')
    expect(tableDescription.userAgent.type).to.equal('TEXT')
    expect(tableDescription.refreshToken.type).to.equal('TEXT')
  })
})
