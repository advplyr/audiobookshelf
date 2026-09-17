const { expect } = require('chai')
const sinon = require('sinon')
const { up, down } = require('../../../server/migrations/v2.36.0-widen-token-columns')
const { Sequelize } = require('sequelize')
const Logger = require('../../../server/Logger')

describe('migration-v2.36.0-widen-token-columns', () => {
  let loggerInfoStub

  beforeEach(() => {
    loggerInfoStub = sinon.stub(Logger, 'info')
  })

  afterEach(() => {
    sinon.restore()
  })

  function fakePostgresQueryInterface({ columns }) {
    const changeColumn = sinon.stub().resolves()
    return {
      sequelize: {
        getDialect: () => 'postgres',
        Sequelize: {
          DataTypes: {
            TEXT: 'TEXT',
            STRING: 'STRING'
          }
        }
      },
      tableExists: async () => true,
      describeTable: async () => columns,
      changeColumn
    }
  }

  describe('up', () => {
    it('skips non-postgres dialects without changing columns', async () => {
      const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
      const queryInterface = sequelize.getQueryInterface()
      await queryInterface.createTable('sessions', {
        refreshToken: { type: Sequelize.STRING, allowNull: false },
        lastRefreshToken: { type: Sequelize.STRING, allowNull: true },
        userAgent: { type: Sequelize.STRING }
      })
      await queryInterface.createTable('users', {
        token: { type: Sequelize.STRING }
      })

      await up({ context: { queryInterface, logger: Logger } })

      expect(loggerInfoStub.calledWithMatch('Skipping 2.36.0-widen-token-columns on non-postgres dialect')).to.be.true
      const sessions = await queryInterface.describeTable('sessions')
      const users = await queryInterface.describeTable('users')
      expect(sessions.refreshToken.type).to.equal('VARCHAR(255)')
      expect(sessions.lastRefreshToken.type).to.equal('VARCHAR(255)')
      expect(sessions.userAgent.type).to.equal('VARCHAR(255)')
      expect(users.token.type).to.equal('VARCHAR(255)')
    })

    it('widens the token and user agent columns to TEXT on postgres', async () => {
      const queryInterface = fakePostgresQueryInterface({
        columns: {
          refreshtoken: { type: 'VARCHAR(255)' },
          lastrefreshtoken: { type: 'VARCHAR(255)' },
          useragent: { type: 'VARCHAR(255)' },
          token: { type: 'VARCHAR(255)' }
        }
      })

      await up({ context: { queryInterface, logger: Logger } })

      expect(queryInterface.changeColumn.callCount).to.equal(4)
      expect(queryInterface.changeColumn.calledWith('sessions', 'refreshtoken', { type: 'TEXT' })).to.be.true
      expect(queryInterface.changeColumn.calledWith('sessions', 'lastrefreshtoken', { type: 'TEXT' })).to.be.true
      expect(queryInterface.changeColumn.calledWith('sessions', 'useragent', { type: 'TEXT' })).to.be.true
      expect(queryInterface.changeColumn.calledWith('users', 'token', { type: 'TEXT' })).to.be.true
    })

    it('is a no-op when the columns are already TEXT', async () => {
      const queryInterface = fakePostgresQueryInterface({
        columns: {
          refreshtoken: { type: 'TEXT' },
          lastrefreshtoken: { type: 'TEXT' },
          useragent: { type: 'TEXT' },
          token: { type: 'TEXT' }
        }
      })

      await up({ context: { queryInterface, logger: Logger } })

      expect(queryInterface.changeColumn.called).to.be.false
      expect(loggerInfoStub.calledWithMatch('column "sessions.refreshtoken" is already TEXT')).to.be.true
    })

    it('handles missing tables and columns without failing', async () => {
      const queryInterface = {
        sequelize: {
          getDialect: () => 'postgres',
          Sequelize: { DataTypes: { TEXT: 'TEXT', STRING: 'STRING' } }
        },
        tableExists: async () => false,
        describeTable: async () => ({}),
        changeColumn: sinon.stub().resolves()
      }

      await up({ context: { queryInterface, logger: Logger } })

      expect(loggerInfoStub.calledWithMatch('table "sessions" does not exist')).to.be.true
      expect(queryInterface.changeColumn.called).to.be.false
    })
  })

  describe('down', () => {
    it('reverts the columns back to STRING on postgres', async () => {
      const queryInterface = fakePostgresQueryInterface({
        columns: {
          refreshtoken: { type: 'TEXT' },
          lastrefreshtoken: { type: 'TEXT' },
          useragent: { type: 'TEXT' },
          token: { type: 'TEXT' }
        }
      })

      await down({ context: { queryInterface, logger: Logger } })

      expect(queryInterface.changeColumn.callCount).to.equal(4)
      expect(queryInterface.changeColumn.calledWith('sessions', 'refreshtoken', { type: 'STRING' })).to.be.true
      expect(queryInterface.changeColumn.calledWith('users', 'token', { type: 'STRING' })).to.be.true
    })

    it('skips non-postgres dialects', async () => {
      const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
      const queryInterface = sequelize.getQueryInterface()
      await queryInterface.createTable('sessions', {
        refreshToken: { type: Sequelize.TEXT, allowNull: false }
      })

      await down({ context: { queryInterface, logger: Logger } })

      expect(loggerInfoStub.calledWithMatch('Skipping 2.36.0-widen-token-columns on non-postgres dialect')).to.be.true
      const sessions = await queryInterface.describeTable('sessions')
      expect(sessions.refreshToken.type).to.equal('TEXT')
    })
  })
})
