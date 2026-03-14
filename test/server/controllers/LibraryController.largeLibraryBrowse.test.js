const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const LibraryController = require('../../../server/controllers/LibraryController')
const libraryFilters = require('../../../server/utils/queries/libraryFilters')
const libraryItemsBookFilters = require('../../../server/utils/queries/libraryItemsBookFilters')
const libraryItemsPodcastFilters = require('../../../server/utils/queries/libraryItemsPodcastFilters')

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

  it('forwards cursor and pageMode through LibraryItem.getByFilterAndSort into libraryFilters', async () => {
    const getFilteredLibraryItemsStub = sinon.stub(libraryFilters, 'getFilteredLibraryItems').resolves({
      libraryItems: [],
      count: 0,
      nextCursor: null,
      paginationMode: 'offset',
      countMode: 'exact-on-initial-page',
      isCountDeferred: false
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

  it('does not mutate caller-owned forwarded browse options in the podcast query helper', async () => {
    const forwardedBrowseOptions = { cursor: 'cursor-9' }
    sinon.stub(libraryItemsPodcastFilters, 'getMediaGroupQuery').returns({ mediaWhere: {}, replacements: {} })
    sinon.stub(libraryItemsPodcastFilters, 'getUserPermissionPodcastWhereQuery').returns({ podcastWhere: [], replacements: {} })
    sinon.stub(libraryItemsPodcastFilters, 'getOrder').returns([])
    sinon.stub(Database.podcastModel, 'findAndCountAll').resolves({ rows: [], count: 0 })

    await libraryItemsPodcastFilters.getFilteredLibraryItems(
      'lib_2',
      { id: 'user_2', canAccessExplicitContent: true, accessAllTags: true },
      null,
      null,
      'media.metadata.title',
      false,
      [],
      40,
      0,
      forwardedBrowseOptions
    )

    expect(forwardedBrowseOptions).to.deep.equal({ cursor: 'cursor-9' })
  })

  it('forwards cursor, pageMode, and collapseseries through libraryFilters into the book query helper', async () => {
    const getFilteredLibraryItemsStub = sinon.stub(libraryItemsBookFilters, 'getFilteredLibraryItems').resolves({
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

    expect(getFilteredLibraryItemsStub.firstCall.args[11]).to.deep.equal({
      cursor: 'cursor-1',
      pageMode: 'endless',
      collapseseries: true
    })
  })

  it('forwards cursor, pageMode, and collapseseries through libraryFilters into the podcast query helper', async () => {
    const getFilteredLibraryItemsStub = sinon.stub(libraryItemsPodcastFilters, 'getFilteredLibraryItems').resolves({
      libraryItems: [],
      count: 0,
      nextCursor: 'cursor-2',
      paginationMode: 'keyset',
      countMode: 'deferred-exact',
      isCountDeferred: true
    })

    await Database.libraryItemModel.getByFilterAndSort(
      { id: 'lib_2', mediaType: 'podcast' },
      { id: 'user_2' },
      {
        sortBy: 'media.metadata.title',
        limit: 40,
        offset: 0,
        cursor: 'cursor-9',
        pageMode: 'endless',
        include: [],
        collapseseries: false,
        mediaType: 'podcast'
      }
    )

    expect(getFilteredLibraryItemsStub.firstCall.args[9]).to.deep.equal({
      cursor: 'cursor-9',
      pageMode: 'endless',
      collapseseries: false
    })
  })
})
