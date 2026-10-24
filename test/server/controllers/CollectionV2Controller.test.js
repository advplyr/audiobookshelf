const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const ApiRouter = require('../../../server/routers/ApiRouter')
const CollectionV2Controller = require('../../../server/controllers/CollectionV2Controller')
const LibraryController = require('../../../server/controllers/LibraryController')
const ApiCacheManager = require('../../../server/managers/ApiCacheManager')
const Auth = require('../../../server/Auth')
const collectionFilters = require('../../../server/utils/queries/collectionFilters')

describe('GET /api/v2/libraries/:id/collections', () => {
  let library
  let folder
  let user

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false
    })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    library = await Database.libraryModel.create({
      id: 'library-a',
      name: 'Books',
      mediaType: 'book'
    })
    folder = await Database.libraryFolderModel.create({
      path: '/books',
      libraryId: library.id
    })
    user = {
      canAccessExplicitContent: true,
      permissions: {
        accessAllTags: true
      },
      checkCanAccessLibrary: (id) => id === library.id,
      username: 'reader'
    }
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.close()
  })

  async function addBook(id, { explicit = false, tags = [], coverPath = `${id}.jpg` } = {}) {
    const book = await Database.bookModel.create({
      id: `book-${id}`,
      title: id,
      explicit,
      tags,
      coverPath,
      audioFiles: [],
      narrators: [],
      genres: [],
      chapters: []
    })
    const item = await Database.libraryItemModel.create({
      id: `item-${id}`,
      path: `/books/${id}`,
      libraryFiles: [],
      mediaId: book.id,
      mediaType: 'book',
      libraryId: library.id,
      libraryFolderId: folder.id
    })
    return { book, item }
  }

  async function addCollection(id, name, books) {
    const collection = await Database.collectionModel.create({
      id,
      libraryId: library.id,
      name,
      description: `${name} description`
    })
    for (let order = 0; order < books.length; order++) {
      await Database.collectionBookModel.create({
        collectionId: collection.id,
        bookId: books[order].book.id,
        order
      })
    }
    return collection
  }

  function response() {
    return {
      status: sinon.stub().returnsThis(),
      json: sinon.spy(),
      send: sinon.spy(),
      sendStatus: sinon.spy()
    }
  }

  async function request(query = {}) {
    const req = {
      query,
      params: { id: library.id },
      user,
      library,
      collectionSummaryQuery: undefined
    }
    const res = response()
    CollectionV2Controller.validateQuery(req, res, () => {})
    if (!res.status.called) await CollectionV2Controller.findAll(req, res)
    return { req, res, body: res.json.lastCall?.args[0] }
  }

  it('paginates in the database with stable case-insensitive name and id ordering', async () => {
    const visible = await addBook('visible')
    await addCollection('c-b', 'alpha', [visible])
    await addCollection('c-a', 'Alpha', [visible])
    await addCollection('c-c', 'Bravo', [visible])

    const first = await request({ limit: '2', page: '0' })
    const second = await request({ limit: '2', page: '1' })
    expect(first.body.results.map((c) => c.id)).to.deep.equal(['c-a', 'c-b'])
    expect(second.body.results.map((c) => c.id)).to.deep.equal(['c-c'])
    expect(first.body).to.include({ total: 3, limit: 2, page: 0, sortBy: 'name', sortDesc: false, filterBy: '' })
  })

  it('filters names case-insensitively and treats wildcard characters literally', async () => {
    await Database.sequelize.query('PRAGMA case_sensitive_like = ON')
    const visible = await addBook('visible')
    await addCollection('c-1', 'One 100% Pick', [visible])
    await addCollection('c-2', 'One 1000 Pick', [visible])
    await addCollection('c-3', 'One_under Pick', [visible])
    await addCollection('c-4', 'OneXunder Pick', [visible])
    await addCollection('c-5', 'One\\path Pick', [visible])
    expect((await request({ filter: '100% pICK' })).body.results.map((c) => c.id)).to.deep.equal(['c-1'])
    expect((await request({ filter: 'one_UNDER' })).body.results.map((c) => c.id)).to.deep.equal(['c-3'])
    expect((await request({ filter: '\\PATH pick' })).body.results.map((c) => c.id)).to.deep.equal(['c-5'])
  })

  it('rejects invalid pagination query values', () => {
    const invalidQueries = [
      { page: '1x' },
      { page: '-1' },
      { page: ['1'] },
      { page: '9007199254740992' },
      { limit: '0' },
      { limit: '101' }
    ]

    for (const query of invalidQueries) {
      const req = { query }
      const res = response()

      CollectionV2Controller.validateQuery(req, res, sinon.spy())

      expect(res.status.calledWith(400), JSON.stringify(query)).to.equal(true)
      expect(res.send.calledWithMatch(/^Invalid request\./)).to.equal(true)
    }
  })

  it('rejects invalid sort, direction, and filter query values', () => {
    const invalidQueries = [{ desc: 'true' }, { sort: 'books' }, { filter: ['name'] }]

    for (const query of invalidQueries) {
      const req = { query }
      const res = response()

      CollectionV2Controller.validateQuery(req, res, sinon.spy())

      expect(res.status.calledWith(400), JSON.stringify(query)).to.equal(true)
      expect(res.send.calledWithMatch(/^Invalid request\./)).to.equal(true)
    }
  })

  it('ignores unrelated query parameters', () => {
    const req = { query: { include: 'books' } }
    const res = response()
    const next = sinon.spy()

    CollectionV2Controller.validateQuery(req, res, next)

    expect(res.status.called).to.equal(false)
    expect(next.calledOnce).to.equal(true)
    expect(req.collectionSummaryQuery).to.deep.equal({
      page: 0,
      limit: 20,
      sort: 'name',
      desc: false,
      filter: ''
    })
  })

  it('uses the same explicit and tag visibility for existence, counts, and previews', async () => {
    const allowed1 = await addBook('allowed-1', { tags: ['allowed'] })
    const allowed2 = await addBook('allowed-2', { tags: ['allowed'] })
    const allowed3 = await addBook('allowed-3', { tags: ['allowed'] })
    const explicit = await addBook('explicit', { explicit: true, tags: ['allowed'] })
    const deniedTag = await addBook('denied', { tags: ['denied'] })
    await addCollection('mixed', 'Mixed', [explicit, allowed1, deniedTag, allowed2, allowed3])
    await addCollection('hidden', 'Hidden', [explicit, deniedTag])
    user.canAccessExplicitContent = false
    user.permissions = { accessAllTags: false, itemTagsSelected: ['allowed'], selectedTagsNotAccessible: false }

    const { body } = await request()
    expect(body.total).to.equal(1)
    expect(body.results[0].numBooks).to.equal(3)
    expect(body.results[0].previewItems).to.deep.equal([
      { id: 'item-allowed-1', media: { coverPath: 'allowed-1.jpg' } },
      { id: 'item-allowed-2', media: { coverPath: 'allowed-2.jpg' } }
    ])
  })

  it('returns a persisted collection with no book memberships as an empty summary', async () => {
    const book = await addBook('removed')
    const collection = await addCollection('empty', 'Empty', [book])
    await Database.collectionBookModel.destroy({ where: { collectionId: collection.id } })

    const { body } = await request()

    expect(body.total).to.equal(1)
    expect(body.results).to.have.length(1)
    expect(body.results[0]).to.include({ id: collection.id, numBooks: 0 })
    expect(body.results[0].previewItems).to.deep.equal([])
  })

  it('returns only compact summaries and at most two compact previews', async () => {
    const books = [await addBook('a'), await addBook('b'), await addBook('c')]
    const collection = await addCollection('compact', 'Compact', books)
    const summary = (await request()).body.results[0]
    expect(summary).to.have.all.keys('id', 'libraryId', 'name', 'description', 'numBooks', 'previewItems', 'createdAt', 'updatedAt')
    expect(summary).not.to.have.property('books')
    expect(summary.previewItems).to.have.length(2)
    expect(summary.previewItems[0].media).to.have.all.keys('coverPath')
    expect(summary.createdAt).to.be.a('number').and.satisfy(Number.isFinite)
    expect(summary.updatedAt).to.be.a('number').and.satisfy(Number.isFinite)
    expect(summary.createdAt).to.equal(collection.createdAt.valueOf())
    expect(summary.updatedAt).to.equal(collection.updatedAt.valueOf())
  })

  it('loads previews with one batch query regardless of the number of collection rows', async () => {
    const visible = await addBook('visible')
    await addCollection('c-1', 'One', [visible])
    await addCollection('c-2', 'Two', [visible])
    await addCollection('c-3', 'Three', [visible])
    const querySpy = sinon.spy(Database.sequelize, 'query')

    const { body } = await request({ limit: '100' })

    expect(body.results).to.have.length(3)
    const previewQueries = () => querySpy.getCalls().filter((call) => call.args[0].includes('WITH rankedPreviews AS'))
    expect(previewQueries()).to.have.length(1)
    expect((await request({ limit: '100', page: '1' })).body.results).to.be.empty
    expect(previewQueries()).to.have.length(1)
  })

  it('scopes preview library items to the requested library', async () => {
    const visible = await addBook('shared')
    await addCollection('shared-collection', 'Shared', [visible])
    const otherLibrary = await Database.libraryModel.create({ id: 'library-b', name: 'Other', mediaType: 'book' })
    const otherFolder = await Database.libraryFolderModel.create({ path: '/other-books', libraryId: otherLibrary.id })
    await Database.libraryItemModel.create({
      id: 'item-shared-other-library',
      path: '/other-books/shared',
      libraryFiles: [],
      mediaId: visible.book.id,
      mediaType: 'book',
      libraryId: otherLibrary.id,
      libraryFolderId: otherFolder.id
    })

    expect((await request()).body.results[0].previewItems).to.deep.equal([{ id: 'item-shared', media: { coverPath: 'shared.jpg' } }])
  })

  it('rejects unsupported helper sorts before executing a query', async () => {
    const queryStub = sinon.stub(Database.sequelize, 'query')

    for (const sort of ['name; DROP TABLE collections', 'toString']) {
      let error
      try {
        await collectionFilters.getCollectionSummaries({ libraryId: library.id, user, page: 0, limit: 20, sort, desc: false, filter: '' })
      } catch (caught) {
        error = caught
      }

      expect(error).to.be.an('error').with.property('message').that.includes('Unsupported collection summary sort')
    }
    expect(queryStub.called).to.equal(false)
  })

  it('checks library access and existence before validating the captured raw v2 query', async () => {
    async function runUntilResponse(req) {
      const res = response()
      CollectionV2Controller.captureQuery(req, res, () => {})
      await LibraryController.middleware(req, res, () => CollectionV2Controller.validateQuery(req, res, () => {}))
      return res
    }

    const deniedRes = await runUntilResponse({ params: { id: 'other-library' }, query: { limit: 'invalid' }, user })
    expect(deniedRes.sendStatus.calledWith(403)).to.equal(true)
    expect(deniedRes.status.calledWith(400)).to.equal(false)

    const missingRes = await runUntilResponse({ params: { id: 'missing' }, query: { page: 'invalid' }, user: { ...user, checkCanAccessLibrary: () => true } })
    expect(missingRes.status.calledWith(404)).to.equal(true)
    expect(missingRes.status.calledWith(400)).to.equal(false)

    const malformedReq = { params: { id: library.id }, query: { page: '01', limit: '1e2' }, user }
    const malformedRes = await runUntilResponse(malformedReq)
    expect(malformedReq.query).to.deep.equal({ page: 1, limit: 100 })
    expect(malformedRes.status.calledWith(400)).to.equal(true)
  })

  it('preserves existing library access behavior and legacy route registration', async () => {
    const deniedReq = { params: { id: 'other-library' }, query: {}, user }
    const deniedRes = response()
    await LibraryController.middleware(deniedReq, deniedRes, sinon.spy())
    expect(deniedRes.sendStatus.calledWith(403)).to.equal(true)

    const missingReq = { params: { id: 'missing' }, query: {}, user: { ...user, checkCanAccessLibrary: () => true } }
    const missingRes = response()
    await LibraryController.middleware(missingReq, missingRes, sinon.spy())
    expect(missingRes.status.calledWith(404)).to.equal(true)
    expect(missingRes.send.calledWith('Library not found')).to.equal(true)

    const router = new ApiRouter({ auth: new Auth(), apiCacheManager: new ApiCacheManager() })
    const routeLayers = router.router._router.stack.filter((layer) => layer.route)
    const routes = routeLayers.map((layer) => layer.route.path)
    expect(routes).to.include('/v2/libraries/:id/collections')
    expect(routes).to.include('/libraries/:id/collections')
    expect(routes).to.include('/collections/:id')
    const v2Route = routeLayers.find((layer) => layer.route.path === '/v2/libraries/:id/collections')
    expect(v2Route.route.stack.map((layer) => layer.name)).to.deep.equal(['bound captureQuery', 'bound middleware', 'bound validateQuery', 'bound findAll'])
  })
})
