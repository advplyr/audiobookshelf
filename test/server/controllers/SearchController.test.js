const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')
const fs = require('../../../server/libs/fsExtra')

const Database = require('../../../server/Database')
const SearchController = require('../../../server/controllers/SearchController')
const BookFinder = require('../../../server/finders/BookFinder')
const LibraryController = require('../../../server/controllers/LibraryController')
const ServerSettings = require('../../../server/objects/settings/ServerSettings')
const SocketAuthority = require('../../../server/SocketAuthority')
const Watcher = require('../../../server/Watcher')
const Logger = require('../../../server/Logger')

describe('SearchController and Provider Defaults', () => {
  beforeEach(async () => {
    global.ServerSettings = {}
    global.MetadataPath = '/tmp'
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'debug')
    sinon.stub(Logger, 'error')
    sinon.stub(Logger, 'warn')
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.sync({ force: true })
  })

  describe('getAllProviders', () => {
    it('omits google from providers list and defaults books to audible first', async () => {
      let jsonPayload = null
      const fakeRes = {
        json: (data) => {
          jsonPayload = data
        }
      }

      await SearchController.getAllProviders({}, fakeRes)

      expect(jsonPayload).to.be.an('object')
      expect(jsonPayload.providers).to.be.an('object')

      const bookProviderValues = jsonPayload.providers.books.map((p) => p.value)
      expect(bookProviderValues).to.not.include('google')
      expect(bookProviderValues[0]).to.equal('audible')

      const coverProviderValues = jsonPayload.providers.booksCovers.map((p) => p.value)
      expect(coverProviderValues).to.not.include('google')
      expect(coverProviderValues).to.include('audible')
      expect(coverProviderValues).to.include('best')
      expect(coverProviderValues).to.include('all')
    })
  })

  describe('findBooks and findCovers defaults', () => {
    it('defaults provider to audible when omitted from query in findBooks', async () => {
      const searchStub = sinon.stub(BookFinder, 'search').resolves([])
      const fakeReq = { query: { title: 'Test Book' } }
      const fakeRes = { json: sinon.spy() }

      await SearchController.findBooks(fakeReq, fakeRes)

      expect(searchStub.calledOnce).to.be.true
      expect(searchStub.firstCall.args[1]).to.equal('audible')
    })

    it('defaults provider to audible when omitted from query in findCovers', async () => {
      const findCoversStub = sinon.stub(BookFinder, 'findCovers').resolves([])
      const fakeReq = { query: { title: 'Test Book' } }
      const fakeRes = { json: sinon.spy() }

      await SearchController.findCovers(fakeReq, fakeRes)

      expect(findCoversStub.calledOnce).to.be.true
      expect(findCoversStub.firstCall.args[0]).to.equal('audible')
    })
  })

  describe('LibraryController.create default provider', () => {
    it('defaults provider to audible when not specified in payload', async () => {
      sinon.stub(SocketAuthority, 'emitter')
      sinon.stub(Watcher, 'addLibrary')
      sinon.stub(fs, 'ensureDir').resolves()

      let createdLibrary = null
      const fakeReq = {
        user: { isAdminOrUp: true },
        body: {
          name: 'New Audio Library',
          mediaType: 'book',
          folders: [{ path: '/test-audiobooks' }]
        }
      }
      const fakeRes = {
        json: (lib) => {
          createdLibrary = lib
        },
        status: sinon.stub().returns({ send: sinon.spy() })
      }

      await LibraryController.create(fakeReq, fakeRes)

      expect(createdLibrary).to.not.be.null
      expect(createdLibrary.provider).to.equal('audible')
    })
  })

  describe('ServerSettings default scannerCoverProvider', () => {
    it('defaults scannerCoverProvider to audible', () => {
      const settings = new ServerSettings()
      expect(settings.scannerCoverProvider).to.equal('audible')
    })

    it('defaults scannerCoverProvider to audible in construct when omitted', () => {
      const settings = new ServerSettings()
      settings.construct({})
      expect(settings.scannerCoverProvider).to.equal('audible')
    })
  })
})
