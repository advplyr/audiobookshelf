const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const SeriesController = require('../../../server/controllers/SeriesController')
const Logger = require('../../../server/Logger')
const SocketAuthority = require('../../../server/SocketAuthority')

describe('SeriesController', () => {
  let library

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    // Create a library for series to belong to
    library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })

    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'warn')
    sinon.stub(Logger, 'error')
    sinon.stub(SocketAuthority, 'emitter')
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.sync({ force: true })
  })

  describe('update', () => {
    it('should rename a series successfully', async () => {
      const series = await Database.seriesModel.create({
        name: 'Old_Name',
        libraryId: library.id
      })

      const fakeReq = {
        series,
        body: { name: 'New Name' }
      }
      const fakeRes = {
        status: sinon.stub().returnsThis(),
        send: sinon.spy(),
        json: sinon.spy()
      }

      await SeriesController.update(fakeReq, fakeRes)

      expect(fakeRes.json.calledOnce).to.be.true
      const result = fakeRes.json.firstCall.args[0]
      expect(result.name).to.equal('New Name')
      expect(SocketAuthority.emitter.calledWith('series_updated')).to.be.true
    })

    it('should return 400 when renaming to a name that already exists in the same library', async () => {
      await Database.seriesModel.create({
        name: 'Existing Series',
        libraryId: library.id
      })

      const seriesToRename = await Database.seriesModel.create({
        name: 'Old_Series',
        libraryId: library.id
      })

      const fakeReq = {
        series: seriesToRename,
        body: { name: 'Existing Series' }
      }
      const fakeRes = {
        status: sinon.stub().returnsThis(),
        send: sinon.spy(),
        json: sinon.spy()
      }

      await SeriesController.update(fakeReq, fakeRes)

      expect(fakeRes.status.calledWith(400)).to.be.true
      expect(fakeRes.send.calledOnce).to.be.true
      expect(fakeRes.send.firstCall.args[0]).to.include('already exists')
      expect(fakeRes.json.called).to.be.false
      expect(SocketAuthority.emitter.called).to.be.false
    })

    it('should return 400 when no valid fields are provided', async () => {
      const series = await Database.seriesModel.create({
        name: 'Test Series',
        libraryId: library.id
      })

      const fakeReq = {
        series,
        body: { invalidField: 'value' }
      }
      const fakeRes = {
        status: sinon.stub().returnsThis(),
        send: sinon.spy(),
        json: sinon.spy()
      }

      await SeriesController.update(fakeReq, fakeRes)

      expect(fakeRes.status.calledWith(400)).to.be.true
      expect(fakeRes.send.calledWith('No valid fields to update')).to.be.true
    })

    it('should not call save when name is unchanged', async () => {
      const series = await Database.seriesModel.create({
        name: 'Same Name',
        libraryId: library.id
      })

      const fakeReq = {
        series,
        body: { name: 'Same Name' }
      }
      const fakeRes = {
        status: sinon.stub().returnsThis(),
        send: sinon.spy(),
        json: sinon.spy()
      }

      await SeriesController.update(fakeReq, fakeRes)

      expect(fakeRes.json.calledOnce).to.be.true
      expect(SocketAuthority.emitter.called).to.be.false
    })

    it('should allow same name in different libraries', async () => {
      const library2 = await Database.libraryModel.create({ name: 'Other Library', mediaType: 'book' })

      await Database.seriesModel.create({
        name: 'Shared Name',
        libraryId: library.id
      })

      const seriesToRename = await Database.seriesModel.create({
        name: 'Old_Name',
        libraryId: library2.id
      })

      const fakeReq = {
        series: seriesToRename,
        body: { name: 'Shared Name' }
      }
      const fakeRes = {
        status: sinon.stub().returnsThis(),
        send: sinon.spy(),
        json: sinon.spy()
      }

      await SeriesController.update(fakeReq, fakeRes)

      expect(fakeRes.json.calledOnce).to.be.true
      const result = fakeRes.json.firstCall.args[0]
      expect(result.name).to.equal('Shared Name')
    })

    it('should update description successfully', async () => {
      const series = await Database.seriesModel.create({
        name: 'Test Series',
        libraryId: library.id
      })

      const fakeReq = {
        series,
        body: { description: 'A great series' }
      }
      const fakeRes = {
        status: sinon.stub().returnsThis(),
        send: sinon.spy(),
        json: sinon.spy()
      }

      await SeriesController.update(fakeReq, fakeRes)

      expect(fakeRes.json.calledOnce).to.be.true
      const result = fakeRes.json.firstCall.args[0]
      expect(result.description).to.equal('A great series')
    })
  })
})
