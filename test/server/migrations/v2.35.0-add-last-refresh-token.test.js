const { expect } = require('chai')
const sinon = require('sinon')
const { up, down } = require('../../../server/migrations/v2.35.0-add-last-refresh-token')
const { Sequelize } = require('sequelize')
const Logger = require('../../../server/Logger')

describe('migration-v2.35.0-add-last-refresh-token', () => {
  let sequelize
  let queryInterface
  let loggerInfoStub

  beforeEach(() => {
    sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    queryInterface = sequelize.getQueryInterface()
    loggerInfoStub = sinon.stub(Logger, 'info')
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('up', () => {
    beforeEach(async () => {
      await queryInterface.createTable('sessions', {
        id: { type: Sequelize.UUID, primaryKey: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false }
      })
    })

    it('should add lastRefreshToken columns when they do not exist', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const tableDescription = await queryInterface.describeTable('sessions')
      expect(tableDescription.lastRefreshToken).to.exist
      expect(tableDescription.lastRefreshTokenExpiresAt).to.exist
    })

    it('should not fail when the columns already exist', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await up({ context: { queryInterface, logger: Logger } })

      const tableDescription = await queryInterface.describeTable('sessions')
      expect(tableDescription.lastRefreshToken).to.exist
      expect(tableDescription.lastRefreshTokenExpiresAt).to.exist
      expect(loggerInfoStub.calledWithMatch('lastRefreshToken column already exists')).to.equal(true)
    })

    it('should detect existing columns case-insensitively for postgres identifier folding', async () => {
      // Postgres folds unquoted identifiers to lowercase, so describeTable on a
      // migrated postgres database returns lowercase column names
      const fakeQueryInterface = {
        sequelize,
        tableExists: async () => true,
        describeTable: async () => ({
          id: {},
          lastrefreshtoken: {},
          lastrefreshtokenexpiresat: {}
        }),
        addColumn: async () => {
          throw new Error('addColumn must not be called for existing lowercase columns')
        }
      }

      await up({ context: { queryInterface: fakeQueryInterface, logger: Logger } })

      expect(loggerInfoStub.calledWithMatch('lastRefreshToken column already exists')).to.equal(true)
      expect(loggerInfoStub.calledWithMatch('lastRefreshTokenExpiresAt column already exists')).to.equal(true)
    })
  })

  describe('down', () => {
    beforeEach(async () => {
      await queryInterface.createTable('sessions', {
        id: { type: Sequelize.UUID, primaryKey: true },
        lastRefreshToken: { type: Sequelize.STRING, allowNull: true },
        lastRefreshTokenExpiresAt: { type: Sequelize.DATE, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false }
      })
    })

    it('should remove lastRefreshToken columns when they exist', async () => {
      await down({ context: { queryInterface, logger: Logger } })

      const tableDescription = await queryInterface.describeTable('sessions')
      expect(tableDescription.lastRefreshToken).to.not.exist
      expect(tableDescription.lastRefreshTokenExpiresAt).to.not.exist
    })

    it('should not fail when the columns do not exist', async () => {
      await down({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      expect(loggerInfoStub.calledWithMatch('lastRefreshToken column does not exist')).to.equal(true)
    })
  })
})
