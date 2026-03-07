const { expect } = require('chai')
const sinon = require('sinon')

const Logger = require('../../../../server/Logger')
const libraryFilters = require('../../../../server/utils/queries/libraryFilters')
const libraryItemsBookFilters = require('../../../../server/utils/queries/libraryItemsBookFilters')
const libraryItemsPodcastFilters = require('../../../../server/utils/queries/libraryItemsPodcastFilters')

describe('libraryFilters shelf resilience', () => {
  afterEach(() => {
    sinon.restore()
  })

  it('should return empty discover shelf when discover query fails', async () => {
    sinon.stub(libraryItemsBookFilters, 'getDiscoverLibraryItems').rejects(new Error('discover failed'))
    const errorStub = sinon.stub(Logger, 'error')

    const result = await libraryFilters.getLibraryItemsToDiscover({ mediaType: 'book', id: 'library-1' }, { id: 'user-1' }, [], 10)

    expect(result).to.deep.equal({ libraryItems: [], count: 0 })
    expect(errorStub.calledWithMatch('[LibraryFilters] Failed to load discover shelf for library "library-1"')).to.equal(true)
  })

  it('should return empty in-progress shelf when a query fails', async () => {
    sinon.stub(libraryItemsBookFilters, 'getFilteredLibraryItems').rejects(new Error('progress failed'))
    const errorStub = sinon.stub(Logger, 'error')

    const result = await libraryFilters.getMediaItemsInProgress({ isBook: true, id: 'library-1' }, { id: 'user-1' }, [], 10)

    expect(result).to.deep.equal({ items: [], count: 0 })
    expect(errorStub.calledWithMatch('[LibraryFilters] Failed to load in-progress shelf for library "library-1"')).to.equal(true)
  })

  it('should return empty continue-series shelf when a query fails', async () => {
    sinon.stub(libraryItemsBookFilters, 'getContinueSeriesLibraryItems').rejects(new Error('continue failed'))
    const errorStub = sinon.stub(Logger, 'error')

    const result = await libraryFilters.getLibraryItemsContinueSeries({ id: 'library-1' }, { id: 'user-1' }, [], 10)

    expect(result).to.deep.equal({ libraryItems: [], count: 0 })
    expect(errorStub.calledWithMatch('[LibraryFilters] Failed to load continue-series shelf for library "library-1"')).to.equal(true)
  })

  it('should return empty newest podcast episodes shelf when a query fails', async () => {
    sinon.stub(libraryItemsPodcastFilters, 'getFilteredPodcastEpisodes').rejects(new Error('podcast failed'))
    const errorStub = sinon.stub(Logger, 'error')

    const result = await libraryFilters.getNewestPodcastEpisodes({ mediaType: 'podcast', id: 'library-1' }, { id: 'user-1' }, 10)

    expect(result).to.deep.equal({ libraryItems: [], count: 0 })
    expect(errorStub.calledWithMatch('[LibraryFilters] Failed to load newest-podcast-episodes shelf for library "library-1"')).to.equal(true)
  })

  it('should keep discover shelf mapping behavior when query succeeds', async () => {
    const libraryItem = {
      toOldJSONMinified: () => ({ id: 'item-1' }),
      rssFeed: { toOldJSONMinified: () => ({ id: 'rss-1' }) },
      mediaItemShare: { id: 'share-1' }
    }
    sinon.stub(libraryItemsBookFilters, 'getDiscoverLibraryItems').resolves({
      libraryItems: [libraryItem],
      count: 1
    })

    const result = await libraryFilters.getLibraryItemsToDiscover({ mediaType: 'book', id: 'library-1' }, { id: 'user-1' }, [], 10)

    expect(result.count).to.equal(1)
    expect(result.libraryItems).to.deep.equal([
      {
        id: 'item-1',
        rssFeed: { id: 'rss-1' },
        mediaItemShare: { id: 'share-1' }
      }
    ])
  })
})
