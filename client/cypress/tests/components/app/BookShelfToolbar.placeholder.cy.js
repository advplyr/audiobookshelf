import BookShelfToolbar from '@/components/app/BookShelfToolbar.vue'
import ContextMenuDropdown from '@/components/ui/ContextMenuDropdown.vue'

describe('BookShelfToolbar placeholder flow', () => {
  const libraryItem = {
    id: 'item-1',
    libraryId: 'library-123',
    mediaType: 'book',
    isPlaceholder: true,
    media: {
      metadata: {
        title: 'Placeholder Title',
        authorName: 'Placeholder Author'
      }
    }
  }

  const baseSelectedSeries = {
    id: 'series-1',
    name: 'Series Name',
    progress: {
      libraryItemIds: ['item-1'],
      isFinished: false
    },
    rssFeed: null
  }

  const stubs = {
    'ui-context-menu-dropdown': ContextMenuDropdown
  }

  const createMountOptions = (overrides = {}) => {
    const mocks = {
      $strings: {
        ButtonAddPlaceholder: 'Add Placeholder',
        ToastPlaceholderCreated: 'Placeholder created',
        ToastPlaceholderCreateFailed: 'Placeholder create failed',
        LabelPlaceholderDefaultTitle: 'Placeholder',
        LabelOpenRSSFeed: 'Open RSS Feed',
        MessageMarkAsNotFinished: 'Mark as not finished',
        MessageMarkAsFinished: 'Mark as finished',
        LabelReAddSeriesToContinueListening: 'Re-add to continue listening',
        LabelShowSubtitles: 'Show subtitles',
        LabelHideSubtitles: 'Hide subtitles',
        LabelExpandSubSeries: 'Expand sub-series',
        LabelCollapseSubSeries: 'Collapse sub-series',
        LabelExpandSeries: 'Expand series',
        LabelCollapseSeries: 'Collapse series',
        ButtonLibrary: 'Library',
        ButtonHome: 'Home',
        ButtonSeries: 'Series',
        ButtonPlaylists: 'Playlists',
        ButtonCollections: 'Collections',
        ButtonAuthors: 'Authors',
        ButtonAdd: 'Add',
        ButtonLatest: 'Latest',
        ButtonDownloadQueue: 'Download Queue',
        LabelPodcasts: 'Podcasts',
        LabelBooks: 'Books',
        LabelSeries: 'Series',
        LabelCollections: 'Collections',
        LabelPlaylists: 'Playlists',
        LabelAuthors: 'Authors'
      },
      $axios: {
        $post: cy.stub().resolves(libraryItem)
      },
      $toast: {
        success: cy.stub().as('toastSuccess'),
        error: cy.stub().as('toastError')
      },
      $router: {
        push: cy.stub().as('routerPush')
      },
      $eventBus: {
        $emit: cy.stub().as('eventEmit')
      },
      $store: {
        commit: cy.stub().as('storeCommit'),
        dispatch: cy.stub().as('storeDispatch'),
        getters: {
          'user/getIsAdminOrUp': true,
          'user/getUserCanDelete': true,
          'user/getUserCanUpdate': true,
          'user/getUserCanDownload': true,
          'globals/getIsBatchSelectingMediaItems': false,
          'libraries/getLibraryProvider': () => 'audible.us',
          'libraries/getCurrentLibraryMediaType': 'book',
          'user/getUserSetting': () => 'all',
          'user/getIsSeriesRemovedFromContinueListening': () => false
        },
        state: {
          libraries: {
            currentLibraryId: 'library-123',
            numUserPlaylists: 0
          },
          user: {
            settings: {
              showSubtitles: false,
              collapseSeries: false,
              collapseBookSeries: false,
              filterBy: 'all',
              orderBy: 'addedAt',
              orderDesc: false,
              seriesFilterBy: 'all',
              seriesSortBy: 'addedAt',
              seriesSortDesc: false,
              authorSortBy: 'name',
              authorSortDesc: false
            }
          }
        }
      },
      $route: {
        name: 'library-library',
        query: {}
      }
    }

    return {
      propsData: {
        page: 'series',
        isHome: false,
        selectedSeries: baseSelectedSeries
      },
      stubs,
      mocks,
      ...overrides
    }
  }

  it('creates a placeholder and refreshes the series shelf', () => {
    const mountOptions = createMountOptions()
    cy.mount(BookShelfToolbar, mountOptions)

    cy.get('button[aria-haspopup="menu"]').click()
    cy.contains('button[role="menuitem"]', 'Add Placeholder').click()

    cy.get('@toastSuccess').should('have.been.calledOnce')
    cy.get('@storeCommit').should('have.been.calledWith', 'setBookshelfBookIds', [])
    cy.get('@storeCommit').should('have.been.calledWith', 'showEditModal', libraryItem)
    cy.get('@eventEmit').should('have.been.calledWith', 'series-bookshelf-refresh', { seriesId: baseSelectedSeries.id })
    cy.wrap(mountOptions.mocks.$axios.$post).should('have.been.calledWith', '/api/libraries/library-123/series/series-1/placeholders', {
      title: 'Placeholder'
    })
  })
})
