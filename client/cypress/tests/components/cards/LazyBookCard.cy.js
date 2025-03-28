import LazyBookCard from '@/components/cards/LazyBookCard'
import Tooltip from '@/components/ui/Tooltip.vue'
import ExplicitIndicator from '@/components/widgets/ExplicitIndicator.vue'
import LoadingSpinner from '@/components/widgets/LoadingSpinner.vue'
import { Constants } from '@/plugins/constants'

function createMountOptions() {
  const book = {
    id: '1',
    libraryId: 'library-123',
    mediaType: 'book',
    media: {
      id: 'book1',
      metadata: { title: 'The Fellowship of the Ring', titleIgnorePrefix: 'Fellowship of the Ring', authorName: 'J. R. R. Tolkien', subtitle: 'The Lord of the Rings, Book 1' },
      numTracks: 1
    }
  }

  const propsData = {
    index: 0,
    bookMount: book,
    bookshelfView: Constants.BookshelfView.DETAIL,
    continueListeningShelf: false,
    filterBy: null,
    sortingIgnorePrefix: false,
    orderBy: null
  }

  const stubs = {
    'ui-tooltip': Tooltip,
    'widgets-explicit-indicator': ExplicitIndicator,
    'widgets-loading-spinner': LoadingSpinner
  }

  const mocks = {
    $config: {
      routerBasePath: 'https://my.server.com'
    },
    $store: {
      commit: () => {},
      getters: {
        'user/getUserCanUpdate': true,
        'user/getUserCanDelete': true,
        'user/getUserCanDownload': true,
        'user/getIsAdminOrUp': true,
        'user/getUserMediaProgress': (id) => null,
        'user/getUserSetting': (settingName) => false,
        'user/getSizeMultiplier': 1,
        'libraries/getLibraryProvider': () => 'audible.us',
        'libraries/getBookCoverAspectRatio': 1,
        'globals/getLibraryItemCoverSrc': () => 'https://my.server.com/book_placeholder.jpg',
        'globals/getPlaceholderCoverSrc': 'https://my.server.com/book_placeholder.jpg',
        getLibraryItemsStreaming: () => null,
        getIsMediaQueued: () => false,
        getIsStreamingFromDifferentLibrary: () => false
      },
      state: {
        libraries: {
          currentLibraryId: 'library-123'
        },
        processingBatch: false,
        serverSettings: {
          dateFormat: 'MM/dd/yyyy'
        }
      }
    }
  }

  return { propsData, stubs, mocks }
}

