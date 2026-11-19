const chai = require('chai')
const sinon = require('sinon')
const { expect } = chai

const { DataTypes, Sequelize } = require('sequelize')
const Logger = require('../../../server/Logger')

const { up, down } = require('../../../server/migrations/v2.38.1-add-device-and-session-fk-indexes')

describe('Migration v2.38.1-add-device-and-session-fk-indexes', () => {
  let sequelize
  let queryInterface
  let loggerInfoStub

  const expectedIndexes = {
    playbackSessions: ['playback_sessions_device_id', 'playback_sessions_user_id'],
    devices: ['devices_user_id', 'devices_device_id']
  }

  async function indexNames(table) {
    return (await queryInterface.showIndex(table)).map((i) => i.name)
  }

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    queryInterface = sequelize.getQueryInterface()
    loggerInfoStub = sinon.stub(Logger, 'info')

    await queryInterface.createTable('devices', {
      id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, unique: true },
      deviceId: { type: DataTypes.STRING, allowNull: false },
      userId: { type: DataTypes.INTEGER, allowNull: false }
    })
    await queryInterface.createTable('playbackSessions', {
      id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, unique: true },
      userId: { type: DataTypes.INTEGER, allowNull: true },
      deviceId: { type: DataTypes.INTEGER, allowNull: true }
    })
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('up', () => {
    it('should add the indexes', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      for (const [table, names] of Object.entries(expectedIndexes)) {
        const existing = await indexNames(table)
        for (const name of names) expect(existing).to.include(name)
      }

      const sessionIndexes = await queryInterface.showIndex('playbackSessions')
      const byName = (n) => sessionIndexes.find((i) => i.name === n)
      expect(byName('playback_sessions_device_id').fields.map((f) => f.attribute)).to.deep.equal(['deviceId'])
      expect(byName('playback_sessions_user_id').fields.map((f) => f.attribute)).to.deep.equal(['userId'])

      expect(loggerInfoStub.callCount).to.be.greaterThan(0)
    })

    it('should be idempotent', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await up({ context: { queryInterface, logger: Logger } })

      for (const [table, names] of Object.entries(expectedIndexes)) {
        const existing = await indexNames(table)
        for (const name of names) expect(existing.filter((n) => n === name)).to.have.lengthOf(1)
      }
    })
  })

  describe('down', () => {
    it('should remove the indexes it added', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      for (const [table, names] of Object.entries(expectedIndexes)) {
        const existing = await indexNames(table)
        for (const name of names) expect(existing).to.not.include(name)
      }
    })

    it('should be safe to run when the indexes do not exist', async () => {
      await down({ context: { queryInterface, logger: Logger } })

      for (const [table, names] of Object.entries(expectedIndexes)) {
        const existing = await indexNames(table)
        for (const name of names) expect(existing).to.not.include(name)
      }
    })
  })
})
