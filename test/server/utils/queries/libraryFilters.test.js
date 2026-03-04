const { expect } = require('chai')
const sinon = require('sinon')

const Logger = require('../../../../server/Logger')
const libraryFilters = require('../../../../server/utils/queries/libraryFilters')
const libraryItemsBookFilters = require('../../../../server/utils/queries/libraryItemsBookFilters')

describe('libraryFilters discover shelf resilience', () => {
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
