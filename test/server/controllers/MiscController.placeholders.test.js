const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const MiscController = require('../../../server/controllers/MiscController')
const Database = require('../../../server/Database')
const fs = require('../../../server/libs/fsExtra')
const LibraryScanner = require('../../../server/scanner/LibraryScanner')
const LibraryItemScanner = require('../../../server/scanner/LibraryItemScanner')

describe('MiscController placeholder uploads', () => {
  let library
  let folder
  let placeholderItem

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
    folder = await Database.libraryFolderModel.create({ path: '/library', libraryId: library.id })
    const book = await Database.bookModel.create({ title: 'Placeholder', audioFiles: [], tags: [], narrators: [], genres: [], chapters: [] })
    placeholderItem = await Database.libraryItemModel.create({
      libraryFiles: [],
      mediaId: book.id,
      mediaType: 'book',
      libraryId: library.id,
      libraryFolderId: folder.id,
      relPath: 'Author/Title',
      path: '/library/Author/Title',
      isFile: false,
      isPlaceholder: true
    })

    sinon.stub(fs, 'ensureDir').resolves()
    sinon.stub(LibraryScanner, 'promotePlaceholder').resolves()
    sinon.stub(LibraryItemScanner, 'scanLibraryItem').resolves()
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.sync({ force: true })
  })

  it('does not promote placeholder-targeted uploads when files are non-media only', async () => {
    const fakeReq = {
      user: {
        canUpload: true,
        username: 'admin',
        checkCanAccessLibrary: () => true
      },
      body: {
        title: 'Placeholder',
        library: library.id,
        folder: folder.id,
        placeholder: `id:${placeholderItem.id}`
      },
      files: {
        cover: {
          name: 'cover.jpg',
          mv: sinon.stub().resolves()
        }
      }
    }

    const fakeRes = {
      status: sinon.stub().returnsThis(),
      sendStatus: sinon.spy(),
      send: sinon.spy()
    }

    await MiscController.handleUpload(fakeReq, fakeRes)

    expect(LibraryScanner.promotePlaceholder.called).to.be.false
    expect(LibraryItemScanner.scanLibraryItem.called).to.be.false
    expect(fakeRes.sendStatus.calledWith(200)).to.be.true
  })

  it('promotes placeholder-targeted uploads when files include media', async () => {
    const fakeReq = {
      user: {
        canUpload: true,
        username: 'admin',
        checkCanAccessLibrary: () => true
      },
      body: {
        title: 'Placeholder',
        library: library.id,
        folder: folder.id,
        placeholder: `id:${placeholderItem.id}`
      },
      files: {
        audio: {
          name: 'track-01.mp3',
          mv: sinon.stub().resolves()
        },
        cover: {
          name: 'cover.jpg',
          mv: sinon.stub().resolves()
        }
      }
    }

    const fakeRes = {
      status: sinon.stub().returnsThis(),
      sendStatus: sinon.spy(),
      send: sinon.spy()
    }

    await MiscController.handleUpload(fakeReq, fakeRes)

    expect(LibraryScanner.promotePlaceholder.calledOnce).to.be.true
    expect(LibraryItemScanner.scanLibraryItem.calledOnce).to.be.true
    expect(fakeRes.sendStatus.calledWith(200)).to.be.true
  })
})
