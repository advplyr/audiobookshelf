const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const LibraryController = require('../../../server/controllers/LibraryController')
const libraryFilters = require('../../../server/utils/queries/libraryFilters')
const { decodeBrowseCursor } = require('../../../server/utils/queries/libraryBrowseCursor')
const { getLibraryBrowseStrategy } = require('../../../server/utils/queries/libraryBrowseStrategy')
const libraryItemsBookFilters = require('../../../server/utils/queries/libraryItemsBookFilters')
const libraryItemsPodcastFilters = require('../../../server/utils/queries/libraryItemsPodcastFilters')

describe('LibraryController large-library browse contract', () => {
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
    expect(findAllStub.calledOnce).to.equal(true)
    expect(findAllStub.firstCall.args[0].limit).to.equal(20)
    expect(findAllStub.firstCall.args[0].offset || 0).to.equal(0)
  })

  it('applies the requested collapsed-series follow-up window in SQL query options', async () => {
    const findByPkStub = sinon.stub(Database.seriesModel, 'findByPk').resolves({ books: [] })
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
    expect(findAllStub.calledOnce).to.equal(true)
    expect(findAllStub.firstCall.args[0].limit).to.equal(20)
    expect(findAllStub.firstCall.args[0].offset).to.equal(20)
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
})
