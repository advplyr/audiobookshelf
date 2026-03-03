const { expect } = require('chai')
const { Sequelize, DataTypes } = require('sequelize')
const sinon = require('sinon')

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

  afterEach(async () => {
    if (sequelize) await sequelize.close()
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

  it('up should treat index names case-insensitively', async () => {
    const qi = {
      showIndex: sinon.stub(),
      addIndex: sinon.stub().resolves(),
      removeIndex: sinon.stub().resolves()
    }

    qi.showIndex.onCall(0).resolves([{ name: 'bookauthor_authorid' }])
    qi.showIndex.onCall(1).resolves([{ name: 'bookseries_seriesid' }])
    qi.showIndex.onCall(2).resolves([{ name: 'podcast_episodes_created_at' }])
    qi.showIndex.onCall(3).resolves([{ name: 'podcastepisode_createdat_podcastid' }])

    await up({ context: { queryInterface: qi, logger: Logger } })

    expect(qi.addIndex.called).to.equal(false)
    expect(qi.removeIndex.calledOnceWithExactly('podcastEpisodes', 'podcast_episodes_created_at')).to.equal(true)
  })

  it('up should continue when addIndex reports already exists', async () => {
    const makePgExistsError = (sql) => {
      const err = new Error('relation already exists')
      err.name = 'SequelizeDatabaseError'
      err.original = { code: '42P07' }
      err.sql = sql
      return err
    }

    const qi = {
      showIndex: sinon.stub(),
      addIndex: sinon.stub(),
      removeIndex: sinon.stub().resolves()
    }

    qi.showIndex.onCall(0).resolves([])
    qi.showIndex.onCall(1).resolves([])
    qi.showIndex.onCall(2).resolves([{ name: 'podcast_episodes_created_at' }])
    qi.showIndex.onCall(3).resolves([])

    qi.addIndex.onCall(0).rejects(makePgExistsError('CREATE INDEX bookAuthor_authorId ON bookAuthors (authorId)'))
    qi.addIndex.onCall(1).rejects(makePgExistsError('CREATE INDEX bookSeries_seriesId ON bookSeries (seriesId)'))
    qi.addIndex.onCall(2).rejects(makePgExistsError('CREATE INDEX podcastEpisode_createdAt_podcastId ON podcastEpisodes (createdAt, podcastId)'))

    await up({ context: { queryInterface: qi, logger: Logger } })

    expect(qi.addIndex.callCount).to.equal(3)
    expect(qi.removeIndex.calledOnceWithExactly('podcastEpisodes', 'podcast_episodes_created_at')).to.equal(true)
  })
})
