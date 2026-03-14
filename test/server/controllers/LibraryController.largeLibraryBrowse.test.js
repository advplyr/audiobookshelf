const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const LibraryController = require('../../../server/controllers/LibraryController')
const Logger = require('../../../server/Logger')
const libraryFilters = require('../../../server/utils/queries/libraryFilters')
const { decodeBrowseCursor } = require('../../../server/utils/queries/libraryBrowseCursor')
const { getLibraryBrowseStrategy } = require('../../../server/utils/queries/libraryBrowseStrategy')
const { createBrowseRequestProfile, finishBrowseRequestProfile } = require('../../../server/utils/queries/libraryBrowseInstrumentation')
const libraryItemsBookFilters = require('../../../server/utils/queries/libraryItemsBookFilters')
const libraryItemsPodcastFilters = require('../../../server/utils/queries/libraryItemsPodcastFilters')
const libraryHelpers = require('../../../server/utils/libraryHelpers')

describe('LibraryController large-library browse contract', () => {
  const stubBookFilterDataRebuild = () => {
    sinon.stub(Database.bookModel, 'count').resolves(0)
    sinon.stub(Database.seriesModel, 'count').resolves(0)
    sinon.stub(Database.authorModel, 'count').resolves(0)
    sinon.stub(Database.bookModel, 'findAll').resolves([])
    sinon.stub(Database.seriesModel, 'findAll').resolves([])
    sinon.stub(Database.authorModel, 'findAll').resolves([])
    sinon.stub(Database.libraryItemModel, 'count').resolves(0)

    if (Database.genreModel) sinon.stub(Database.genreModel, 'findAll').resolves([])
    if (Database.tagModel) sinon.stub(Database.tagModel, 'findAll').resolves([])
    if (Database.narratorModel) sinon.stub(Database.narratorModel, 'findAll').resolves([])
  }

  const buildBookPredicateSql = (where, replacements = {}) => {
    const query = Database.sequelize.dialect.queryGenerator.selectQuery(
      Database.bookModel.getTableName(),
      {
        attributes: ['id'],
        where: Array.isArray(where) ? where : [where],
        replacements,
        model: Database.bookModel
      },
      Database.bookModel
    )

    return query.replace(/\s+/g, ' ')
  }

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.serverSettings = { sortingIgnorePrefix: false }
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
  })

  afterEach(async () => {
    delete process.env.QUERY_PROFILING
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
      isCountDeferred: true,
      deepScrollAllowed: true
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
      countMode: 'deferred-exact',
      deepScrollAllowed: true
    })
  })

  it('creates a browse profile for the live items endpoint and forwards it into the browse model call', async () => {
    const getByFilterAndSortStub = sinon.stub(Database.libraryItemModel, 'getByFilterAndSort').resolves({
      libraryItems: [],
      count: 0,
      nextCursor: null,
      paginationMode: 'offset',
      countMode: 'exact-on-initial-page',
      isCountDeferred: false,
      deepScrollAllowed: false
    })
    const req = {
      query: { limit: '20', sort: 'media.metadata.title', filter: 'recent', pageMode: 'endless' },
      library: { id: 'lib_1', mediaType: 'book', isVirtual: false },
      user: { id: 'user_1' }
    }
    const res = { json: sinon.spy() }

    await LibraryController.getLibraryItems(req, res)

    expect(getByFilterAndSortStub.firstCall.args[2].browseProfile).to.include({
      route: 'GET /api/libraries/:id/items',
      libraryId: 'lib_1'
    })
    expect(getByFilterAndSortStub.firstCall.args[2].browseProfile.mark).to.be.a('function')
  })

  it('records browse query timings for keyset browse queries when query profiling is enabled', async () => {
    process.env.QUERY_PROFILING = '1'
    global.ServerSettings = { sortingIgnorePrefix: true }

    const loggerInfoStub = sinon.stub(Logger, 'info')
    const countStub = sinon.stub(Database.bookModel, 'count').callsFake(async (findOptions) => {
      expect(findOptions.requestTiming).to.be.an('object')
      findOptions.logging('SELECT count(*)', 14)
      return 3
    })
    const findAllStub = sinon.stub(Database.bookModel, 'findAll').callsFake(async (findOptions) => {
      expect(findOptions.requestTiming).to.be.an('object')
      findOptions.logging('SELECT rows', 28)
      return [
        { id: 'book-1', title: 'Alpha', libraryItem: { id: 'item-1', titleIgnorePrefix: 'Alpha', dataValues: { titleIgnorePrefix: 'Alpha' } } },
        { id: 'book-2', title: 'Beta', libraryItem: { id: 'item-2', titleIgnorePrefix: 'Beta', dataValues: { titleIgnorePrefix: 'Beta' } } }
      ]
    })
    sinon.stub(Database.bookModel, 'findAndCountAll').resolves({ rows: [], count: 0 })

    const browseProfile = createBrowseRequestProfile({
      route: 'GET /api/libraries/:id/items',
      libraryId: 'lib_1'
    })

    const result = await libraryItemsBookFilters.getFilteredLibraryItems(
      'lib_1',
      { id: 'user_1', canAccessExplicitContent: true, accessAllTags: true },
      null,
      null,
      'media.metadata.title',
      false,
      false,
      [],
      1,
      0,
      false,
      { pageMode: 'endless', browseProfile }
    )

    const summary = finishBrowseRequestProfile(browseProfile, { slowMs: 0 })

    expect(result.paginationMode).to.equal('keyset')
    expect(findAllStub.calledOnce).to.equal(true)
    expect(countStub.calledOnce).to.equal(true)
    expect(summary.phases).to.have.property('rows')
    expect(summary.phases).to.have.property('count')
    expect(loggerInfoStub.called).to.equal(true)
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

  it('does not run exact count work or joined findAndCountAll again on follow-up keyset chunks', async () => {
    const countStub = sinon.stub(Database.bookModel, 'count').resolves(123)
    const findAllStub = sinon.stub(Database.bookModel, 'findAll').resolves([])
    const findAndCountAllStub = sinon.stub(Database.bookModel, 'findAndCountAll').resolves({ rows: [], count: 123 })

    const result = await libraryItemsBookFilters.getFilteredLibraryItems(
      'lib_1',
      { id: 'user_1', canAccessExplicitContent: true, accessAllTags: true },
      null,
      null,
      'media.metadata.title',
      false,
      false,
      [],
      40,
      0,
      false,
      { cursor: 'cursor-2', pageMode: 'endless' }
    )

    expect(result.count).to.equal(null)
    expect(findAllStub.calledOnce).to.equal(true)
    expect(countStub.called).to.equal(false)
    expect(findAndCountAllStub.called).to.equal(false)
  })

  it('falls back to offset mode for endless progress browse because null-aware keyset is unsupported', () => {
    const strategy = getLibraryBrowseStrategy({
      mediaType: 'book',
      sortBy: 'progress',
      filterGroup: 'progress',
      pageMode: 'endless'
    })

    expect(strategy.paginationMode).to.equal('offset')
    expect(strategy.countMode).to.equal('exact-on-initial-page')
    expect(strategy.deepScrollAllowed).to.equal(false)
  })

  it('falls back to offset mode for collapsed-series endless title browse because the SQL sort key differs', () => {
    global.ServerSettings = { sortingIgnorePrefix: true }

    const strategy = getLibraryBrowseStrategy({
      mediaType: 'book',
      sortBy: 'media.metadata.title',
      filterGroup: 'series',
      pageMode: 'endless',
      collapseseries: true
    })

    expect(strategy.paginationMode).to.equal('offset')
    expect(strategy.countMode).to.equal('exact-on-initial-page')
  })

  it('returns only the requested collapsed-series window without loading the full series graph', async () => {
    const findByPkStub = sinon.stub(Database.seriesModel, 'findByPk').resolves({ books: [] })
    const queryStub = sinon.stub(Database.sequelize, 'query')
    queryStub.onCall(0).resolves([{ rawBookCount: 0, plainRowCount: 0, collapsedRowCount: 0 }])
    queryStub.onCall(1).resolves([])
    const findAllStub = sinon.stub(Database.bookModel, 'findAll').resolves([])
    const req = {
      query: {
        filter: `series.${Buffer.from('series_1').toString('base64')}`,
        collapseseries: '1',
        limit: '20',
        sort: 'sequence'
      },
      library: { id: 'lib_1', mediaType: 'book', isVirtual: false, settings: {} },
      user: { id: 'user_1', checkCanAccessLibraryItem: () => true }
    }
    const res = { json: sinon.spy() }

    await LibraryController.getLibraryItems(req, res)

    expect(findByPkStub.called).to.equal(false)
    expect(queryStub.calledTwice).to.equal(true)
    expect(findAllStub.called).to.equal(false)
  })

  it('uses bounded batch query options for collapsed-series follow-up windows', async () => {
    const findByPkStub = sinon.stub(Database.seriesModel, 'findByPk').resolves({ books: [] })
    const queryStub = sinon.stub(Database.sequelize, 'query')
    queryStub.onCall(0).resolves([{ rawBookCount: 0, plainRowCount: 0, collapsedRowCount: 0 }])
    queryStub.onCall(1).resolves([])
    const findAllStub = sinon.stub(Database.bookModel, 'findAll').resolves([])
    const req = {
      query: {
        filter: `series.${Buffer.from('series_1').toString('base64')}`,
        collapseseries: '1',
        limit: '20',
        page: '1',
        sort: 'sequence',
        pageMode: 'paged'
      },
      library: { id: 'lib_1', mediaType: 'book', isVirtual: false, settings: {} },
      user: { id: 'user_1', checkCanAccessLibraryItem: () => true }
    }
    const res = { json: sinon.spy() }

    await LibraryController.getLibraryItems(req, res)

    expect(findByPkStub.called).to.equal(false)
    expect(queryStub.calledTwice).to.equal(true)
    expect(findAllStub.called).to.equal(false)
  })

  it('restores collapsed-series payload fields and preserves rssfeed serialization', async () => {
    const payload = await libraryHelpers.toCollapsedSeriesPayload([
      {
        media: {
          series: [{ id: 'series_1', name: 'Main Series', bookSeries: { sequence: '5' } }]
        },
        collapsedSeries: {
          id: 'subseries_1',
          name: 'Subseries',
          nameIgnorePrefix: 'Subseries',
          books: [
            { id: 'li_2', filterSeriesSequence: '2' },
            { id: 'li_3', filterSeriesSequence: '3' },
            { id: 'li_5', filterSeriesSequence: '5' }
          ]
        },
        rssFeed: {
          toOldJSONMinified: () => ({ id: 'feed_1' })
        },
        toOldJSONMinified() {
          return {
            id: 'li_1',
            media: { metadata: {} }
          }
        }
      }
    ], 'series_1')

    expect(payload[0].media.metadata.series).to.deep.equal({
      id: 'series_1',
      name: 'Main Series',
      sequence: '5'
    })
    expect(payload[0].collapsedSeries).to.deep.equal({
      id: 'subseries_1',
      name: 'Subseries',
      nameIgnorePrefix: 'Subseries',
      libraryItemIds: ['li_2', 'li_3', 'li_5'],
      numBooks: 3,
      seriesSequenceList: '2-3, 5'
    })
    expect(payload[0].rssFeed).to.deep.equal({ id: 'feed_1' })
  })

  it('uses a deterministic default collapsed-series order when sort is omitted', async () => {
    const queryStub = sinon.stub(Database.sequelize, 'query')
    queryStub.onCall(0).resolves([{ rawBookCount: 0, plainRowCount: 0, collapsedRowCount: 0 }])
    queryStub.onCall(1).resolves([])
    const findAllStub = sinon.stub(Database.bookModel, 'findAll').resolves([])

    await libraryItemsBookFilters.getCollapsedSeriesWindow(
      'lib_1',
      'series_1',
      { id: 'user_1', canAccessExplicitContent: true, accessAllTags: true },
      [],
      { sortBy: null, sortDesc: false },
      { limit: 20, offset: 0 }
    )

    expect(queryStub.calledTwice).to.equal(true)
    expect(findAllStub.called).to.equal(false)
    expect(queryStub.secondCall.args[0]).to.include('filterSequenceSort')
  })

  it('falls back to sequence-based collapsed browse ordering for unsupported sorts', async () => {
    const queryStub = sinon.stub(Database.sequelize, 'query')
    queryStub.onCall(0).resolves([{ rawBookCount: 0, plainRowCount: 0, collapsedRowCount: 0 }])
    queryStub.onCall(1).resolves([])
    const findAllStub = sinon.stub(Database.bookModel, 'findAll').resolves([])

    const req = {
      query: {
        filter: `series.${Buffer.from('series_1').toString('base64')}`,
        collapseseries: '1',
        limit: '20',
        sort: 'updatedAt',
        desc: '1'
      },
      library: { id: 'lib_1', mediaType: 'book', isVirtual: false, settings: {} },
      user: { id: 'user_1', checkCanAccessLibraryItem: () => true }
    }
    const res = { json: sinon.spy() }

    await LibraryController.getLibraryItems(req, res)

    expect(queryStub.calledTwice).to.equal(true)
    expect(findAllStub.called).to.equal(false)
    expect(queryStub.secondCall.args[0]).to.include('filterSequenceSort')
    expect(queryStub.secondCall.args[0]).to.not.include('updatedAt')
    expect(res.json.firstCall.args[0].sortBy).to.equal('sequence')
  })

  it('paginates collapsed-series browse by visible rows instead of raw books', async () => {
    const makeBook = ({ libraryItemId, filterSequence, subseriesId = null, subseriesName = null }) => ({
      libraryItem: {
        id: libraryItemId,
        mediaType: 'book',
        toOldJSONMinified() {
          return { id: libraryItemId, media: { metadata: {}, duration: 1 } }
        }
      },
      series: [
        { id: 'series_1', name: 'Main Series', nameIgnorePrefix: 'Main Series', bookSeries: { sequence: filterSequence } },
        ...(subseriesId ? [{ id: subseriesId, name: subseriesName, nameIgnorePrefix: subseriesName, bookSeries: { sequence: filterSequence } }] : [])
      ],
      bookAuthors: []
    })

    const queryStub = sinon.stub(Database.sequelize, 'query')
    queryStub.onCall(0).resolves([{ rawBookCount: 3, plainRowCount: 1, collapsedRowCount: 1 }])
    queryStub.onCall(1).resolves([{ rowType: 'plain', anchorBookId: 'book_3', anchorLibraryItemId: 'li_3', subseriesId: null }])
    const findAllStub = sinon.stub(Database.bookModel, 'findAll').resolves([
      makeBook({ libraryItemId: 'li_3', filterSequence: '3' })
    ])

    const req = {
      query: {
        filter: `series.${Buffer.from('series_1').toString('base64')}`,
        collapseseries: '1',
        limit: '1',
        page: '1',
        sort: 'sequence'
      },
      library: { id: 'lib_1', mediaType: 'book', isVirtual: false, settings: {} },
      user: { id: 'user_1', checkCanAccessLibraryItem: () => true }
    }
    const res = { json: sinon.spy() }

    await LibraryController.getLibraryItems(req, res)

    const response = res.json.firstCall.args[0]
    expect(queryStub.calledTwice).to.equal(true)
    expect(findAllStub.calledOnce).to.equal(true)
    expect(response.total).to.equal(2)
    expect(response.results).to.have.length(1)
    expect(response.results[0].id).to.equal('li_3')
    expect(response.results[0].collapsedSeries).to.equal(undefined)
  })

  it('keeps a sub-series collapsed on the first visible page instead of splitting it across raw-book windows', async () => {
    const makeBook = ({ libraryItemId, filterSequence, subseriesId = null, subseriesName = null }) => ({
      libraryItem: {
        id: libraryItemId,
        mediaType: 'book',
        toOldJSONMinified() {
          return { id: libraryItemId, media: { metadata: {}, duration: 1 } }
        }
      },
      series: [
        { id: 'series_1', name: 'Main Series', nameIgnorePrefix: 'Main Series', bookSeries: { sequence: filterSequence } },
        ...(subseriesId ? [{ id: subseriesId, name: subseriesName, nameIgnorePrefix: subseriesName, bookSeries: { sequence: filterSequence } }] : [])
      ],
      bookAuthors: []
    })

    const queryStub = sinon.stub(Database.sequelize, 'query')
    queryStub.onCall(0).resolves([{ rawBookCount: 3, plainRowCount: 1, collapsedRowCount: 1 }])
    queryStub.onCall(1).resolves([{ rowType: 'collapsed', anchorBookId: 'book_1', anchorLibraryItemId: 'li_1', subseriesId: 'sub_1' }])
    const findAllStub = sinon.stub(Database.bookModel, 'findAll').resolves([
      makeBook({ libraryItemId: 'li_1', filterSequence: '1', subseriesId: 'sub_1', subseriesName: 'Subseries 1' }),
      makeBook({ libraryItemId: 'li_2', filterSequence: '2', subseriesId: 'sub_1', subseriesName: 'Subseries 1' })
    ])

    const result = await libraryItemsBookFilters.getCollapsedSeriesWindow(
      'lib_1',
      'series_1',
      { id: 'user_1', canAccessExplicitContent: true, accessAllTags: true },
      [],
      { sortBy: 'sequence', sortDesc: false, hideSingleBookSeries: false },
      { limit: 1, offset: 0 }
    )

    expect(queryStub.calledTwice).to.equal(true)
    expect(findAllStub.calledOnce).to.equal(true)
    expect(result.count).to.equal(2)
    expect(result.libraryItems).to.have.length(1)
    expect(result.libraryItems[0].collapsedSeries).to.include({
      id: 'sub_1',
      name: 'Subseries 1'
    })
    expect(result.libraryItems[0].collapsedSeries.books.map((book) => book.id)).to.deep.equal(['li_1', 'li_2'])
  })

  it('uses bounded anchor queries instead of scanning the full filtered series for each page', async () => {
    const queryStub = sinon.stub(Database.sequelize, 'query')
    queryStub.onCall(0).resolves([[{ rawBookCount: 1000, plainRowCount: 400, collapsedRowCount: 200 }]])
    queryStub.onCall(1).resolves([[{ rowType: 'plain', anchorBookId: 'book_1', anchorLibraryItemId: 'li_1', subseriesId: null }]])

    const findAllStub = sinon.stub(Database.bookModel, 'findAll').resolves([
      {
        id: 'book_1',
        libraryItem: {
          id: 'li_1',
          mediaType: 'book',
          toOldJSONMinified() {
            return { id: 'li_1', media: { metadata: {} } }
          }
        },
        series: [{ id: 'series_1', name: 'Main Series', bookSeries: { sequence: '1' } }],
        bookAuthors: []
      }
    ])

    const result = await libraryItemsBookFilters.getCollapsedSeriesWindow(
      'lib_1',
      'series_1',
      { id: 'user_1', canAccessExplicitContent: true, accessAllTags: true },
      [],
      { sortBy: 'sequence', sortDesc: false, hideSingleBookSeries: false },
      { limit: 20, offset: 40 }
    )

    expect(queryStub.calledTwice).to.equal(true)
    expect(findAllStub.callCount).to.equal(1)
    expect(result.count).to.equal(600)
  })

  it('adds a deterministic libraryItem.id tie-breaker for keyset title browse with duplicate titles', async () => {
    global.ServerSettings = { sortingIgnorePrefix: true }

    const countStub = sinon.stub(Database.bookModel, 'count').resolves(123)
    const findAndCountAllStub = sinon.stub(Database.bookModel, 'findAndCountAll').resolves({ rows: [], count: 123 })
    const findAllStub = sinon.stub(Database.bookModel, 'findAll').resolves([
      { id: 'book-1', title: 'Alpha', libraryItem: { id: 'item-1', titleIgnorePrefix: 'Alpha', dataValues: { titleIgnorePrefix: 'Alpha' } } },
      { id: 'book-2', title: 'Alpha', libraryItem: { id: 'item-2', titleIgnorePrefix: 'Alpha', dataValues: { titleIgnorePrefix: 'Alpha' } } },
      { id: 'book-3', title: 'Beta', libraryItem: { id: 'item-3', titleIgnorePrefix: 'Beta', dataValues: { titleIgnorePrefix: 'Beta' } } }
    ])

    const result = await libraryItemsBookFilters.getFilteredLibraryItems(
      'lib_1',
      { id: 'user_1', canAccessExplicitContent: true, accessAllTags: true },
      null,
      null,
      'media.metadata.title',
      false,
      false,
      [],
      2,
      0,
      false,
      { pageMode: 'endless' }
    )

    expect(result.paginationMode).to.equal('keyset')
    expect(result.nextCursor).to.be.a('string')
    expect(findAllStub.firstCall.args[0].order[1][0].val || findAllStub.firstCall.args[0].order[1][0]).to.include('libraryItem')
    expect(findAllStub.firstCall.args[0].order[1][0].val || findAllStub.firstCall.args[0].order[1][0]).to.include('id')
    expect(countStub.calledOnce).to.equal(true)
    expect(findAndCountAllStub.called).to.equal(false)
  })

  it('encodes case-insensitive title cursor values to match the executed browse order', async () => {
    global.ServerSettings = { sortingIgnorePrefix: true }

    sinon.stub(Database.bookModel, 'count').resolves(123)
    sinon.stub(Database.bookModel, 'findAndCountAll').resolves({ rows: [], count: 123 })
    sinon.stub(Database.bookModel, 'findAll').resolves([
      { id: 'book-1', title: 'Alpha', libraryItem: { id: 'item-1', titleIgnorePrefix: 'Alpha', dataValues: { titleIgnorePrefix: 'Alpha' } } },
      { id: 'book-2', title: 'aLPHa', libraryItem: { id: 'item-2', titleIgnorePrefix: 'aLPHa', dataValues: { titleIgnorePrefix: 'aLPHa' } } },
      { id: 'book-3', title: 'Beta', libraryItem: { id: 'item-3', titleIgnorePrefix: 'Beta', dataValues: { titleIgnorePrefix: 'Beta' } } }
    ])

    const result = await libraryItemsBookFilters.getFilteredLibraryItems(
      'lib_1',
      { id: 'user_1', canAccessExplicitContent: true, accessAllTags: true },
      null,
      null,
      'media.metadata.title',
      false,
      false,
      [],
      2,
      0,
      false,
      { pageMode: 'endless' }
    )

    const decodedCursor = decodeBrowseCursor(result.nextCursor)

    expect(decodedCursor.values).to.deep.equal(['alpha', 'item-2'])
  })

  it('defaults omitted sort to deterministic title ordering for endless browse requests', async () => {
    global.ServerSettings = { sortingIgnorePrefix: true }

    const countStub = sinon.stub(Database.bookModel, 'count').resolves(10)
    const findAndCountAllStub = sinon.stub(Database.bookModel, 'findAndCountAll').resolves({ rows: [], count: 10 })
    const findAllStub = sinon.stub(Database.bookModel, 'findAll').resolves([
      { id: 'book-1', title: 'Alpha', libraryItem: { id: 'item-1', titleIgnorePrefix: 'Alpha', dataValues: { titleIgnorePrefix: 'Alpha' } } }
    ])

    const result = await libraryItemsBookFilters.getFilteredLibraryItems(
      'lib_1',
      { id: 'user_1', canAccessExplicitContent: true, accessAllTags: true },
      null,
      null,
      null,
      false,
      false,
      [],
      20,
      0,
      false,
      { pageMode: 'endless' }
    )

    expect(result.paginationMode).to.equal('keyset')
    expect(findAllStub.calledOnce).to.equal(true)
    expect(findAndCountAllStub.called).to.equal(false)
    expect(countStub.calledOnce).to.equal(true)
    expect(findAllStub.firstCall.args[0].order).to.have.length(2)
    expect(findAllStub.firstCall.args[0].order[0][0].val || findAllStub.firstCall.args[0].order[0][0]).to.include('titleIgnorePrefix')
    expect(findAllStub.firstCall.args[0].order[1][0].val || findAllStub.firstCall.args[0].order[1][0]).to.include('libraryItem')
    expect(findAllStub.firstCall.args[0].order[1][0].val || findAllStub.firstCall.args[0].order[1][0]).to.include('id')
  })

  it('uses offset fallback for progress browse requests with null-valued sort fields', async () => {
    const countStub = sinon.stub(Database.bookModel, 'count').resolves(123)
    const findAllStub = sinon.stub(Database.bookModel, 'findAll').resolves([])
    const findAndCountAllStub = sinon.stub(Database.bookModel, 'findAndCountAll').resolves({ rows: [], count: 7 })

    const result = await libraryItemsBookFilters.getFilteredLibraryItems(
      'lib_1',
      { id: 'user_1', canAccessExplicitContent: true, accessAllTags: true },
      'progress',
      'in-progress',
      'progress',
      true,
      false,
      [],
      20,
      0,
      false,
      { cursor: 'cursor-2', pageMode: 'endless' }
    )

    expect(result.paginationMode).to.equal('offset')
    expect(result.countMode).to.equal('exact-on-initial-page')
    expect(findAndCountAllStub.calledOnce).to.equal(true)
    expect(findAllStub.called).to.equal(false)
    expect(countStub.called).to.equal(false)
  })

  it('builds EXISTS predicates for browse filters and permission-tag checks instead of correlated count subqueries', () => {
    const positivePredicates = [
      libraryItemsBookFilters.getMediaGroupQuery('tags', 'Fantasy'),
      libraryItemsBookFilters.getMediaGroupQuery('genres', 'Fantasy'),
      libraryItemsBookFilters.getMediaGroupQuery('narrators', 'Jane Doe'),
      libraryItemsBookFilters.getMediaGroupQuery('tracks', 'multi'),
      libraryItemsBookFilters.getMediaGroupQuery('ebooks', 'ebook')
    ]
    const permissionQuery = libraryItemsBookFilters.getUserPermissionBookWhereQuery({
      canAccessExplicitContent: true,
      accessAllTags: false,
      itemTagsSelected: ['Fantasy'],
      selectedTagsNotAccessible: false
    })

    positivePredicates.forEach(({ mediaWhere, replacements }) => {
      const sql = buildBookPredicateSql(mediaWhere, replacements)
      expect(sql).to.include('EXISTS')
      expect(sql).to.not.include('count(*)')
    })

    const permissionSql = buildBookPredicateSql(permissionQuery.bookWhere, permissionQuery.replacements)
    expect(permissionSql).to.include('EXISTS')
    expect(permissionSql).to.not.include('count(*)')
  })

  it('builds NOT EXISTS predicates for negative browse filters and inaccessible-tag checks', () => {
    const negativePredicates = [
      libraryItemsBookFilters.getMediaGroupQuery('tracks', 'none'),
      libraryItemsBookFilters.getMediaGroupQuery('ebooks', 'no-ebook'),
      libraryItemsBookFilters.getMediaGroupQuery('missing', 'tags'),
      libraryItemsBookFilters.getMediaGroupQuery('missing', 'chapters')
    ]
    const permissionQuery = libraryItemsBookFilters.getUserPermissionBookWhereQuery({
      canAccessExplicitContent: true,
      accessAllTags: false,
      itemTagsSelected: ['Fantasy'],
      selectedTagsNotAccessible: true
    })

    negativePredicates.forEach(({ mediaWhere, replacements }) => {
      const sql = buildBookPredicateSql(mediaWhere, replacements)
      expect(sql).to.include('NOT EXISTS')
      expect(sql).to.not.include('count(*)')
    })

    const permissionSql = buildBookPredicateSql(permissionQuery.bookWhere, permissionQuery.replacements)
    expect(permissionSql).to.include('NOT EXISTS')
    expect(permissionSql).to.not.include('count(*)')
  })

  it('returns a fresh filter cache hit without querying the database again', async () => {
    Database.setLibraryFilterCache('lib_1', { authors: [] }, 60_000)
    const countStub = sinon.stub(Database.bookModel, 'count')

    const data = await libraryFilters.getFilterData('book', 'lib_1')

    expect(data.authors).to.deep.equal([])
    expect(countStub.called).to.equal(false)
  })

  it('rebuilds filter data after the TTL expires', async () => {
    Database.libraryFilterData.lib_1 = { authors: [], loadedAt: 1, expiresAt: 2 }
    stubBookFilterDataRebuild()

    await libraryFilters.getFilterData('book', 'lib_1')

    expect(Database.bookModel.count.called).to.equal(true)
  })

  it('refreshes an expired cache entry without rebuilding when cheap change checks show no changes', async () => {
    const clock = sinon.useFakeTimers({ now: 10_000 })
    Database.libraryFilterData.lib_1 = {
      authors: [{ id: 'au_1', name: 'Author 1' }],
      genres: [],
      tags: [],
      series: [{ id: 'se_1', name: 'Series 1' }],
      narrators: [],
      languages: [],
      publishers: [],
      publishedDecades: [],
      bookCount: 3,
      seriesCount: 1,
      authorCount: 1,
      podcastCount: 0,
      ebookCount: 0,
      numIssues: 0,
      loadedAt: 1_000,
      expiresAt: 2_000
    }

    sinon.stub(Database.bookModel, 'count')
      .onFirstCall().resolves(3)
      .onSecondCall().resolves(0)
    sinon.stub(Database.seriesModel, 'count')
      .onFirstCall().resolves(1)
      .onSecondCall().resolves(0)
    sinon.stub(Database.authorModel, 'count')
      .onFirstCall().resolves(1)
      .onSecondCall().resolves(0)
    const genresFindAllStub = Database.genreModel ? sinon.stub(Database.genreModel, 'findAll').resolves([]) : { called: false }
    const tagsFindAllStub = Database.tagModel ? sinon.stub(Database.tagModel, 'findAll').resolves([]) : { called: false }
    const narratorsFindAllStub = Database.narratorModel ? sinon.stub(Database.narratorModel, 'findAll').resolves([]) : { called: false }
    const booksFindAllStub = sinon.stub(Database.bookModel, 'findAll').resolves([])
    const seriesFindAllStub = sinon.stub(Database.seriesModel, 'findAll').resolves([])
    const authorsFindAllStub = sinon.stub(Database.authorModel, 'findAll').resolves([])

    const data = await libraryFilters.getFilterData('book', 'lib_1')

    expect(data.authors).to.deep.equal([{ id: 'au_1', name: 'Author 1' }])
    expect(genresFindAllStub.called).to.equal(false)
    expect(tagsFindAllStub.called).to.equal(false)
    expect(narratorsFindAllStub.called).to.equal(false)
    expect(booksFindAllStub.called).to.equal(false)
    expect(seriesFindAllStub.called).to.equal(false)
    expect(authorsFindAllStub.called).to.equal(false)
    expect(Database.libraryFilterData.lib_1.loadedAt).to.equal(clock.now)
    expect(Database.libraryFilterData.lib_1.expiresAt).to.equal(clock.now + Database.libraryFilterDataTtlMs)
  })

  it('invalidates filter cache when a library write path changes library content', async () => {
    Database.setLibraryFilterCache('lib_1', { authors: [] }, 60_000)
    sinon.stub(Database.libraryItemModel, 'findAll').resolves([
      {
        id: 'li_1',
        mediaId: 'book_1',
        media: {
          bookAuthors: [],
          bookSeries: []
        }
      }
    ])

    const req = {
      library: { id: 'lib_1', name: 'Lib', isPodcast: false },
      user: { isAdminOrUp: true },
      query: {}
    }
    const res = { json: sinon.spy(), sendStatus: sinon.spy() }
    const controllerContext = {
      handleDeleteLibraryItem: sinon.stub().resolves(),
      checkRemoveAuthorsWithNoBooks: sinon.stub().resolves(),
      checkRemoveEmptySeries: sinon.stub().resolves()
    }

    await LibraryController.removeLibraryItemsWithIssues.call(controllerContext, req, res)

    expect(Database.libraryFilterData.lib_1).to.equal(undefined)
  })
})
