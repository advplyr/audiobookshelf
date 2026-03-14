const chai = require('chai')
const expect = chai.expect

const { getLibraryBrowseStrategy } = require('../../../server/utils/queries/libraryBrowseStrategy')

describe('libraryBrowseStrategy', () => {
  afterEach(() => {
    delete global.ServerSettings
  })

  it('uses keyset pagination for title browse', () => {
    global.ServerSettings = { sortingIgnorePrefix: true }

    const strategy = getLibraryBrowseStrategy({
      mediaType: 'book',
      sortBy: 'media.metadata.title',
      filterGroup: null,
      pageMode: 'endless'
    })

    expect(strategy.paginationMode).to.equal('keyset')
    expect(strategy.countMode).to.equal('deferred-exact')
    expect(strategy.deepScrollAllowed).to.equal(true)
    expect(strategy.tieBreaker).to.equal('id')
    expect(strategy.cursorKeys).to.deep.equal(['titleIgnorePrefix', 'id'])
  })

  it('uses raw title cursor keys when prefix ignoring is disabled', () => {
    global.ServerSettings = { sortingIgnorePrefix: false }

    const strategy = getLibraryBrowseStrategy({
      mediaType: 'book',
      sortBy: 'media.metadata.title',
      filterGroup: null,
      pageMode: 'endless'
    })

    expect(strategy.paginationMode).to.equal('keyset')
    expect(strategy.cursorKeys).to.deep.equal(['title', 'id'])
  })

  it('falls back to offset for random sort', () => {
    const strategy = getLibraryBrowseStrategy({
      mediaType: 'book',
      sortBy: 'random',
      filterGroup: null,
      pageMode: 'endless'
    })

    expect(strategy.paginationMode).to.equal('offset')
    expect(strategy.deepScrollAllowed).to.equal(false)
  })

  it('uses keyset pagination for recently added browse', () => {
    const strategy = getLibraryBrowseStrategy({
      mediaType: 'book',
      sortBy: 'addedAt',
      filterGroup: 'recent',
      pageMode: 'endless'
    })

    expect(strategy.family).to.equal('recent-browse')
    expect(strategy.paginationMode).to.equal('keyset')
    expect(strategy.cursorKeys).to.deep.equal(['createdAt', 'id'])
  })

  it('uses keyset pagination for progress browse', () => {
    const strategy = getLibraryBrowseStrategy({
      mediaType: 'book',
      sortBy: 'progress',
      filterGroup: 'progress',
      pageMode: 'endless'
    })

    expect(strategy.family).to.equal('progress-browse')
    expect(strategy.paginationMode).to.equal('keyset')
    expect(strategy.cursorKeys).to.deep.equal(['mediaProgresses.updatedAt', 'id'])
  })

  it('uses keyset pagination for updated browse', () => {
    const strategy = getLibraryBrowseStrategy({
      mediaType: 'book',
      sortBy: 'updatedAt',
      filterGroup: null,
      pageMode: 'endless'
    })

    expect(strategy.family).to.equal('plain-browse')
    expect(strategy.paginationMode).to.equal('keyset')
    expect(strategy.cursorKeys).to.deep.equal(['updatedAt', 'id'])
  })

  it('uses keyset pagination for deterministic author browse', () => {
    global.ServerSettings = { sortingIgnorePrefix: true }

    const strategy = getLibraryBrowseStrategy({
      mediaType: 'book',
      sortBy: 'media.metadata.authorName',
      filterGroup: null,
      pageMode: 'endless'
    })

    expect(strategy.family).to.equal('author-browse')
    expect(strategy.paginationMode).to.equal('keyset')
    expect(strategy.cursorKeys).to.deep.equal(['authorNamesFirstLast', 'titleIgnorePrefix', 'id'])
  })

  it('uses keyset pagination for deterministic author last-first browse', () => {
    global.ServerSettings = { sortingIgnorePrefix: false }

    const strategy = getLibraryBrowseStrategy({
      mediaType: 'book',
      sortBy: 'media.metadata.authorNameLF',
      filterGroup: null,
      pageMode: 'endless'
    })

    expect(strategy.family).to.equal('author-browse')
    expect(strategy.paginationMode).to.equal('keyset')
    expect(strategy.cursorKeys).to.deep.equal(['authorNamesLastFirst', 'title', 'id'])
  })

  it('uses keyset pagination for progress created-at browse', () => {
    const strategy = getLibraryBrowseStrategy({
      mediaType: 'book',
      sortBy: 'progress.createdAt',
      filterGroup: 'progress',
      pageMode: 'endless'
    })

    expect(strategy.family).to.equal('progress-browse')
    expect(strategy.paginationMode).to.equal('keyset')
    expect(strategy.cursorKeys).to.deep.equal(['mediaProgresses.createdAt', 'id'])
  })

  it('uses keyset pagination for progress finished-at browse', () => {
    const strategy = getLibraryBrowseStrategy({
      mediaType: 'book',
      sortBy: 'progress.finishedAt',
      filterGroup: 'progress',
      pageMode: 'endless'
    })

    expect(strategy.family).to.equal('progress-browse')
    expect(strategy.paginationMode).to.equal('keyset')
    expect(strategy.cursorKeys).to.deep.equal(['mediaProgresses.finishedAt', 'id'])
  })

  it('defines a filtered browse family for generic library filters', () => {
    const strategy = getLibraryBrowseStrategy({
      mediaType: 'book',
      sortBy: 'media.metadata.title',
      filterGroup: 'tags',
      pageMode: 'endless'
    })

    expect(strategy.family).to.equal('filtered-browse')
  })

  it('defines a series browse family', () => {
    const strategy = getLibraryBrowseStrategy({
      mediaType: 'book',
      sortBy: 'sequence',
      filterGroup: 'series',
      pageMode: 'endless'
    })

    expect(strategy.family).to.equal('series-browse')
  })

  it('defines a collapsed-series browse family', () => {
    const strategy = getLibraryBrowseStrategy({
      mediaType: 'book',
      sortBy: 'sequence',
      filterGroup: 'series',
      pageMode: 'endless',
      collapseseries: true
    })

    expect(strategy.family).to.equal('collapsed-series-browse')
  })

  it('defines a podcast browse family', () => {
    const strategy = getLibraryBrowseStrategy({
      mediaType: 'podcast',
      sortBy: 'media.metadata.title',
      filterGroup: null,
      pageMode: 'endless'
    })

    expect(strategy.family).to.equal('podcast-browse')
  })

  it('falls back to offset for unsupported endless-scroll sorts', () => {
    const strategy = getLibraryBrowseStrategy({
      mediaType: 'book',
      sortBy: 'size',
      filterGroup: null,
      pageMode: 'endless'
    })

    expect(strategy.paginationMode).to.equal('offset')
    expect(strategy.cursorKeys).to.deep.equal([])
  })
})
