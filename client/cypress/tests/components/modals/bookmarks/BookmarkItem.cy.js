import BookmarkItem from '@/components/modals/bookmarks/BookmarkItem.vue'

describe('BookmarkItem', () => {
  const propsData = {
    bookmark: {
      libraryItemId: 'library-item-1',
      time: 3661,
      title: 'Chapter note'
    },
    highlight: false,
    playbackRate: 2
  }

  const stubs = {
    'ui-text-input': true,
    'ui-btn': true
  }

  it('renders bookmark timestamps from stored wall-clock time', () => {
    const mocks = {
      $secondsToTimestamp: (seconds) => {
        const totalSeconds = Math.floor(seconds)
        const hours = Math.floor(totalSeconds / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)
        const secs = totalSeconds % 60
        return [hours, minutes, secs].map((value) => String(value).padStart(2, '0')).join(':')
      },
      $axios: {
        $patch: cy.stub().resolves({})
      },
      $toast: {
        error: cy.stub()
      },
      $strings: {
        ToastFailedToUpdate: 'Failed to update'
      }
    }

    cy.mount(BookmarkItem, { propsData, mocks, stubs })

    cy.contains('01:01:01').should('be.visible')
    cy.contains('00:30:30').should('not.exist')
  })
})
