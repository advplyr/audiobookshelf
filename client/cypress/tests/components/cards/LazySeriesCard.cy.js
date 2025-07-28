import LazySeriesCard from '@/components/cards/LazySeriesCard.vue'
import GroupCover from '@/components/covers/GroupCover.vue'

describe('LazySeriesCard', () => {
  const series = {
    id: 1,
    name: 'The Lord of the Rings',
    nameIgnorePrefix: 'Lord of the Rings',
    books: [
      { id: 1, updatedAt: /* 04/14/2024 */ 1713099600000, addedAt: 1713099600000, media: { coverPath: 'cover1.jpg' }, title: 'The Fellowship of the Ring' },
      { id: 2, updatedAt: /* 04/15/2024 */ 1713186000000, addedAt: 1713186000000, media: { coverPath: 'cover2.jpg' }, title: 'The Two Towers' },
      { id: 3, updatedAt: /* 04/16/2024 */ 1713272400000, addedAt: 1713272400000, media: { coverPath: 'cover3.jpg' }, title: 'The Return of the King' }
    ],
    addedAt: /* 04/17/2024 */ 1713358800000,
    totalDuration: /* 7h 30m */ 3600 * 7 + 60 * 30,
    rssFeed: 'https://example.com/feed.rss'
  }

  const propsData = {
    index: 0,
    bookshelfView: 1,
    isCategorized: false,
    seriesMount: series,
    sortingIgnorePrefix: false,
    orderBy: 'addedAt'
  }

  const stubs = {
    'covers-group-cover': GroupCover
  }

  const mocks = {
    $getString: (id, args) => {
      switch (id) {
        case 'LabelAddedDate':
          return `Added ${args[0]}`
        default:
          return null
      }
    },
    $store: {
      getters: {
        getServerSetting: () => 'MM/dd/yyyy',
        'user/getUserCanUpdate': true,
        'user/getUserMediaProgress': (id) => null,
        'user/getSizeMultiplier': 1,
        'libraries/getBookCoverAspectRatio': 1,
        'libraries/getLibraryProvider': () => 'audible.us',
        'globals/getLibraryItemCoverSrc': () => 'https://my.server.com/book_placeholder.jpg'
      },
      state: {
        libraries: {
          currentLibraryId: 'library-123'
        },
        serverSettings: {
          dateFormat: 'MM/dd/yyyy'
        }
      }
    }
  }

  before(() => {
    cy.intercept('GET', 'https://my.server.com/book_placeholder.jpg', { fixture: 'images/book_placeholder.jpg' }).as('bookCover')
    cy.mount(LazySeriesCard, { propsData, stubs, mocks })
    cy.wait('@bookCover')
    // Now the placeholder image is in the browser cache
  })

  it('renders the component', () => {
    cy.mount(LazySeriesCard, { propsData, stubs, mocks })

    cy.get('&covers-area').should(($el) => {
      const width = $el.width()
      const height = $el.height()
      const defailtHeight = 192
      const defaultWidth = defailtHeight * 2
      expect(width).to.be.closeTo(defaultWidth, 0.01)
      expect(height).to.be.closeTo(defailtHeight, 0.01)
    })
    cy.get('&seriesLengthMarker').should('be.visible').and('have.text', propsData.seriesMount.books.length)
    cy.get('&seriesProgressBar').should('not.exist')
    cy.get('&hoveringDisplayTitle').should('be.hidden')
    cy.get('&rssFeedMarker').should('be.visible')
    cy.get('&standardBottomDisplayTitle').should('not.exist')
    cy.get('&detailBottomDisplayTitle').should('be.visible')
    cy.get('&detailBottomDisplayTitle').should('have.text', 'The Lord of the Rings')
    cy.get('&detailBottomSortLine').should('have.text', 'Added 04/17/2024')
  })

  it('shows series name and hides rss feed marker on mouseover', () => {
    cy.mount(LazySeriesCard, { propsData, stubs, mocks })
    cy.get('&card').trigger('mouseover')

    cy.get('&hoveringDisplayTitle').should('be.visible').should('have.text', 'The Lord of the Rings')
    cy.get('&rssFeedMarker').should('not.exist')
  })

  it('routes properly when clicked', () => {
    const updatedMocks = {
      ...mocks,
      $router: {
        push: cy.stub().as('routerPush')
      }
    }
    cy.mount(LazySeriesCard, { propsData, stubs, mocks: updatedMocks })
    cy.get('&card').click()

    cy.get('@routerPush').should('have.been.calledOnceWithExactly', '/library/library-123/series/1')
  })

  it('shows progress bar when progress is available', () => {
    const updatedMocks = {
      ...mocks,
      $store: {
        ...mocks.$store,
        getters: {
          ...mocks.$store.getters,
          'user/getUserMediaProgress': (id) => {
            switch (id) {
              case 1:
                return { isFinished: true }
              case 2:
                return { progress: 0.5 }
              default:
                return null
            }
          }
        }
      }
    }
    cy.mount(LazySeriesCard, { propsData, stubs, mocks: updatedMocks })

    cy.get('&seriesProgressBar')
      .should('be.visible')
      .and('have.class', 'bg-yellow-400')
      .and(($el) => {
        const width = $el.width()
        const defailtHeight = 192
        const defaultWidth = defailtHeight * 2
        expect(width).to.be.closeTo(((1 + 0.5) / 3) * defaultWidth, 0.01)
      })
  })

  it('shows full green progress bar when all books are finished', () => {
    const updatedMocks = {
      ...mocks,
      $store: {
        ...mocks.$store,
        getters: {
          ...mocks.$store.getters,
          'user/getUserMediaProgress': (id) => {
            return { isFinished: true }
          }
        }
      }
    }
    cy.mount(LazySeriesCard, { propsData, stubs, mocks: updatedMocks })

    cy.get('&seriesProgressBar')
      .should('be.visible')
      .and('have.class', 'bg-success')
      .and(($el) => {
        const width = $el.width()
        const defailtHeight = 192
        const defaultWidth = defailtHeight * 2
        expect(width).to.equal(defaultWidth)
      })
  })

  it('hides the rss feed marker when there is no rss feed', () => {
    const updatedPropsData = {
      ...propsData,
      seriesMount: { ...series, rssFeed: null }
    }
    cy.mount(LazySeriesCard, { propsData: updatedPropsData, stubs, mocks })

    cy.get('&rssFeedMarker').should('not.exist')
  })

  it('shows the standard bottom display when bookshelf view is 0', () => {
    const updatedPropsData = {
      ...propsData,
      bookshelfView: 0
    }
    cy.mount(LazySeriesCard, { propsData: updatedPropsData, stubs, mocks })

    cy.get('&standardBottomDisplayTitle').should('be.visible')
    cy.get('&detailBottomDisplayTitle').should('not.exist')
  })

  it('shows total duration in sort line when orderBy is totalDuration', () => {
    const updatedPropsData = {
      ...propsData,
      orderBy: 'totalDuration'
    }
    cy.mount(LazySeriesCard, { propsData: updatedPropsData, stubs, mocks })

    cy.get('&detailBottomSortLine').should('have.text', 'Duration 7h 30m')
  })

  it('shows last book updated date in sort line when orderBy is lastBookUpdated', () => {
    const updatedPropsData = {
      ...propsData,
      orderBy: 'lastBookUpdated'
    }
    cy.mount(LazySeriesCard, { propsData: updatedPropsData, stubs, mocks })

    cy.get('&detailBottomSortLine').should('have.text', 'Last Book Updated 04/16/2024')
  })

  it('shows last book added date in sort line when orderBy is lastBookAdded', () => {
    const updatedPropsData = {
      ...propsData,
      orderBy: 'lastBookAdded'
    }
    cy.mount(LazySeriesCard, { propsData: updatedPropsData, stubs, mocks })

    cy.get('&detailBottomSortLine').should('have.text', 'Last Book Added 04/16/2024')
  })

  it('shows nameIgnorePrefix when sortingIgnorePrefix is true', () => {
    const updatedPropsData = {
      ...propsData,
      sortingIgnorePrefix: true
    }
    cy.mount(LazySeriesCard, { propsData: updatedPropsData, stubs, mocks })

    cy.get('&detailBottomDisplayTitle').should('have.text', 'Lord of the Rings')
  })
})
