const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const LibraryController = require('../../../server/controllers/LibraryController')
const libraryFilters = require('../../../server/utils/queries/libraryFilters')

describe('LibraryController large-library browse contract', () => {
  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.sync({ force: true })
  })

  it('returns pagination metadata with deferred count semantics for title browse', async () => {
    const getByFilterAndSortStub = sinon.stub(Database.libraryItemModel, 'getByFilterAndSort').resolves({
      libraryItems: [{ id: 'item_1' }],
      count: 123,
      nextCursor: 'cursor-2',
      paginationMode: 'keyset',
      countMode: 'deferred-exact',
      isCountDeferred: true
    })
    const req = {
      query: { limit: '40', sort: 'media.metadata.title', minified: '1', cursor: 'cursor-1', pageMode: 'endless' },
      library: { id: 'lib_1', mediaType: 'book', isVirtual: false },
      user: { id: 'user_1' }
    }
    const res = { json: sinon.spy() }

    await LibraryController.getLibraryItems(req, res)

    expect(getByFilterAndSortStub.firstCall.args[2]).to.include({
      cursor: 'cursor-1',
      pageMode: 'endless'
    })
    expect(res.json.firstCall.args[0]).to.include({
      total: 123,
      cursor: 'cursor-1',
      pageMode: 'endless',
      nextCursor: 'cursor-2',
      paginationMode: 'keyset',
      isCountDeferred: true,
      countMode: 'deferred-exact'
    })
  })

  it('defaults pageMode to paged even when a cursor is present', async () => {
    const getByFilterAndSortStub = sinon.stub(Database.libraryItemModel, 'getByFilterAndSort').resolves({
      libraryItems: [],
      count: 0,
      nextCursor: null,
      paginationMode: 'offset',
      countMode: 'exact-on-initial-page',
      isCountDeferred: false
    })
    const req = {
      query: { limit: '40', sort: 'media.metadata.title', cursor: 'cursor-1' },
      library: { id: 'lib_1', mediaType: 'book', isVirtual: false },
      user: { id: 'user_1' }
    }
    const res = { json: sinon.spy() }

    await LibraryController.getLibraryItems(req, res)

    expect(getByFilterAndSortStub.firstCall.args[2]).to.include({
      cursor: 'cursor-1',
      pageMode: 'paged'
    })
    expect(res.json.firstCall.args[0]).to.include({
      cursor: 'cursor-1',
      pageMode: 'paged'
    })
  })

  it('forwards cursor, pageMode, and collapseseries through the real browse stack', async () => {
    const getFilteredLibraryItemsStub = sinon.stub(libraryFilters, 'getFilteredLibraryItems').resolves({
      libraryItems: [],
      count: 0,
      nextCursor: 'cursor-2',
      paginationMode: 'keyset',
      countMode: 'deferred-exact',
      isCountDeferred: true
    })

    await Database.libraryItemModel.getByFilterAndSort(
      { id: 'lib_1', mediaType: 'book' },
      { id: 'user_1' },
      {
        sortBy: 'media.metadata.title',
        limit: 40,
        offset: 0,
        cursor: 'cursor-1',
        pageMode: 'endless',
        include: [],
        collapseseries: true,
        mediaType: 'book'
      }
    )

    expect(getFilteredLibraryItemsStub.firstCall.args[2]).to.include({
      cursor: 'cursor-1',
      pageMode: 'endless',
      collapseseries: true
    })
  })
})
