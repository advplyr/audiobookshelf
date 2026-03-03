const { expect } = require('chai')
const sinon = require('sinon')

const Database = require('../../../../server/Database')
const Logger = require('../../../../server/Logger')
const libraryItemsBookFilters = require('../../../../server/utils/queries/libraryItemsBookFilters')

function createSequelizeStub(dialect, models) {
  return {
    getDialect: () => dialect,
    escape: (value) => `'${String(value).replace(/'/g, "''")}'`,
    random: () => ({ fn: 'random' }),
    models
  }
}

function createModelStubs() {
  return {
    book: {
      findAndCountAll: sinon.stub(),
      findAll: sinon.stub(),
      count: sinon.stub()
    },
    libraryItem: {},
    feed: {},
    bookSeries: {},
    series: {
      findAll: sinon.stub()
    },
    bookAuthor: {},
    author: {},
    mediaProgress: {},
    mediaItemShare: {}
  }
}

describe('libraryItemsBookFilters postgres query safety', () => {
  let originalSequelize
  let originalServerSettings
  let modelStubs

  beforeEach(() => {
    originalSequelize = Database.sequelize
    originalServerSettings = global.ServerSettings
    modelStubs = createModelStubs()
    global.ServerSettings = {
      sortingIgnorePrefix: false
    }
  })

  afterEach(() => {
    Database.sequelize = originalSequelize
    global.ServerSettings = originalServerSettings
    sinon.restore()
  })

  it('should avoid generating IN () when collapse-series has no include ids', async () => {
    Database.sequelize = createSequelizeStub('postgres', modelStubs)
    modelStubs.book.findAndCountAll.resolves({ rows: [], count: 0 })

    sinon.stub(libraryItemsBookFilters, 'getCollapseSeriesBooksToExclude').resolves({
      booksToExclude: [],
      bookSeriesToInclude: []
    })
    const debugStub = sinon.stub(Logger, 'debug')

    await libraryItemsBookFilters.getFilteredLibraryItems('library-1', { canAccessExplicitContent: true }, 'authors', 'author-1', 'media.metadata.publishedYear', true, true, [], 20, 0)

    const findOptions = modelStubs.book.findAndCountAll.firstCall.args[0]
    const displayTitleExpression = findOptions.attributes.include[0][0].val

    expect(displayTitleExpression).to.include('COALESCE(NULL, libraryItem.title)')
    expect(displayTitleExpression).to.not.include('IN ()')
    expect(debugStub.calledWithMatch('collapse-series produced no include IDs')).to.equal(true)
  })

  it('should escape collapse-series ids safely for postgres subquery', async () => {
    Database.sequelize = createSequelizeStub('postgres', modelStubs)
    modelStubs.book.findAndCountAll.resolves({ rows: [], count: 0 })

    sinon.stub(libraryItemsBookFilters, 'getCollapseSeriesBooksToExclude').resolves({
      booksToExclude: [],
      bookSeriesToInclude: [{ id: "series-id-'quoted'", numBooks: 2, libraryItemIds: [] }]
    })
    global.ServerSettings.sortingIgnorePrefix = true

    await libraryItemsBookFilters.getFilteredLibraryItems('library-1', { canAccessExplicitContent: true }, 'authors', 'author-1', 'media.metadata.title', false, true, [], 20, 0)

    const findOptions = modelStubs.book.findAndCountAll.firstCall.args[0]
    const displayTitleExpression = findOptions.attributes.include[0][0].val

    expect(displayTitleExpression).to.include("bs.id IN ('series-id-''quoted''')")
    expect(displayTitleExpression).to.include('libraryItem.titleIgnorePrefix')
  })

  it('should use postgres-safe join alias for sequence sorting', () => {
    Database.sequelize = createSequelizeStub('postgres', modelStubs)

    const order = libraryItemsBookFilters.getOrder('sequence', false, false)
    const expression = order[0][0].val

    expect(expression).to.include('"series->bookSeries"."sequence"')
    expect(expression).to.include('CASE WHEN BTRIM')
  })

  it('should log generated query when findAndCountAll fails', async () => {
    Database.sequelize = createSequelizeStub('postgres', modelStubs)
    modelStubs.book.findAndCountAll.rejects(new Error('boom'))
    const errorStub = sinon.stub(Logger, 'error')

    try {
      await libraryItemsBookFilters.getFilteredLibraryItems('library-1', { canAccessExplicitContent: true }, 'authors', 'author-1', 'media.metadata.publishedYear', true, false, [], 20, 0)
      expect.fail('Expected getFilteredLibraryItems to throw')
    } catch (error) {
      expect(error.message).to.equal('boom')
    }

    expect(errorStub.calledWithMatch('[LibraryItemsBookFilters] findAndCountAll failed: boom')).to.equal(true)
    expect(errorStub.calledWithMatch('[LibraryItemsBookFilters] findAndCountAll query:')).to.equal(true)
  })

  it('should use postgres-safe books->bookSeries alias in collapse-series selector query', async () => {
    Database.sequelize = createSequelizeStub('postgres', modelStubs)
    modelStubs.series.findAll.resolves([])

    await libraryItemsBookFilters.getCollapseSeriesBooksToExclude({ where: {}, include: [] }, null)

    const findAllOptions = modelStubs.series.findAll.firstCall.args[0]
    const orderExpression = findAllOptions.order[0].val

    expect(orderExpression).to.include('"books->bookSeries"."sequence"')
  })
})
