import LazyBookshelf from '@/components/app/LazyBookshelf.vue'

describe('LazyBookshelf', () => {
  it('uses the server cursor for keyset follow-up chunks', () => {
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

    const store = {
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
    }

    cy.mount(LazyBookshelf, {
      mocks: {
        $axios: { $get: getStub },
        $store: store,
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
        initListeners() {}
      },
      data() {
        return {
          booksPerFetch: 1,
          entitiesPerShelf: 1,
          shelvesPerPage: 1
        }
      }
    }).then(async ({ wrapper }) => {
      await wrapper.vm.fetchEntites(0)
      await wrapper.vm.fetchEntites(1)

      expect(requestUrls).to.have.length(2)
      expect(requestUrls[0]).to.include('page=0')
      expect(requestUrls[0]).to.not.include('cursor=')
      expect(requestUrls[1]).to.include('cursor=cursor-1')
      expect(requestUrls[1]).to.not.include('page=1')
    })
  })
})
