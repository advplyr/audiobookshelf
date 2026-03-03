const { expect } = require('chai')
const { Sequelize, DataTypes } = require('sequelize')

const Logger = require('../../../server/Logger')
const { up, down } = require('../../../server/migrations/v2.15.2-index-creation')

describe('migration-v2.15.2-index-creation', () => {
  let sequelize
  let queryInterface

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    queryInterface = sequelize.getQueryInterface()

    await queryInterface.createTable('bookAuthors', {
      id: { type: DataTypes.INTEGER, primaryKey: true },
      authorId: { type: DataTypes.INTEGER }
    })

    await queryInterface.createTable('bookSeries', {
      id: { type: DataTypes.INTEGER, primaryKey: true },
      seriesId: { type: DataTypes.INTEGER }
    })

    await queryInterface.createTable('podcastEpisodes', {
      id: { type: DataTypes.INTEGER, primaryKey: true },
      createdAt: { type: DataTypes.DATE },
      podcastId: { type: DataTypes.INTEGER }
    })
  })

  it('up should succeed when legacy podcast index is missing', async () => {
    await up({ context: { queryInterface, logger: Logger } })

    const indexes = await queryInterface.showIndex('podcastEpisodes')
    expect(indexes.some((index) => index.name === 'podcastEpisode_createdAt_podcastId')).to.equal(true)
  })

  it('down should succeed when new podcast index is missing', async () => {
    await down({ context: { queryInterface, logger: Logger } })

    const indexes = await queryInterface.showIndex('podcastEpisodes')
    expect(indexes.some((index) => index.name === 'podcast_episodes_created_at')).to.equal(true)
  })
})
