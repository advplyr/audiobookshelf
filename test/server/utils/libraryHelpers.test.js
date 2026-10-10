const { expect } = require('chai')
const sinon = require('sinon')
const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')
const helpers = require('../../../server/utils/libraryHelpers')

describe('libraryHelpers compatibility', () => {
  let previousSettings
  let query
  let user
  let library

  function series(id, sequence, name = id) {
    return { id, name, bookSeries: { sequence } }
  }

  class Item {
    constructor(id, seriesEntries, duration = 10) {
      this.id = id
      this.mediaType = 'book'
      this.media = { title: id, titleIgnorePrefix: id, series: seriesEntries, duration }
    }

    toOldJSONMinified() {
      return { id: this.id, media: { duration: this.media.duration, metadata: { title: this.media.title, series: [] } }, extra: 'preserved' }
    }
  }

  function payload(overrides = {}) {
    return { page: 0, limit: 0, ...overrides }
  }

  function load(items) {
    query.resolves({ books: items.map((item) => {
      item.media.libraryItem = item
      return item.media
    }) })
  }

  function subseriesItems() {
    return [
      new Item('one', [series('parent', '1'), series('child', '2', 'The Cycle')]),
      new Item('two', [series('parent', '2'), series('child', '1', 'The Cycle')]),
      new Item('three', [series('parent', '3'), series('child', '3', 'The Cycle')]),
      new Item('four', [series('parent', '4')])
    ]
  }

  beforeEach(() => {
    previousSettings = global.ServerSettings
    global.ServerSettings = { sortingPrefixes: ['the', 'a'] }
    query = sinon.stub()
    sinon.stub(Database, 'seriesModel').value({ findByPk: query })
    sinon.stub(Database, 'serverSettings').value({ sortingIgnorePrefix: false })
    sinon.stub(Logger, 'warn')
    user = { checkCanAccessLibraryItem: sinon.stub().returns(true) }
    library = { settings: { hideSingleBookSeries: false } }
  })

  afterEach(() => {
    sinon.restore()
    global.ServerSettings = previousSettings
  })

  it('preserves the CommonJS export shape', () => {
    expect(Object.keys(helpers)).to.deep.equal(['getSeriesFromBooks', 'collapseBookSeries', 'handleCollapseSubseries'])
  })

  it('groups and naturally sorts series while preserving duration coercion and title prefixes', () => {
    const items = [
      new Item('ten', [series('cycle', '10', 'The Cycle')], '3.5'),
      new Item('two', [series('cycle', '2', 'The Cycle')], null),
      new Item('one', [series('cycle', '1', 'The Cycle')], NaN)
    ]
    const result = helpers.getSeriesFromBooks(items, null, false)
    expect(result).to.have.length(1)
    expect(result[0]).to.include({ id: 'cycle', nameIgnorePrefix: 'Cycle, The', nameIgnorePrefixSort: 'Cycle', totalDuration: 3.5, type: 'series' })
    expect(result[0].books.map((book) => book.id)).to.deep.equal(['one', 'two', 'ten'])
    expect(items[0]).not.to.have.property('sequence')
    expect(helpers.getSeriesFromBooks([items[0]], null, true)).to.deep.equal([])
  })

  it('clones collapsed representatives with their prototypes and retains ungrouped books', () => {
    const items = subseriesItems()
    const result = helpers.collapseBookSeries(items, 'parent', false)
    expect(result.map((item) => item.id)).to.deep.equal(['two', 'four'])
    expect(result[0]).to.be.instanceOf(Item)
    expect(result[0]).not.to.equal(items[1])
    expect(result[1]).to.equal(items[3])
    expect(result[0].collapsedSeries.books.map((book) => book.filterSeriesSequence)).to.deep.equal(['2', '1', '3'])
    expect(items[1]).not.to.have.property('collapsedSeries')
  })

  it('keeps missing filtered-series associations as errors', () => {
    expect(() => helpers.getSeriesFromBooks([new Item('one', [series('other', '1')])], 'missing', false)).to.throw(TypeError)
  })

  it('returns an empty result and clears invalid sorting when the series is missing', async () => {
    query.resolves(null)
    const options = payload({ sortBy: 'unsupported', total: 99 })
    expect(await helpers.handleCollapseSubseries(options, 'parent', user, library)).to.deep.equal([])
    expect(options).to.include({ total: 0, sortBy: undefined })
    expect(Logger.warn.calledOnce).to.equal(true)
    expect(query.firstCall.args[0]).to.equal('parent')
    expect(query.firstCall.args[1].include.include).to.have.length(3)
  })

  it('serializes collapsed series and consecutive parent sequence ranges', async () => {
    const items = subseriesItems()
    load(items)
    const options = payload()
    const result = await helpers.handleCollapseSubseries(options, 'parent', user, library)
    expect(result.map((item) => item.id)).to.deep.equal(['two', 'four'])
    expect(options.total).to.equal(2)
    expect(result[0].collapsedSeries).to.deep.equal({
      id: 'child', name: 'The Cycle', nameIgnorePrefix: 'Cycle, The',
      libraryItemIds: ['two', 'one', 'three'], numBooks: 3, seriesSequenceList: '1-3'
    })
    expect(result[0].media.metadata.series).to.deep.equal({ id: 'parent', name: 'parent', sequence: '2' })
    expect(result[0].extra).to.equal('preserved')
    expect(items.every((item) => !Object.hasOwn(item.media, 'libraryItem'))).to.equal(true)
  })

  it('retains separate books when collapsing would leave just one series', async () => {
    load(subseriesItems().slice(0, 3))
    const options = payload()
    const result = await helpers.handleCollapseSubseries(options, 'parent', user, library)
    expect(result.map((item) => item.id)).to.deep.equal(['one', 'two', 'three'])
    expect(result.every((item) => !item.collapsedSeries)).to.equal(true)
    expect(options.total).to.equal(3)
  })

  it('filters inaccessible books before grouping and counting', async () => {
    load(subseriesItems())
    user.checkCanAccessLibraryItem.callsFake((item) => item.id === 'four')
    const options = payload()
    const result = await helpers.handleCollapseSubseries(options, 'parent', user, library)
    expect(result.map((item) => item.id)).to.deep.equal(['four'])
    expect(options.total).to.equal(1)
  })

  it('preserves numeric and string pagination results', async () => {
    for (const [limit, expected] of [[2, ['3', '4']], ['2', ['3', '4', '5', '6']]]) {
      load(Array.from({ length: 6 }, (_, index) => new Item(String(index + 1), [series('parent', String(index + 1))])))
      const options = payload({ page: '1', limit })
      const result = await helpers.handleCollapseSubseries(options, 'parent', user, library)
      expect(result.map((item) => item.id)).to.deep.equal(expected)
      expect(options.total).to.equal(6)
    }
  })

  it('sorts nested fields and author names in the requested direction', async () => {
    for (const [sortBy, sortDesc, expected] of [
      ['media.duration', false, ['second', 'first']],
      ['media.duration', true, ['first', 'second']],
      ['media.metadata.authorName', false, ['second', 'first']],
      ['media.metadata.authorNameLF', false, ['first', 'second']]
    ]) {
      const first = new Item('first', [series('parent', '1')], 20)
      const second = new Item('second', [series('parent', '2')], 3)
      first.authorNamesFirstLast = 'Zulu'
      second.authorNamesFirstLast = 'Alpha'
      first.authorNamesLastFirst = 'Alpha'
      second.authorNamesLastFirst = 'Zulu'
      load([first, second])
      const result = await helpers.handleCollapseSubseries(payload({ sortBy, sortDesc }), 'parent', user, library)
      expect(result.map((item) => item.id)).to.deep.equal(expected)
    }
  })

  it('uses prefix-aware titles as a tie breaker for equal sequence values', async () => {
    Database.serverSettings.sortingIgnorePrefix = true
    const first = new Item('first', [series('parent', null)])
    first.media.title = 'The Alpha'
    first.media.titleIgnorePrefix = 'Alpha'
    const second = new Item('second', [series('parent', null)])
    second.media.title = 'Beta'
    second.media.titleIgnorePrefix = 'Beta'
    load([second, first])
    const result = await helpers.handleCollapseSubseries(payload(), 'parent', user, library)
    expect(result.map((item) => item.id)).to.deep.equal(['first', 'second'])
  })

  it('keeps decimal and non-numeric sequence labels in collapsed ranges', async () => {
    const items = subseriesItems()
    items[0].media.series[0].bookSeries.sequence = '1.5'
    items[1].media.series[0].bookSeries.sequence = '2.5'
    items[2].media.series[0].bookSeries.sequence = 'Bonus'
    load(items)
    const result = await helpers.handleCollapseSubseries(payload(), 'parent', user, library)
    const collapsed = result.find((item) => item.collapsedSeries)
    expect(collapsed.collapsedSeries.seriesSequenceList).to.equal('1.5-2.5, Bonus')
  })
})
