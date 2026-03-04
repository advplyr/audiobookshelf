const { expect } = require('chai')
const sinon = require('sinon')

const Database = require('../../../../server/Database')
const seriesFilters = require('../../../../server/utils/queries/seriesFilters')
const libraryItemsBookFilters = require('../../../../server/utils/queries/libraryItemsBookFilters')

function encodedFilter(group, value) {
  return `${group}.${encodeURIComponent(Buffer.from(value).toString('base64'))}`
}

describe('seriesFilters dialect behavior', () => {
  let originalSequelize
  let originalServerSettings
  let modelStubs

  function setDialect(dialect) {
    Database.sequelize = {
      getDialect: () => dialect,
      random: sinon.stub(),
      models: modelStubs
    }
  }

  beforeEach(() => {
    originalSequelize = Database.sequelize
    originalServerSettings = global.ServerSettings
    modelStubs = {
      series: {
        findAndCountAll: sinon.stub().resolves({ rows: [], count: 0 })
      },
      bookSeries: {},
      book: {},
      libraryItem: {},
      author: {},
      feed: {}
    }

    global.ServerSettings = { sortingIgnorePrefix: false }
    sinon.stub(libraryItemsBookFilters, 'getUserPermissionBookWhereQuery').returns({
      bookWhere: [],
      replacements: {}
    })
  })

  afterEach(() => {
    Database.sequelize = originalSequelize
    global.ServerSettings = originalServerSettings
    sinon.restore()
  })

  it('should build postgres progress filter with TRUE and FALSE literals', async () => {
    setDialect('postgres')

    await seriesFilters.getFilteredSeries(
      { id: 'library-1', settings: { hideSingleBookSeries: false } },
      { id: 'user-1', canAccessExplicitContent: true, permissions: { accessAllTags: true } },
      encodedFilter('progress', 'not-started'),
      'name',
      false,
      [],
      10,
      0
    )

    const findOptions = modelStubs.series.findAndCountAll.firstCall.args[0]
    const progressWhere = findOptions.where[1]

    expect(progressWhere.attribute.val).to.include('mp.isFinished = TRUE')
  })

  it('should build sqlite no-case name sort expression', async () => {
    setDialect('sqlite')

    await seriesFilters.getFilteredSeries(
      { id: 'library-1', settings: { hideSingleBookSeries: false } },
      { id: 'user-1', canAccessExplicitContent: true, permissions: { accessAllTags: true } },
      null,
      'name',
      false,
      [],
      10,
      0
    )

    const findOptions = modelStubs.series.findAndCountAll.firstCall.args[0]
    expect(findOptions.order[0][0].val).to.equal('series.name COLLATE NOCASE')
  })

  it('should build postgres lower-case name sort expression', async () => {
    setDialect('postgres')

    await seriesFilters.getFilteredSeries(
      { id: 'library-1', settings: { hideSingleBookSeries: false } },
      { id: 'user-1', canAccessExplicitContent: true, permissions: { accessAllTags: true } },
      null,
      'name',
      false,
      [],
      10,
      0
    )

    const findOptions = modelStubs.series.findAndCountAll.firstCall.args[0]
    expect(findOptions.order[0][0].val).to.equal('LOWER(series.name)')
  })
})
