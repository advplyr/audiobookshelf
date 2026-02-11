const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const ApiRouter = require('../../../server/routers/ApiRouter')
const AuthorController = require('../../../server/controllers/AuthorController')
const ApiCacheManager = require('../../../server/managers/ApiCacheManager')
const Auth = require('../../../server/Auth')
const Logger = require('../../../server/Logger')
const User = require('../../../server/models/User')
const fs = require('../../../server/libs/fsExtra')

describe('AuthorController placeholders', () => {
  /** @type {ApiRouter} */
  let apiRouter
  let library
  let libraryFolder
  let secondaryLibraryFolder
  let author
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
    sinon.stub(fs, 'pathExists').resolves(false)
    sinon.stub(fs, 'ensureDir').resolves()

    library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
    libraryFolder = await Database.libraryFolderModel.create({ path: '/test', libraryId: library.id })
    secondaryLibraryFolder = await Database.libraryFolderModel.create({ path: '/secondary', libraryId: library.id })
    author = await Database.authorModel.create({ name: 'Jane Doe', lastFirst: 'Doe, Jane', libraryId: library.id })

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

  it('creates placeholder items for an author', async () => {
    const fakeReq = {
      params: {
        id: author.id
      },
      author,
      user,
      body: {}
    }

    const fakeRes = {
      status: sinon.stub().returnsThis(),
      json: sinon.spy(),
      sendStatus: sinon.spy()
    }

    await AuthorController.createPlaceholder.bind(apiRouter)(fakeReq, fakeRes)

    expect(fakeRes.json.calledOnce).to.be.true
    const payload = fakeRes.json.firstCall.args[0]
    expect(payload).to.include({ mediaType: 'book', isPlaceholder: true })
    expect(payload.media.metadata.authors.some((entry) => entry.id === author.id)).to.be.true
  })

  it('creates author placeholder directories on disk', async () => {
    const fakeReq = {
      params: {
        id: author.id
      },
      author,
      user,
      body: {}
    }

    const fakeRes = {
      status: sinon.stub().returnsThis(),
      json: sinon.spy(),
      sendStatus: sinon.spy(),
      send: sinon.spy()
    }

    await AuthorController.createPlaceholder.bind(apiRouter)(fakeReq, fakeRes)

    expect(fs.ensureDir.calledOnce).to.be.true
    expect(fs.ensureDir.firstCall.args[0]).to.equal('/test/Jane Doe/Placeholder')
  })

  it('rejects cover url payloads for author placeholder creation', async () => {
    const fakeReq = {
      params: {
        id: author.id
      },
      author,
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

    await AuthorController.createPlaceholder.bind(apiRouter)(fakeReq, fakeRes)

    expect(fakeRes.status.calledWith(400)).to.be.true
    expect(fakeRes.send.calledWith('Cover uploads are not supported for placeholders')).to.be.true
  })

  it('uses the authors library folder when creating a placeholder', async () => {
    const existingBook = await Database.bookModel.create({
      title: 'Existing Book',
      audioFiles: [],
      tags: [],
      narrators: [],
      genres: [],
      chapters: []
    })
    await Database.bookAuthorModel.create({ bookId: existingBook.id, authorId: author.id })
    await Database.libraryItemModel.create({
      libraryFiles: [],
      mediaId: existingBook.id,
      mediaType: 'book',
      libraryId: library.id,
      libraryFolderId: secondaryLibraryFolder.id
    })

    const fakeReq = {
      params: {
        id: author.id
      },
      author,
      user,
      body: {}
    }

    const fakeRes = {
      status: sinon.stub().returnsThis(),
      json: sinon.spy(),
      sendStatus: sinon.spy(),
      send: sinon.spy()
    }

    await AuthorController.createPlaceholder.bind(apiRouter)(fakeReq, fakeRes)

    expect(fakeRes.json.calledOnce).to.be.true
    const payload = fakeRes.json.firstCall.args[0]
    expect(payload.folderId).to.equal(secondaryLibraryFolder.id)
    expect(payload.path.startsWith(secondaryLibraryFolder.path)).to.be.true
  })

  it('removes placeholder directory when creation fails after directory is created', async () => {
    sinon.stub(fs, 'remove').resolves()
    fs.pathExists.resolves(false)
    sinon.stub(Database.libraryItemModel, 'create').rejects(new Error('library item create failed'))

    const fakeReq = {
      params: {
        id: author.id
      },
      author,
      user,
      body: {}
    }

    const fakeRes = {
      status: sinon.stub().returnsThis(),
      json: sinon.spy(),
      sendStatus: sinon.spy(),
      send: sinon.spy()
    }

    await AuthorController.createPlaceholder.bind(apiRouter)(fakeReq, fakeRes)

    expect(fakeRes.status.calledWith(500)).to.be.true
    expect(fakeRes.send.calledWith('Failed to create placeholder')).to.be.true
    expect(fs.remove.calledOnce).to.be.true
    expect(fs.remove.firstCall.args[0]).to.equal('/test/Jane Doe/Placeholder')
  })

  it('does not remove placeholder directory on rollback when it already existed', async () => {
    sinon.stub(fs, 'remove').resolves()
    fs.pathExists.resolves(true)
    sinon.stub(Database.libraryItemModel, 'create').rejects(new Error('library item create failed'))

    const fakeReq = {
      params: {
        id: author.id
      },
      author,
      user,
      body: {}
    }

    const fakeRes = {
      status: sinon.stub().returnsThis(),
      json: sinon.spy(),
      sendStatus: sinon.spy(),
      send: sinon.spy()
    }

    await AuthorController.createPlaceholder.bind(apiRouter)(fakeReq, fakeRes)

    expect(fakeRes.status.calledWith(500)).to.be.true
    expect(fakeRes.send.calledWith('Failed to create placeholder')).to.be.true
    expect(fs.remove.called).to.be.false
  })
})
