import { expect } from 'chai'
import sinon from 'sinon'
import migration from './v0.0.1-migration_example'
import { Sequelize } from 'sequelize'
import type { QueryInterface } from 'sequelize'
import Logger from '../../../server/Logger'

const { up, down } = migration

describe('migration_example', () => {
  let sequelize: Sequelize
  let queryInterface: QueryInterface
  let loggerInfoStub: sinon.SinonStub<Parameters<typeof Logger.info>, ReturnType<typeof Logger.info>>

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
      expect(loggerInfoStub.getCall(0).calledWith(sinon.match('Running migration_example up...'))).to.equal(true)
      expect(loggerInfoStub.getCall(1).calledWith(sinon.match('Creating example_table...'))).to.equal(true)
      expect(loggerInfoStub.getCall(2).calledWith(sinon.match('example_table created.'))).to.equal(true)
      expect(loggerInfoStub.getCall(3).calledWith(sinon.match('migration_example up complete.'))).to.equal(true)
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
      expect(loggerInfoStub.getCall(4).calledWith(sinon.match('Running migration_example down...'))).to.equal(true)
      expect(loggerInfoStub.getCall(5).calledWith(sinon.match('Dropping example_table...'))).to.equal(true)
      expect(loggerInfoStub.getCall(6).calledWith(sinon.match('example_table dropped.'))).to.equal(true)
      expect(loggerInfoStub.getCall(7).calledWith(sinon.match('migration_example down complete.'))).to.equal(true)
      expect(await queryInterface.showAllTables()).not.to.include('example_table')
    })
  })
})
