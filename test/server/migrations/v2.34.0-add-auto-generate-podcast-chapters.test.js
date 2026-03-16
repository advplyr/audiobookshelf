const chai = require('chai')
const sinon = require('sinon')
const { expect } = chai

const { DataTypes, Sequelize } = require('sequelize')
const Logger = require('../../../server/Logger')

const { up, down } = require('../../../server/migrations/v2.34.0-add-auto-generate-podcast-chapters')

describe('Migration v2.34.0-add-auto-generate-podcast-chapters', () => {
  let sequelize
  let queryInterface
  let loggerInfoStub

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    queryInterface = sequelize.getQueryInterface()
    loggerInfoStub = sinon.stub(Logger, 'info')

    await queryInterface.createTable('podcasts', {
      id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, unique: true },
      title: { type: DataTypes.STRING, allowNull: false },
      titleIgnorePrefix: { type: DataTypes.STRING, allowNull: false }
    })

    await queryInterface.bulkInsert('podcasts', [
      { id: 1, title: 'The Podcast 1', titleIgnorePrefix: 'Podcast 1, The' },
      { id: 2, title: 'The Podcast 2', titleIgnorePrefix: 'Podcast 2, The' }
    ])
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('up', () => {
    it('should add autoGenerateChapters column to podcasts', async () => {
      await up({ context: { queryInterface, logger: Logger } })

      const [podcasts] = await queryInterface.sequelize.query('SELECT * FROM podcasts')
      expect(podcasts).to.deep.equal([
        { id: 1, autoGenerateChapters: 0, title: 'The Podcast 1', titleIgnorePrefix: 'Podcast 1, The' },
        { id: 2, autoGenerateChapters: 0, title: 'The Podcast 2', titleIgnorePrefix: 'Podcast 2, The' }
      ])
    })
  })

  describe('down', () => {
    it('should remove autoGenerateChapters column from podcasts', async () => {
      await up({ context: { queryInterface, logger: Logger } })
      try {
        await down({ context: { queryInterface, logger: Logger } })
      } catch (error) {
        console.log(error)
      }

      const [podcasts] = await queryInterface.sequelize.query('SELECT * FROM podcasts')
      expect(podcasts).to.deep.equal([
        { id: 1, title: 'The Podcast 1', titleIgnorePrefix: 'Podcast 1, The' },
        { id: 2, title: 'The Podcast 2', titleIgnorePrefix: 'Podcast 2, The' }
      ])
    })
  })
})
