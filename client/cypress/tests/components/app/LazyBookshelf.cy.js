import LazyBookshelf from '@/components/app/LazyBookshelf.vue'

describe('LazyBookshelf', () => {
  const createStore = () => ({
    getters: {
      'user/getIsAdminOrUp': true,
      'libraries/getCurrentLibraryMediaType': 'book',
      'libraries/getCurrentLibraryName': 'Library',
      'user/getUserSetting': (key) => {
        const settings = {
          orderBy: 'media.metadata.title',
          orderDesc: false,
          filterBy: 'all',
          collapseSeries: false,
          collapseBookSeries: false,
          seriesSortBy: 'name',
          seriesSortDesc: false,
          seriesFilterBy: 'all',
          authorSortBy: 'name',
          authorSortDesc: false
        }
        return settings[key]
      },
      'libraries/getBookCoverAspectRatio': 1.6,
      'getServerSetting': () => false,
      getBookshelfView: 'grid',
      'user/getSizeMultiplier': 1,
      'tasks/getRunningLibraryScanTask': () => null
    },
    state: {
      libraries: {
        currentLibraryId: 'lib-1'
      },
      globals: {
        selectedMediaItems: []
      },
      streamLibraryItem: null,
      lastBookshelfScrollData: {}
    },
    dispatch: cy.stub().resolves(),
    commit: cy.stub()
  })

  const mountBookshelf = (getStub, data = {}) => {
    return cy.mount(LazyBookshelf, {
      mocks: {
        $axios: { $get: getStub },
        $store: createStore(),
        $eventBus: { $on: () => {}, $off: () => {}, $emit: () => {} },
        $root: { socket: { on: () => {}, off: () => {} } },
        $route: { query: {} },
        $router: { push: cy.stub() },
        $toast: { error: cy.stub() },
        $getString: (key) => key,
        $encode: encodeURIComponent,
        $decode: decodeURIComponent
      },
      methods: {
        async setCardSize() {
          this.cardWidth = 120
          this.cardHeight = 180
          this.coverHeight = 160
        },
        mountEntityCard() {},
        initSizeData() {
          this.bookshelfHeight = 600
          this.bookshelfWidth = 600
          this.entitiesPerShelf = 1
          this.shelvesPerPage = 1
          this.booksPerFetch = 1
          this.bookshelfMarginLeft = 0
          this.currentBookWidth = this.bookWidth
          return false
        }
      },
      data() {
        return {
          initialPagesToLoad: 2,
          ...data
        }
      }
    })
  }

  it('uses the server cursor for mounted keyset follow-up chunks', () => {
    const requestUrls = []
    const getStub = cy.stub().callsFake((url) => {
      requestUrls.push(url)

      if (requestUrls.length === 1) {
        return Promise.resolve({
          results: [{ id: 'item-1', mediaType: 'book', media: { metadata: { title: 'Alpha' } } }],
          total: 4,
          nextCursor: 'cursor-1',
          paginationMode: 'keyset',
          isCountDeferred: true
        })
      }

      return Promise.resolve({
        results: [{ id: 'item-2', mediaType: 'book', media: { metadata: { title: 'Beta' } } }],
        total: 4,
        nextCursor: 'cursor-2',
        paginationMode: 'keyset',
        isCountDeferred: true
      })
    })

    mountBookshelf(getStub).then(({ wrapper }) => {
      cy.wrap(getStub).should('have.been.calledTwice').then(() => {
        expect(wrapper.vm.pagesLoaded[1]).to.be.ok
        expect(wrapper.vm.pageCursors[1]).to.equal('cursor-1')
        expect(wrapper.vm.paginationMode).to.equal('keyset')
        expect(wrapper.vm.isProgressiveLoading).to.equal(false)
        expect(requestUrls).to.have.length(2)
        expect(requestUrls[0]).to.include('page=0')
        expect(requestUrls[0]).to.not.include('cursor=')
        expect(requestUrls[1]).to.include('cursor=cursor-1')
        expect(requestUrls[1]).to.not.include('page=1')
      })
    })
  })

  it('retries a failed keyset follow-up chunk after the initial load recovers', () => {
    const getStub = cy.stub()

    getStub.onFirstCall().resolves({
      results: [{ id: 'item-1', mediaType: 'book', media: { metadata: { title: 'Alpha' } } }],
      total: 4,
      nextCursor: 'cursor-1',
      paginationMode: 'keyset',
      isCountDeferred: true
    })
    getStub.onSecondCall().resolves({
      total: 4,
      nextCursor: null,
      paginationMode: 'keyset',
      isCountDeferred: true
    })
    getStub.onThirdCall().resolves({
      results: [{ id: 'item-2', mediaType: 'book', media: { metadata: { title: 'Beta' } } }],
      total: 4,
      nextCursor: null,
      paginationMode: 'keyset',
      isCountDeferred: true
    })

    cy.spy(console, 'error').as('consoleError')

    mountBookshelf(getStub).then(({ wrapper }) => {
      cy.wrap(getStub).should('have.been.calledTwice')
      cy.get('@consoleError').should('have.been.called')
      cy.wrap(null)
        .then(() => {
          expect(wrapper.vm.pagesLoaded[1]).to.equal(undefined)
          return wrapper.vm.loadPage(1)
        })
        .then(() => {
          expect(getStub).to.have.been.calledThrice
          expect(wrapper.vm.entities[1].id).to.equal('item-2')
        })
      cy.wrap(null).then(() => {
        expect(wrapper.vm.isProgressiveLoading).to.equal(false)
        expect(wrapper.vm.progressiveLoadProgress).to.equal(100)
      })
    })
  })

  it('keeps offset fallback mode explicit and caps deep endless scroll', () => {
    const requestUrls = []
    const getStub = cy.stub().callsFake((url) => {
      requestUrls.push(url)

      return Promise.resolve({
        results: [{ id: `item-${requestUrls.length}`, mediaType: 'book', media: { metadata: { title: `Item ${requestUrls.length}` } } }],
        total: 10,
        nextCursor: null,
        paginationMode: 'offset',
        deepScrollAllowed: false
      })
    })

    mountBookshelf(getStub).then(({ wrapper }) => {
      cy.wrap(null)
        .then(() => wrapper.vm.loadPage(1))
        .then(() => wrapper.vm.loadPage(2))
        .then(() => wrapper.vm.loadPage(3))
        .then(() => {
          expect(wrapper.vm.paginationMode).to.equal('offset')
          expect(wrapper.vm.deepScrollBlocked).to.equal(true)
          expect(wrapper.vm.maxOffsetPages).to.equal(3)
          expect(requestUrls).to.have.length(3)
          expect(requestUrls.some((url) => url.includes('page=0'))).to.equal(true)
          expect(requestUrls.some((url) => url.includes('page=1'))).to.equal(true)
          expect(requestUrls.some((url) => url.includes('page=2'))).to.equal(true)
          expect(requestUrls.some((url) => url.includes('page=3'))).to.equal(false)
          expect(requestUrls.every((url) => !url.includes('cursor='))).to.equal(true)
        })
    })
  })
})
