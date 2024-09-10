const { expect } = require('chai')
const sinon = require('sinon')
const { up, down } = require('./v0.0.1-migration_example')
const { Sequelize } = require('sequelize')
const Logger = require('../../../server/Logger')

describe('migration_example', () => {
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
    it('should create example_table', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      expect(loggerInfoStub.callCount).to.equal(4)
      expect(loggerInfoStub.getCall(0).calledWith(sinon.match('Running migration_example up...'))).to.be.true
      expect(loggerInfoStub.getCall(1).calledWith(sinon.match('Creating example_table...'))).to.be.true
      expect(loggerInfoStub.getCall(2).calledWith(sinon.match('example_table created.'))).to.be.true
      expect(loggerInfoStub.getCall(3).calledWith(sinon.match('migration_example up complete.'))).to.be.true
      expect(await queryInterface.showAllTables()).to.include('example_table')
      const tableDescription = await queryInterface.describeTable('example_table')
      expect(tableDescription).to.deep.equal({
        id: { type: 'INTEGER', allowNull: true, defaultValue: undefined, primaryKey: true, unique: false },
        name: { type: 'VARCHAR(255)', allowNull: false, defaultValue: undefined, primaryKey: false, unique: false }
      })
    })
  })

  describe('down', () => {
    it('should drop example_table', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      expect(loggerInfoStub.callCount).to.equal(8)
      expect(loggerInfoStub.getCall(4).calledWith(sinon.match('Running migration_example down...'))).to.be.true
      expect(loggerInfoStub.getCall(5).calledWith(sinon.match('Dropping example_table...'))).to.be.true
      expect(loggerInfoStub.getCall(6).calledWith(sinon.match('example_table dropped.'))).to.be.true
      expect(loggerInfoStub.getCall(7).calledWith(sinon.match('migration_example down complete.'))).to.be.true
      expect(await queryInterface.showAllTables()).not.to.include('example_table')
    })
  })
})
