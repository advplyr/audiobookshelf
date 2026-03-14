const chai = require('chai')
const expect = chai.expect

const { getLibraryBrowseStrategy } = require('../../../server/utils/queries/libraryBrowseStrategy')

describe('libraryBrowseStrategy', () => {
  it('uses keyset pagination for title browse', () => {
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
})
