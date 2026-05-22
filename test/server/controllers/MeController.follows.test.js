const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const MeController = require('../../../server/controllers/MeController')
const Logger = require('../../../server/Logger')
const SocketAuthority = require('../../../server/SocketAuthority')

describe('MeController - Series Follow Tests', () => {
  let user1, user2, library, series1, series2

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'error')
    sinon.stub(Logger, 'debug')
    sinon.stub(SocketAuthority, 'clientEmitter')

    // Create test data
    library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })

    user1 = await Database.userModel.create({
      username: 'user1',
      pash: 'hashed_password_1',
      type: 'user',
      isActive: true
    })
    user1.mediaProgresses = []
    user1.userSeriesFollows = []

    user2 = await Database.userModel.create({
      username: 'user2',
      pash: 'hashed_password_2',
      type: 'user',
      isActive: true
    })
    user2.mediaProgresses = []
    user2.userSeriesFollows = []

    series1 = await Database.seriesModel.create({
      name: 'Test Series 1',
      nameIgnorePrefix: 'Test Series 1',
      libraryId: library.id
    })

    series2 = await Database.seriesModel.create({
      name: 'Test Series 2',
      nameIgnorePrefix: 'Test Series 2',
      libraryId: library.id
    })
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.sync({ force: true })
  })

  describe('followSeries', () => {
    it('should follow a series successfully', async () => {
      const fakeReq = {
        user: user1,
        params: { id: series1.id }
      }
      const fakeRes = {
        sendStatus: sinon.spy(),
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.followSeries(fakeReq, fakeRes)

      expect(fakeRes.sendStatus.calledWith(200)).to.be.true

      // Verify follow record was created
      const follows = await Database.userSeriesFollowModel.findAll({
        where: { userId: user1.id }
      })
      expect(follows).to.have.length(1)
      expect(follows[0].seriesId).to.equal(series1.id)
    })

    it('should return 404 for non-existent series', async () => {
      const fakeReq = {
        user: user1,
        params: { id: '00000000-0000-0000-0000-000000000000' }
      }
      const fakeRes = {
        sendStatus: sinon.spy(),
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.followSeries(fakeReq, fakeRes)

      expect(fakeRes.sendStatus.calledWith(404)).to.be.true
    })

    it('should be idempotent - following twice creates only one record', async () => {
      const fakeReq = {
        user: user1,
        params: { id: series1.id }
      }
      const fakeRes = {
        sendStatus: sinon.spy(),
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.followSeries(fakeReq, fakeRes)
      await MeController.followSeries(fakeReq, fakeRes)

      expect(fakeRes.sendStatus.calledWith(200)).to.be.true

      const follows = await Database.userSeriesFollowModel.findAll({
        where: { userId: user1.id }
      })
      expect(follows).to.have.length(1)
    })

    it('should emit user_series_follows_updated socket event', async () => {
      const fakeReq = {
        user: user1,
        params: { id: series1.id }
      }
      const fakeRes = {
        sendStatus: sinon.spy(),
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.followSeries(fakeReq, fakeRes)

      expect(SocketAuthority.clientEmitter.calledOnce).to.be.true
      const [userId, event, data] = SocketAuthority.clientEmitter.firstCall.args
      expect(userId).to.equal(user1.id)
      expect(event).to.equal('user_series_follows_updated')
      expect(data.seriesFollowing).to.include(series1.id)
    })
  })

  describe('unfollowSeries', () => {
    beforeEach(async () => {
      await Database.userSeriesFollowModel.create({
        userId: user1.id,
        seriesId: series1.id
      })
    })

    it('should unfollow a series successfully', async () => {
      const fakeReq = {
        user: user1,
        params: { id: series1.id }
      }
      const fakeRes = {
        sendStatus: sinon.spy(),
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.unfollowSeries(fakeReq, fakeRes)

      expect(fakeRes.sendStatus.calledWith(200)).to.be.true

      const follows = await Database.userSeriesFollowModel.findAll({
        where: { userId: user1.id }
      })
      expect(follows).to.have.length(0)
    })

    it('should return 404 when not following', async () => {
      const fakeReq = {
        user: user1,
        params: { id: series2.id }
      }
      const fakeRes = {
        sendStatus: sinon.spy(),
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.unfollowSeries(fakeReq, fakeRes)

      expect(fakeRes.sendStatus.calledWith(404)).to.be.true
    })

    it('should emit user_series_follows_updated socket event', async () => {
      const fakeReq = {
        user: user1,
        params: { id: series1.id }
      }
      const fakeRes = {
        sendStatus: sinon.spy(),
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.unfollowSeries(fakeReq, fakeRes)

      expect(SocketAuthority.clientEmitter.calledOnce).to.be.true
      const [userId, event, data] = SocketAuthority.clientEmitter.firstCall.args
      expect(userId).to.equal(user1.id)
      expect(event).to.equal('user_series_follows_updated')
      expect(data.seriesFollowing).to.not.include(series1.id)
    })
  })

  describe('getFollows', () => {
    beforeEach(async () => {
      await Database.userSeriesFollowModel.create({
        userId: user1.id,
        seriesId: series1.id
      })
      await Database.userSeriesFollowModel.create({
        userId: user1.id,
        seriesId: series2.id
      })
      // user2 follows series1 - should not appear in user1's results
      await Database.userSeriesFollowModel.create({
        userId: user2.id,
        seriesId: series1.id
      })
    })

    it('should return all followed series for the user', async () => {
      const fakeReq = {
        user: user1,
        query: {}
      }
      const fakeRes = {
        json: sinon.spy(),
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.getFollows(fakeReq, fakeRes)

      expect(fakeRes.json.calledOnce).to.be.true
      const result = fakeRes.json.firstCall.args[0]
      expect(result.series).to.have.length(2)
      expect(result.series.map((s) => s.seriesId)).to.include(series1.id)
      expect(result.series.map((s) => s.seriesId)).to.include(series2.id)
    })

    it('should not return follows from other users', async () => {
      const fakeReq = {
        user: user2,
        query: {}
      }
      const fakeRes = {
        json: sinon.spy(),
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.getFollows(fakeReq, fakeRes)

      const result = fakeRes.json.firstCall.args[0]
      expect(result.series).to.have.length(1)
      expect(result.series[0].seriesId).to.equal(series1.id)
    })

    it('should return empty array when no follows', async () => {
      const user3 = await Database.userModel.create({
        username: 'user3',
        pash: 'hashed_password_3',
        type: 'user',
        isActive: true
      })
      const fakeReq = {
        user: user3,
        query: {}
      }
      const fakeRes = {
        json: sinon.spy(),
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.getFollows(fakeReq, fakeRes)

      const result = fakeRes.json.firstCall.args[0]
      expect(result.series).to.have.length(0)
    })

    it('should include series name and libraryId', async () => {
      const fakeReq = {
        user: user1,
        query: { type: 'series' }
      }
      const fakeRes = {
        json: sinon.spy(),
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      }

      await MeController.getFollows(fakeReq, fakeRes)

      const result = fakeRes.json.firstCall.args[0]
      const followedSeries = result.series.find((s) => s.seriesId === series1.id)
      expect(followedSeries.seriesName).to.equal('Test Series 1')
      expect(followedSeries.libraryId).to.equal(library.id)
      expect(followedSeries.createdAt).to.be.a('number')
    })
  })

  describe('toOldJSONForBrowser includes seriesFollowing', () => {
    it('should include seriesFollowing array in user JSON', async () => {
      await Database.userSeriesFollowModel.create({
        userId: user1.id,
        seriesId: series1.id
      })

      // Reload user with follows
      const reloadedUser = await Database.userModel.findByPk(user1.id, {
        include: [Database.sequelize.models.mediaProgress, Database.sequelize.models.userSeriesFollow]
      })

      const json = reloadedUser.toOldJSONForBrowser()
      expect(json.seriesFollowing).to.be.an('array')
      expect(json.seriesFollowing).to.include(series1.id)
    })

    it('should return empty seriesFollowing when no follows', () => {
      const json = user1.toOldJSONForBrowser()
      expect(json.seriesFollowing).to.be.an('array')
      expect(json.seriesFollowing).to.have.length(0)
    })
  })

  describe('cascade deletion', () => {
    it('should clean up follows when series is deleted', async () => {
      await Database.userSeriesFollowModel.create({
        userId: user1.id,
        seriesId: series1.id
      })

      await series1.destroy()

      const follows = await Database.userSeriesFollowModel.findAll({
        where: { userId: user1.id }
      })
      expect(follows).to.have.length(0)
    })

    it('should clean up follows when user is deleted', async () => {
      await Database.userSeriesFollowModel.create({
        userId: user1.id,
        seriesId: series1.id
      })

      await user1.destroy()

      const follows = await Database.userSeriesFollowModel.findAll({
        where: { seriesId: series1.id }
      })
      expect(follows).to.have.length(0)
    })
  })

  describe('getFollowedSeriesIdsForUser', () => {
    it('should return array of series IDs', async () => {
      await Database.userSeriesFollowModel.create({
        userId: user1.id,
        seriesId: series1.id
      })
      await Database.userSeriesFollowModel.create({
        userId: user1.id,
        seriesId: series2.id
      })

      const ids = await Database.userSeriesFollowModel.getFollowedSeriesIdsForUser(user1.id)
      expect(ids).to.be.an('array')
      expect(ids).to.have.length(2)
      expect(ids).to.include(series1.id)
      expect(ids).to.include(series2.id)
    })

    it('should return empty array when no follows', async () => {
      const ids = await Database.userSeriesFollowModel.getFollowedSeriesIdsForUser(user1.id)
      expect(ids).to.be.an('array')
      expect(ids).to.have.length(0)
    })
  })
})
