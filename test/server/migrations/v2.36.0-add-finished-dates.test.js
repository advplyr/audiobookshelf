const chai = require('chai')
const sinon = require('sinon')
const { expect } = chai

const { DataTypes, Sequelize } = require('sequelize')
const Logger = require('../../../server/Logger')

const { up, down } = require('../../../server/migrations/v2.36.0-add-finished-dates')

describe('Migration v2.36.0-add-finished-dates', () => {
  let sequelize
  let queryInterface

  const finishedAt1 = new Date('2024-03-05T18:23:11.000Z')
  const finishedAt2 = new Date('2025-11-30T08:00:00.000Z')

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    queryInterface = sequelize.getQueryInterface()
    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'error')

    await queryInterface.createTable('mediaProgresses', {
      id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, unique: true },
      userId: { type: DataTypes.INTEGER, allowNull: false },
      mediaItemId: { type: DataTypes.INTEGER, allowNull: false },
      mediaItemType: { type: DataTypes.STRING, allowNull: false },
      isFinished: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      finishedAt: { type: DataTypes.DATE, allowNull: true }
    })

    await queryInterface.bulkInsert('mediaProgresses', [
      { id: 1, userId: 1, mediaItemId: 1, mediaItemType: 'book', isFinished: 1, finishedAt: finishedAt1 },
      { id: 2, userId: 1, mediaItemId: 2, mediaItemType: 'book', isFinished: 0, finishedAt: null },
      { id: 3, userId: 2, mediaItemId: 1, mediaItemType: 'podcastEpisode', isFinished: 1, finishedAt: finishedAt2 }
    ])
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('up', () => {
    it('should add the finishedDates column and populate it from finishedAt', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const tableDescription = await queryInterface.describeTable('mediaProgresses')
      expect(tableDescription.finishedDates).to.exist

      const [rows] = await sequelize.query('SELECT id, finishedDates FROM mediaProgresses ORDER BY id')
      expect(JSON.parse(rows[0].finishedDates)).to.deep.equal([finishedAt1.valueOf()])
      expect(rows[1].finishedDates).to.be.null
      expect(JSON.parse(rows[2].finishedDates)).to.deep.equal([finishedAt2.valueOf()])
    })

    it('should be idempotent', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await up({ context: { queryInterface, logger: Logger } })

      const [rows] = await sequelize.query('SELECT id, finishedDates FROM mediaProgresses ORDER BY id')
      expect(JSON.parse(rows[0].finishedDates)).to.deep.equal([finishedAt1.valueOf()])
      expect(rows[1].finishedDates).to.be.null
      expect(JSON.parse(rows[2].finishedDates)).to.deep.equal([finishedAt2.valueOf()])
    })

    it('should not overwrite an existing finishedDates value', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      await sequelize.query(`UPDATE mediaProgresses SET finishedDates = '[1000,2000]' WHERE id = 1`)
      await up({ context: { queryInterface, logger: Logger } })

      const [rows] = await sequelize.query('SELECT finishedDates FROM mediaProgresses WHERE id = 1')
      expect(JSON.parse(rows[0].finishedDates)).to.deep.equal([1000, 2000])
    })
  })

  describe('down', () => {
    it('should remove the finishedDates column', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const tableDescription = await queryInterface.describeTable('mediaProgresses')
      expect(tableDescription.finishedDates).to.not.exist
    })

    it('should be idempotent', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })
      await down({ context: { queryInterface, logger: Logger } })

      const tableDescription = await queryInterface.describeTable('mediaProgresses')
      expect(tableDescription.finishedDates).to.not.exist
    })
  })
})
