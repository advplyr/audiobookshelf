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
  let secondaryLibraryFolder
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
    secondaryLibraryFolder = await Database.libraryFolderModel.create({ path: '/secondary', libraryId: library.id })
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

  it('rejects cover url payloads for placeholder creation', async () => {
    const fakeReq = {
      params: {
        id: library.id,
        seriesId: series.id
      },
      user,
      body: {
        url: 'http://example.com/cover.jpg'
      }
    }

    const fakeRes = {
      status: sinon.stub().returnsThis(),
      json: sinon.spy(),
      send: sinon.spy(),
      sendStatus: sinon.spy()
    }

    await SeriesController.createPlaceholder.bind(apiRouter)(fakeReq, fakeRes)

    expect(fakeRes.status.calledWith(400)).to.be.true
    expect(fakeRes.send.calledWith('Cover uploads are not supported for placeholders')).to.be.true
  })

  it('rejects cover file payloads for placeholder creation', async () => {
    const fakeReq = {
      params: {
        id: library.id,
        seriesId: series.id
      },
      user,
      body: {},
      files: {
        cover: {
          name: 'cover.jpg'
        }
      }
    }

    const fakeRes = {
      status: sinon.stub().returnsThis(),
      json: sinon.spy(),
      send: sinon.spy(),
      sendStatus: sinon.spy()
    }

    await SeriesController.createPlaceholder.bind(apiRouter)(fakeReq, fakeRes)

    expect(fakeRes.status.calledWith(400)).to.be.true
    expect(fakeRes.send.calledWith('Cover uploads are not supported for placeholders')).to.be.true
  })

  it('uses the series library folder when creating a placeholder', async () => {
    const existingBook = await Database.bookModel.create({
      title: 'Existing Book',
      audioFiles: [],
      tags: [],
      narrators: [],
      genres: [],
      chapters: []
    })
    await Database.bookSeriesModel.create({ bookId: existingBook.id, seriesId: series.id })
    await Database.libraryItemModel.create({
      libraryFiles: [],
      mediaId: existingBook.id,
      mediaType: 'book',
      libraryId: library.id,
      libraryFolderId: secondaryLibraryFolder.id
    })

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
      sendStatus: sinon.spy(),
      send: sinon.spy()
    }

    await SeriesController.createPlaceholder.bind(apiRouter)(fakeReq, fakeRes)

    expect(fakeRes.json.calledOnce).to.be.true
    const payload = fakeRes.json.firstCall.args[0]
    expect(payload.folderId).to.equal(secondaryLibraryFolder.id)
    expect(payload.path.startsWith(secondaryLibraryFolder.path)).to.be.true
  })

  it('honors a requested folderId when creating a placeholder', async () => {
    const existingBook = await Database.bookModel.create({
      title: 'Existing Book 2',
      audioFiles: [],
      tags: [],
      narrators: [],
      genres: [],
      chapters: []
    })
    await Database.bookSeriesModel.create({ bookId: existingBook.id, seriesId: series.id })
    await Database.libraryItemModel.create({
      libraryFiles: [],
      mediaId: existingBook.id,
      mediaType: 'book',
      libraryId: library.id,
      libraryFolderId: secondaryLibraryFolder.id
    })

    const fakeReq = {
      params: {
        id: library.id,
        seriesId: series.id
      },
      user,
      body: {
        folderId: libraryFolder.id
      }
    }

    const fakeRes = {
      status: sinon.stub().returnsThis(),
      json: sinon.spy(),
      sendStatus: sinon.spy(),
      send: sinon.spy()
    }

    await SeriesController.createPlaceholder.bind(apiRouter)(fakeReq, fakeRes)

    expect(fakeRes.json.calledOnce).to.be.true
    const payload = fakeRes.json.firstCall.args[0]
    expect(payload.folderId).to.equal(libraryFolder.id)
    expect(payload.path.startsWith(libraryFolder.path)).to.be.true
  })
})
