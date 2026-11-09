import Match from '@/components/modals/item/tabs/Match.vue'

describe('Match', () => {
  const libraryItem = {
    id: 'library-item-1',
    mediaType: 'audiobook',
    media: {
      duration: 7200,
      metadata: {
        title: 'Current Title',
        authorName: 'Current Author'
      }
    }
  }

  const propsData = {
    processing: false,
    libraryItem
  }

  const createMocks = () => ({
    $axios: {
      // Never resolves so the real search flow cannot overwrite the selection
      $get: cy.stub().callsFake(() => new Promise(() => {})).as('get'),
      $patch: cy.stub().as('patch').resolves({ updated: true })
    },
    $store: {
      getters: {
        'scanners/areProvidersLoaded': true,
        'scanners/checkBookProviderExists': () => true,
        'libraries/getBookCoverAspectRatio': 1
      },
      state: {
        scanners: {
          bookProviders: ['google', 'audiobookdb'],
          podcastProviders: ['itunes']
        },
        libraries: {
          filterData: {}
        }
      },
      dispatch: cy.stub()
    },
    $toast: {
      success: cy.spy().as('success'),
      info: cy.spy().as('info'),
      error: cy.spy().as('error'),
      warning: cy.spy()
    }
  })

  // Match.vue is a dense modal tab; stub its presentational children so the
  // component mounts and the submit path runs without a live backend.
  const stubs = {
    'cards-book-match-card': {
      template: `<div cy-id="result" @click="$emit('select', book)"><slot /></div>`,
      props: ['book']
    },
    'ui-checkbox': {
      template: `<label><input type="checkbox" :value="value" @change="$emit('input', $event.target.checked)">{{ label }}</label>`,
      props: { value: { default: null }, label: { type: String, default: '' } }
    },
    'ui-btn': {
      template: `<button :type="type || 'button'"><slot /></button>`,
      props: { type: { type: String, default: '' } }
    },
    'ui-text-input-with-label': {
      template: `<label>{{ label }}<input :value="value" :aria-label="label" @input="$emit('input', $event.target.value)" /></label>`,
      props: ['value', 'label', 'placeholder']
    },
    'ui-multi-select': { template: `<select />`, props: ['value', 'items'] },
    'ui-rich-text-editor': { template: `<textarea />`, props: ['value', 'label', 'disabled'] },
    'ui-dropdown': { template: `<select />`, props: ['value', 'items', 'label'] },
    'covers-preview-cover': { template: `<img />`, props: ['src', 'width'] },
    'widgets-series-input-widget': { template: `<input />`, props: ['value'] }
  }

  beforeEach(() => {
    localStorage.removeItem('selectedMatchUsage')
    localStorage.removeItem('book-provider')
  })

  it('uses the edited title instead of a stored ASIN after provider changes', () => {
    localStorage.setItem('book-provider', 'audiobookdb')
    const libraryItemWithAsin = {
      ...libraryItem,
      media: {
        ...libraryItem.media,
        metadata: { ...libraryItem.media.metadata, asin: 'B00B5HZGUG' }
      }
    }
    let componentInstance
    cy.mount(Match, {
      propsData: { ...propsData, libraryItem: libraryItemWithAsin },
      mocks: createMocks(),
      stubs
    }).then(({ component }) => {
      componentInstance = component
    })

    cy.get('input[aria-label="Search Title"]').clear().type('Different Title')
    cy.then(async () => {
      componentInstance.provider = 'google'
      await componentInstance.$nextTick()
      componentInstance.provider = 'audiobookdb'
      await componentInstance.$nextTick()
      expect(componentInstance.searchAsin).to.equal('')
    })

    cy.contains('button[type="submit"]', 'Search').click()
    cy.get('@get').should('have.been.calledTwice')
    cy.get('@get').then((getStub) => {
      const url = getStub.secondCall.args[0]
      expect(url).to.include('title=Different%20Title')
      expect(url).not.to.include('asin=')
    })
  })

  it('does not restore a stored ASIN after the user clears it and changes provider', () => {
    localStorage.setItem('book-provider', 'audiobookdb')
    const libraryItemWithAsin = {
      ...libraryItem,
      media: {
        ...libraryItem.media,
        metadata: { ...libraryItem.media.metadata, asin: 'B00B5HZGUG' }
      }
    }
    let componentInstance
    cy.mount(Match, {
      propsData: { ...propsData, libraryItem: libraryItemWithAsin },
      mocks: createMocks(),
      stubs
    }).then(({ component }) => {
      componentInstance = component
    })

    cy.get('input[aria-label="ASIN"]').should('have.value', 'B00B5HZGUG').clear()
    cy.then(async () => {
      componentInstance.provider = 'google'
      await componentInstance.$nextTick()
      componentInstance.provider = 'audiobookdb'
      await componentInstance.$nextTick()
      expect(componentInstance.searchAsin).to.equal('')
    })
  })

  it('retries the same search after a provider request fails', () => {
    const mocks = createMocks()
    mocks.$axios.$get
      .onFirstCall().resolves([])
      .onSecondCall().rejects({ response: { data: { error: 'Provider unavailable' } } })
      .onThirdCall().resolves([])

    let componentInstance
    cy.mount(Match, { propsData, mocks, stubs }).then(async ({ component }) => {
      componentInstance = component
      component.searchTitle = 'Retry title'
      await component.runSearch()
    })
    cy.contains('Provider unavailable').should('exist')
    cy.then(async () => {
      await componentInstance.runSearch()
    })

    cy.get('@get').should('have.been.calledThrice')
    cy.contains('Provider unavailable').should('not.exist')
  })

  it('includes explicit false in the update payload when the candidate has explicit false', () => {
    const candidate = { title: 'Matched Title', explicit: false }
    // Select the candidate through the component's normal selection method
    cy.mount(Match, { propsData, mocks: createMocks(), stubs }).then(({ component }) => {
      component.selectMatch(candidate)
    })

    // An explicit-false candidate renders the Explicit toggle
    cy.contains('label', 'Explicit').should('exist')

    cy.contains('button[type="submit"]', 'Submit').click()

    cy.get('@patch').should('have.been.calledOnceWith', '/api/items/library-item-1/media', {
      metadata: { title: 'Matched Title', explicit: false }
    })
    cy.get('@success').should('have.been.called')
    cy.get('@error').should('not.have.been.called')
  })

  it('omits the explicit metadata key when the candidate has no explicit value', () => {
    const candidate = { title: 'Matched Title' }
    cy.mount(Match, { propsData, mocks: createMocks(), stubs }).then(({ component }) => {
      component.selectMatch(candidate)
    })

    // A candidate without an explicit value does not render the Explicit toggle
    cy.contains('label', 'Explicit').should('not.exist')

    cy.contains('button[type="submit"]', 'Submit').click()

    cy.get('@patch').should('have.been.calledOnceWith', '/api/items/library-item-1/media', {
      metadata: { title: 'Matched Title' }
    })
    cy.get('@success').should('have.been.called')
    cy.get('@error').should('not.have.been.called')
  })
})