describe('LazyBookCard', () => {
  let mountOptions = null
  beforeEach(() => {
    mountOptions = createMountOptions()
  })

  before(() => {
    // Put placeholder image is in the browser cache
    mountOptions = createMountOptions()
    cy.intercept('https://my.server.com/book_placeholder.jpg', { fixture: 'images/book_placeholder.jpg' }).as('bookCover')
    cy.mount(LazyBookCard, mountOptions)
    cy.wait('@bookCover')

    // Put cover1 (aspect ratio 1.6) image in the browser cache
    mountOptions = createMountOptions()
    mountOptions.mocks.$store.getters['globals/getLibraryItemCoverSrc'] = () => 'https://my.server.com/cover1.jpg'
    cy.intercept('https://my.server.com/cover1.jpg', { fixture: 'images/cover1.jpg' }).as('bookCover1')
    cy.mount(LazyBookCard, mountOptions)
    cy.wait('@bookCover1')

    // Put cover2 (aspect ratio 1) image in the browser cache
    mountOptions = createMountOptions()
    mountOptions.mocks.$store.getters['globals/getLibraryItemCoverSrc'] = () => 'https://my.server.com/cover2.jpg'
    cy.intercept('https://my.server.com/cover2.jpg', { fixture: 'images/cover2.jpg' }).as('bookCover2')
    cy.mount(LazyBookCard, mountOptions)
    cy.wait('@bookCover2')
  })

  it('renders the component correctly', () => {
    cy.mount(LazyBookCard, mountOptions)

    cy.get('&titleImageNotReady').should('be.hidden')
    cy.get('&coverImage').should('have.css', 'opacity', '1')
    cy.get('&coverBg').should('be.hidden')
    cy.get('&overlay').should('be.hidden')
    cy.get('&detailBottom').should('be.visible')
    cy.get('&title').should('have.text', 'The Fellowship of the Ring')
    cy.get('&explicitIndicator').should('not.exist')
    cy.get('&line2').should('have.text', 'J. R. R. Tolkien')
    cy.get('&line3').should('not.exist')
    cy.get('seriesSequenceList').should('not.exist')
    cy.get('&booksInSeries').should('not.exist')
    cy.get('&placeholderTitle').should('be.visible')
    cy.get('&placeholderTitleText').should('have.text', 'The Fellowship of the Ring')
    cy.get('&placeholderAuthor').should('be.visible')
    cy.get('&placeholderAuthorText').should('have.text', 'J. R. R. Tolkien')
    cy.get('&progressBar').should('be.hidden')
    cy.get('&finishedProgressBar').should('not.exist')
    cy.get('&loadingSpinner').should('not.exist')
    cy.get('&seriesNameOverlay').should('not.exist')
    cy.get('&errorTooltip').should('not.exist')
    cy.get('&rssFeed').should('not.exist')
    cy.get('&seriesSequence').should('not.exist')
    cy.get('&podcastEpisdeNumber').should('not.exist')

    // this should actually fail, since the height does not cover
    // the detailBottom element, currently rendered outside the card's area,
    // and requires complex layout calculations outside of the component.
    // todo: fix the component to render the detailBottom element inside the card's area
    cy.get('#cover-area-0').should(($el) => {
      const width = $el.width()
      const height = $el.height()
      const defaultHeight = 192
      const defaultWidth = defaultHeight

      expect(width).to.be.closeTo(defaultWidth, 0.01)
      expect(height).to.be.closeTo(defaultHeight, 0.01)
    })
  })

  it('shows subtitle when showSubtitles settings is true', () => {
    mountOptions.mocks.$store.getters['user/getUserSetting'] = (settingName) => {
      if (settingName === 'showSubtitles') return true
    }
    cy.mount(LazyBookCard, mountOptions)

    cy.get('&titleImageNotReady').should('be.hidden')
    cy.get('&subtitle').should('be.visible').and('have.text', 'The Lord of the Rings, Book 1')
  })

  it('shows overlay on mouseover', () => {
    cy.mount(LazyBookCard, mountOptions)
    cy.get('#book-card-0').trigger('mouseover')

    cy.get('&titleImageNotReady').should('be.hidden')
    cy.get('&overlay').should('be.visible')
    cy.get('&playButton').should('be.visible')
    cy.get('&readButton').should('be.hidden')
    cy.get('&editButton').should('be.visible')
    cy.get('&selectedRadioButton').should('be.visible').and('have.text', 'radio_button_unchecked')
    cy.get('&moreButton').should('be.visible')
    cy.get('&ebookFormat').should('not.exist')
  })

  it('routes to item page when clicked', () => {
    mountOptions.mocks.$router = { push: cy.stub().as('routerPush') }
    cy.mount(LazyBookCard, mountOptions)
    cy.get('#book-card-0').click()

    cy.get('&titleImageNotReady').should('be.hidden')
    cy.get('@routerPush').should('have.been.calledOnceWithExactly', '/item/1')
  })

  it('shows titleImageNotReady and sets opacity 0 on coverImage when image not ready', () => {
    mountOptions.mocks.$store.getters['globals/getLibraryItemCoverSrc'] = () => 'https://my.server.com/notfound.jpg'
    cy.mount(LazyBookCard, mountOptions)

    cy.get('&titleImageNotReady').should('be.visible')
    cy.get('&coverImage').should('have.css', 'opacity', '0')
  })

  it('shows coverBg when coverImage has different aspect ratio', () => {
    mountOptions.mocks.$store.getters['globals/getLibraryItemCoverSrc'] = () => 'https://my.server.com/cover1.jpg'
    cy.mount(LazyBookCard, mountOptions)

    cy.get('&titleImageNotReady').should('be.hidden')
    cy.get('&coverBg').should('be.visible')
    cy.get('&coverImage').should('have.class', 'object-contain')
  })

  it('hides coverBg when coverImage has same aspect ratio', () => {
    mountOptions.mocks.$store.getters['globals/getLibraryItemCoverSrc'] = () => 'https://my.server.com/cover2.jpg'
    cy.mount(LazyBookCard, mountOptions)

    cy.get('&titleImageNotReady').should('be.hidden')
    cy.get('&coverBg').should('be.hidden')
    cy.get('&coverImage').should('have.class', 'object-fill')
  })

  // The logic for displaying placeholder title and author seems incorrect.
  // It is currently based on existence of coverPath, but should be based weater the actual cover image is placeholder or not.
  // todo: fix the logic to display placeholder title and author based on the actual cover image.
  it('hides placeholderTitle and placeholderAuthor when book has cover', () => {
    mountOptions.mocks.$store.getters['globals/getLibraryItemCoverSrc'] = () => 'https://my.server.com/cover1.jpg'
    mountOptions.propsData.bookMount.media.coverPath = 'cover1.jpg'
    cy.mount(LazyBookCard, mountOptions)

    cy.get('&titleImageNotReady').should('be.hidden')
    cy.get('&placeholderTitle').should('not.exist')
    cy.get('&placeholderAuthor').should('not.exist')
  })

  it('hides detailBottom when bookShelfView is STANDARD', () => {
    mountOptions.propsData.bookshelfView = Constants.BookshelfView.STANDARD
    cy.mount(LazyBookCard, mountOptions)

    cy.get('&titleImageNotReady').should('be.hidden')
    cy.get('&detailBottom').should('not.exist')
  })

  it('shows explicit indicator when book is explicit', () => {
    mountOptions.propsData.bookMount.media.metadata.explicit = true
    cy.mount(LazyBookCard, mountOptions)

    cy.get('&titleImageNotReady').should('be.hidden')
    cy.get('&explicitIndicator').should('be.visible')
  })

  describe('when collapsedSeries is present', () => {
    beforeEach(() => {
      mountOptions.propsData.bookMount.collapsedSeries = {
        id: 'series-123',
        name: 'The Lord of the Rings',
        nameIgnorePrefix: 'Lord of the Rings',
        numBooks: 3,
        libraryItemIds: ['1', '2', '3']
      }
    })

    it('shows the collpased series', () => {
      cy.mount(LazyBookCard, mountOptions)

      cy.get('&titleImageNotReady').should('be.hidden')
      cy.get('&seriesSequenceList').should('not.exist')
      cy.get('&booksInSeries').should('be.visible').and('have.text', '3')
      cy.get('&title').should('be.visible').and('have.text', 'The Lord of the Rings')
      cy.get('&line2').should('be.visible').and('have.text', '\u00a0')
      cy.get('&progressBar').should('be.hidden')
    })

    it('shows the seriesNameOverlay on mouseover', () => {
      mountOptions.propsData.bookMount.media.metadata.series = {
        id: 'series-456',
        name: 'Middle Earth Chronicles',
        sequence: 1
      }
      cy.mount(LazyBookCard, mountOptions)
      cy.get('#book-card-0').trigger('mouseover')

      cy.get('&titleImageNotReady').should('be.hidden')
      cy.get('&seriesNameOverlay').should('be.visible').and('have.text', 'The Lord of the Rings')
    })

    it('shows the seriesSequenceList when collapsed series has a sequence list', () => {
      mountOptions.propsData.bookMount.collapsedSeries.seriesSequenceList = '1-3'
      cy.mount(LazyBookCard, mountOptions)

      cy.get('&titleImageNotReady').should('be.hidden')
      cy.get('&seriesSequenceList').should('be.visible').and('have.text', '#1-3')
      cy.get('&booksInSeries').should('not.exist')
    })

    it('routes to the series page when clicked', () => {
      mountOptions.mocks.$router = { push: cy.stub().as('routerPush') }
      cy.mount(LazyBookCard, mountOptions)
      cy.get('#book-card-0').click()

      cy.get('&titleImageNotReady').should('be.hidden')
      cy.get('@routerPush').should('have.been.calledOnceWithExactly', '/library/library-123/series/series-123')
    })

    it('shows the series progress bar when series has progress', () => {
      mountOptions.mocks.$store.getters['user/getUserMediaProgress'] = (id) => {
        switch (id) {
          case '1':
            return { isFinished: true }
          case '2':
            return { progress: 0.5 }
          default:
            return null
        }
      }
      cy.mount(LazyBookCard, mountOptions)

      cy.get('&titleImageNotReady').should('be.hidden')
      cy.get('&progressBar')
        .should('be.visible')
        .and('have.class', 'bg-yellow-400')
        .and(($el) => {
          const width = $el.width()
          const defaultHeight = 192
          const defaultWidth = defaultHeight
          expect(width).to.be.closeTo(((1 + 0.5) / 3) * defaultWidth, 0.01)
        })
    })

    it('shows full green progress bar when all books are finished', () => {
      mountOptions.mocks.$store.getters['user/getUserMediaProgress'] = (id) => {
        return { isFinished: true }
      }
      cy.mount(LazyBookCard, mountOptions)

      cy.get('&titleImageNotReady').should('be.hidden')
      cy.get('&progressBar')
        .should('be.visible')
        .and('have.class', 'bg-success')
        .and(($el) => {
          const width = $el.width()
          const defaultHeight = 192
          const defaultWidth = defaultHeight
          expect(width).to.be.equal(defaultWidth)
        })
    })
  })
})
