const { expect } = require('chai')
const sinon = require('sinon')

const { up, down } = require('../../../server/migrations/v2.15.1-reindex-nocase')
const Logger = require('../../../server/Logger')

describe('migration-v2.15.1-reindex-nocase', () => {
  afterEach(() => {
    sinon.restore()
  })

  it('should skip reindex on non-sqlite dialect', async () => {
    const queryStub = sinon.stub().resolves()
    const loggerInfoStub = sinon.stub(Logger, 'info')
    const queryInterface = {
      sequelize: {
        getDialect: () => 'postgres',
        query: queryStub
      }
    }

    await up({ context: { queryInterface, logger: Logger } })

    expect(queryStub.called).to.equal(false)
    expect(loggerInfoStub.calledWith(sinon.match('[2.15.1 migration] Skipping NOCASE reindex on non-sqlite dialect'))).to.equal(true)
  })

  it('should log no-op on down migration', async () => {
    const loggerInfoStub = sinon.stub(Logger, 'info')
    const queryInterface = {
      sequelize: {
        getDialect: () => 'postgres',
        query: sinon.stub().resolves()
      }
    }

    await down({ context: { queryInterface, logger: Logger } })

    expect(loggerInfoStub.calledWith(sinon.match('[2.15.1 migration] No action required for downgrade'))).to.equal(true)
  })
})
