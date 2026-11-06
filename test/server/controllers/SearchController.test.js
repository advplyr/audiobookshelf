const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const ApiRouter = require('../../../server/routers/ApiRouter')
const SearchController = require('../../../server/controllers/SearchController')
const BookFinder = require('../../../server/finders/BookFinder')
const AudiobookDBError = require('../../../server/providers/AudiobookDBError')
const ApiCacheManager = require('../../../server/managers/ApiCacheManager')
const Auth = require('../../../server/Auth')
const Logger = require('../../../server/Logger')

describe('SearchController', () => {
  /** @type {ApiRouter} */
  let apiRouter

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    apiRouter = new ApiRouter({
      auth: new Auth(),
      apiCacheManager: new ApiCacheManager()
    })

    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'error')
  })

  afterEach(async () => {
    sinon.restore()

    // Clear all tables
    await Database.sequelize.sync({ force: true })
  })

  describe('findCovers', () => {
    ;[
      ['audiobookdb_key_required', 503],
      ['audiobookdb_auth', 502],
      ['audiobookdb_rate_limited', 429],
      ['audiobookdb_unavailable', 503]
    ].forEach(([code, status]) => {
      it(`returns an actionable ${code} for explicit AudiobookDB cover searches`, async () => {
        const failure = new AudiobookDBError(code, code === 'audiobookdb_rate_limited' ? 42 : undefined)
        sinon.stub(BookFinder, 'findCovers').rejects(failure)
        const res = {
          json: sinon.spy(),
          set: sinon.stub().returnsThis(),
          status: sinon.stub().returnsThis()
        }
        await SearchController.findCovers({ query: { provider: 'audiobookdb', title: 'The Martian' } }, res)
        sinon.assert.calledWithExactly(res.status, status)
        sinon.assert.calledWithExactly(res.json, {
          error: failure.message, code,
          ...(failure.retryAfter !== undefined ? { retryAfter: 42 } : {})
        })
        if (failure.retryAfter !== undefined) sinon.assert.calledWithExactly(res.set, 'Retry-After', '42')
        else sinon.assert.notCalled(res.set)
      })
    })
  })

  describe('findBooks', () => {
    /** @type {sinon.SinonStub} */
    let searchStub
    let libraryItemId

    beforeEach(async () => {
      searchStub = sinon.stub(BookFinder, 'search')
      searchStub.resolves([])

      const newLibrary = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
      const newLibraryFolder = await Database.libraryFolderModel.create({ path: '/test', libraryId: newLibrary.id })
      const newBook = await Database.bookModel.create({ title: 'Test Book', audioFiles: [], tags: [], narrators: [], genres: [], chapters: [], asin: 'B0TESTASIN' })
      const newLibraryItem = await Database.libraryItemModel.create({ libraryFiles: [], mediaId: newBook.id, mediaType: 'book', libraryId: newLibrary.id, libraryFolderId: newLibraryFolder.id })
      libraryItemId = newLibraryItem.id
    })

    const callFindBooks = (query) => {
      const fakeReq = { query }
      const fakeRes = {
        json: sinon.spy(),
        headers: {},
        set(name, value) {
          this.headers[name] = value
          return this
        },
        status(status) {
          this.statusCode = status
          return this
        }
      }
      return Promise.resolve(SearchController.findBooks.bind(apiRouter)(fakeReq, fakeRes)).then(() => ({
        statusCode: fakeRes.statusCode || null,
        headers: fakeRes.headers,
        body: fakeRes.json.firstCall ? fakeRes.json.firstCall.args[0] : null
      }))
    }

    ;[
      ['audiobookdb_key_required', 503],
      ['audiobookdb_auth', 502],
      ['audiobookdb_rate_limited', 429],
      ['audiobookdb_unavailable', 503]
    ].forEach(([code, status]) => {
      it(`returns actionable ${code} failures instead of empty results`, async () => {
        const error = new AudiobookDBError(code)
        searchStub.rejects(error)
        const response = await callFindBooks({ provider: 'audiobookdb', title: 'Foundation' })
        expect(response.statusCode).to.equal(status)
        expect(response.body).to.deep.equal({ error: error.message, code })
        expect(response.headers).to.deep.equal({})
      })
    })

    it('returns retry timing in both the JSON and Retry-After header', async () => {
      const error = new AudiobookDBError('audiobookdb_rate_limited', 42)
      searchStub.rejects(error)
      const response = await callFindBooks({ provider: 'audiobookdb', title: 'Foundation' })
      expect(response.statusCode).to.equal(429)
      expect(response.body).to.deep.equal({ error: error.message, code: error.code, retryAfter: 42 })
      expect(response.headers).to.deep.equal({ 'Retry-After': '42' })
    })

    it('forwards an explicit ASIN as the asin argument for audiobookdb', async () => {
      await callFindBooks({ provider: 'audiobookdb', title: 'Foundation', asin: 'B0TESTASIN', id: libraryItemId })

      sinon.assert.calledOnce(searchStub)
      const args = searchStub.firstCall.args
      expect(args[0].id).to.equal(libraryItemId)
      expect(args.slice(1)).to.deep.equal(['audiobookdb', 'Foundation', '', undefined, 'B0TESTASIN'])
    })

    it('uppercases the explicit ASIN before forwarding', async () => {
      await callFindBooks({ provider: 'audiobookdb', title: 'Foundation', asin: 'b0testasin' })

      expect(searchStub.firstCall.args[5]).to.equal('B0TESTASIN')
    })

    it('does not forward an explicit ASIN for other providers', async () => {
      await callFindBooks({ provider: 'google', title: 'Foundation', asin: 'B0TESTASIN' })

      expect(searchStub.firstCall.args).to.deep.equal([null, 'google', 'Foundation', '', undefined, null])
    })

    it('never treats an ASIN-shaped title as an explicit ASIN', async () => {
      await callFindBooks({ provider: 'audiobookdb', title: 'B0TESTASIN', id: libraryItemId })

      sinon.assert.calledOnce(searchStub)
      const args = searchStub.firstCall.args
      expect(args[0].id).to.equal(libraryItemId)
      expect(args.slice(1)).to.deep.equal(['audiobookdb', 'B0TESTASIN', '', undefined, null])
    })

    it('rejects an invalid explicit ASIN', async () => {
      const response = await callFindBooks({ provider: 'audiobookdb', title: 'Foundation', asin: 'not-an-asin' })

      expect(response.statusCode).to.equal(400)
      expect(response.body).to.deep.equal({ error: 'Query parameter "asin" is invalid' })
      expect(searchStub.called).to.be.false
    })

    it('rejects an empty title without an explicit ASIN for audiobookdb', async () => {
      const response = await callFindBooks({ provider: 'audiobookdb', title: '' })

      expect(response.statusCode).to.equal(400)
      expect(response.body).to.deep.equal({ error: 'Query parameter "title" is required' })
      expect(searchStub.called).to.be.false
    })

    it('allows an empty title with an explicit ASIN for audiobookdb', async () => {
      await callFindBooks({ provider: 'audiobookdb', title: '', asin: 'B0TESTASIN' })

      expect(searchStub.firstCall.args).to.deep.equal([null, 'audiobookdb', '', '', undefined, 'B0TESTASIN'])
    })
  })
})
