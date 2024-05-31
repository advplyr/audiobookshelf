// Import the necessary dependencies
import AuthorCard from '@/components/cards/AuthorCard.vue'
import AuthorImage from '@/components/covers/AuthorImage.vue'
import Tooltip from '@/components/ui/Tooltip.vue'
import LoadingSpinner from '@/components/widgets/LoadingSpinner.vue'

describe('AuthorCard', () => {
  const author = {
    id: 1,
    name: 'John Doe',
    numBooks: 5
  }

  const propsData = {
    author,
    width: 192 * 0.8,
    height: 192,
    sizeMultiplier: 1,
    nameBelow: false
  }

  const mocks = {
    $strings: {
      LabelBooks: 'Books',
      ButtonQuickMatch: 'Quick Match'
    },
    $store: {
      getters: {
        'user/getUserCanUpdate': true,
        'libraries/getLibraryProvider': () => 'audible.us'
      },
      state: {
        libraries: {
          currentLibraryId: 'library-123'
        }
      }
    },
    $eventBus: {
      $on: () => { },
      $off: () => { },
    },
  }

  const stubs = {
    'covers-author-image': AuthorImage,
    'ui-tooltip': Tooltip,
    'widgets-loading-spinner': LoadingSpinner
  }

  const mountOptions = { propsData, mocks, stubs }

  it('renders the component', () => {
    cy.mount(AuthorCard, mountOptions)

    cy.get('&textInline').should('be.visible')
    cy.get('&match').should('be.hidden')
    cy.get('&edit').should('be.hidden')
    cy.get('&nameBelow').should('be.hidden')
    cy.get('&card').should(($el) => {
      const width = $el.width()
      const height = $el.height()
      expect(width).to.be.closeTo(propsData.width, 0.01)
      expect(height).to.be.closeTo(propsData.height, 0.01)
    })
  })

  it('renders the component with the author name below', () => {
    const updatedPropsData = { ...propsData, nameBelow: true }
    cy.mount(AuthorCard, { ...mountOptions, propsData: updatedPropsData })

    cy.get('&textInline').should('be.hidden')
    cy.get('&match').should('be.hidden')
    cy.get('&edit').should('be.hidden')
    let nameBelowHeight
    cy.get('&nameBelow')
      .should('be.visible')
      .and('have.text', 'John Doe')
      .and(($el) => {
        const height = $el.height()
        const width = $el.width()
        const sizeMultiplier = propsData.sizeMultiplier
        const defaultFontSize = 16
        const defaultLineHeight = 1.5
        const fontSizeMultiplier = 0.75
        const px2 = 16
        expect(height).to.be.closeTo(defaultFontSize * fontSizeMultiplier * sizeMultiplier * defaultLineHeight, 0.01)
        nameBelowHeight = height
        expect(width).to.be.closeTo(propsData.width - px2, 0.01)
      })
    cy.get('&card').should(($el) => {
      const width = $el.width()
      const height = $el.height()
      const py1 = 8
      expect(width).to.be.closeTo(propsData.width, 0.01)
      expect(height).to.be.closeTo(propsData.height + nameBelowHeight + py1, 0.01)
    })
  })

  it('renders quick-match and edit buttons on mouse hover', () => {
    cy.mount(AuthorCard, mountOptions)

    // before mouseover
    cy.get('&match').should('be.hidden')
    cy.get('&edit').should('be.hidden')
    // after mouseover
    cy.get('&card').trigger('mouseover')
    cy.get('&match').should('be.visible')
    cy.get('&edit').should('be.visible')
    // after mouseleave
    cy.get('&card').trigger('mouseleave')
    cy.get('&match').should('be.hidden')
    cy.get('&edit').should('be.hidden')

  })

  it('renders the component with spinner while searching', () => {
    const data = () => { return { searching: true, isHovering: false } }
    cy.mount(AuthorCard, { ...mountOptions, data })

    cy.get('&textInline').should('be.hidden')
    cy.get('&match').should('be.hidden')
    cy.get('&edit').should('be.hidden')
    cy.get('&spinner').should('be.visible')
  })

  it('toasts after quick match with no updates', () => {
    const updatedMocks = {
      ...mocks,
      $axios: {
        $post: cy.stub().resolves({ updated: false, author: { name: 'John Doe' } })
      },
      $toast: {
        success: cy.spy().as('success'),
        error: cy.spy().as('error'),
        info: cy.spy().as('info')
      }
    }
    cy.mount(AuthorCard, { ...mountOptions, mocks: updatedMocks })
    cy.get('&card').trigger('mouseover')
    cy.get('&match').click()

    cy.get('&spinner').should('be.hidden')
    cy.get('@success').should('not.have.been.called')
    cy.get('@error').should('not.have.been.called')
    cy.get('@info').should('have.been.called')
  })

  it('toasts after quick match with updates and no image', () => {
    const updatedMocks = {
      ...mocks,
      $axios: {
        $post: cy.stub().resolves({ updated: true, author: { name: 'John Doe' } })
      },
      $toast: {
        success: cy.stub().as('success'),
        error: cy.spy().as('error'),
        info: cy.spy().as('info')
      }
    }
    cy.mount(AuthorCard, { ...mountOptions, mocks: updatedMocks })
    cy.get('&card').trigger('mouseover')
    cy.get('&match').click()

    cy.get('&spinner').should('be.hidden')
    cy.get('@success').should('have.been.calledOnceWithExactly', 'Author John Doe was updated (no image found)')
    cy.get('@error').should('not.have.been.called')
    cy.get('@info').should('not.have.been.called')
  })

  it('toasts after quick match with updates including image', () => {
    const updatedMocks = {
      ...mocks,
      $axios: {
        $post: cy.stub().resolves({ updated: true, author: { name: 'John Doe', imagePath: "path/to/image" } })
      },
      $toast: {
        success: cy.stub().as('success'),
        error: cy.spy().as('error'),
        info: cy.spy().as('info')
      }
    }
    cy.mount(AuthorCard, { ...mountOptions, mocks: updatedMocks })
    cy.get('&card').trigger('mouseover')
    cy.get('&match').click()

    cy.get('&spinner').should('be.hidden')
    cy.get('@success').should('have.been.calledOnceWithExactly', 'Author John Doe was updated')
    cy.get('@error').should('not.have.been.called')
    cy.get('@info').should('not.have.been.called')
  })
})