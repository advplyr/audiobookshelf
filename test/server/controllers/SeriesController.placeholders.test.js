const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const ApiRouter = require('../../../server/routers/ApiRouter')
const SeriesController = require('../../../server/controllers/SeriesController')
const ApiCacheManager = require('../../../server/managers/ApiCacheManager')
const Auth = require('../../../server/Auth')
const Logger = require('../../../server/Logger')
const User = require('../../../server/models/User')

describe('SeriesController placeholders', () => {
  /** @type {ApiRouter} */
  let apiRouter
  let library
  let libraryFolder
  let series
  let user

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    apiRouter = new ApiRouter({
      auth: new Auth(),
      apiCacheManager: new ApiCacheManager()
    })

    sinon.stub(Logger, 'warn')

    library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
    libraryFolder = await Database.libraryFolderModel.create({ path: '/test', libraryId: library.id })
    series = await Database.seriesModel.create({ name: 'Test Series', libraryId: library.id })

    user = await Database.userModel.create({
      username: 'Admin',
      type: 'admin',
      isActive: true,
      permissions: User.getDefaultPermissionsForUserType('admin'),
      bookmarks: [],
      extraData: { seriesHideFromContinueListening: [] }
    })
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.sync({ force: true })
  })

  it('creates placeholder items in a series', async () => {
    expect(SeriesController.createPlaceholder).to.be.a('function')

    const fakeReq = {
      params: {
        id: library.id,
        seriesId: series.id
      },
      user,
      body: {}
    }

    const fakeRes = {
      status: sinon.stub().returnsThis(),
      json: sinon.spy(),
      sendStatus: sinon.spy()
    }

    await SeriesController.createPlaceholder.bind(apiRouter)(fakeReq, fakeRes)

    expect(fakeRes.json.calledOnce).to.be.true
    const payload = fakeRes.json.firstCall.args[0]
    expect(payload).to.include({ mediaType: 'book', isPlaceholder: true })
    expect(payload.media.metadata.series.some((entry) => entry.id === series.id)).to.be.true
  })
})
