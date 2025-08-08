import SortedCovers from '@/components/covers/SortedCovers.vue'
import DisplayCover from '@/components/covers/DisplayCover.vue'

describe('SortedCovers.vue', () => {
  const mockCovers = [
    { url: 'cover1.jpg', width: 400, height: 400 }, // square
    { url: 'cover2.jpg', width: 300, height: 450 }, // rectangle
    { url: 'cover3.jpg', width: 200, height: 200 }, // square (smaller)
    { url: 'cover4.jpg', width: 350, height: 500 } // rectangle
  ]

  const stubs = {
    'covers-display-cover': DisplayCover
  }

  describe('with bookCoverAspectRatio = 1 (square preferred)', () => {
    const mountOptions = {
      propsData: {
        covers: mockCovers,
        bookCoverAspectRatio: 1,
        selectedCover: ''
      },
      stubs
    }

    it('should render square covers in primary section', () => {
      cy.mount(SortedCovers, mountOptions)

      // The first section should contain the square covers
      cy.get('.flex.items-center.flex-wrap.justify-center')
        .first()
        .within(() => {
          // Should find 2 covers
          cy.get('.cursor-pointer').should('have.length', 2)
        })
    })

    it('should render rectangular covers in secondary section', () => {
      cy.mount(SortedCovers, mountOptions)

      // The second section should contain the rectangular covers
      cy.get('.flex.items-center.flex-wrap.justify-center')
        .eq(1)
        .within(() => {
          // Should find 2 covers
          cy.get('.cursor-pointer').should('have.length', 2)
        })
    })

    it('should show divider when both cover types exist', () => {
      cy.mount(SortedCovers, mountOptions)
      // Divider should be present
      cy.get('.border-b.border-white\\/10').should('exist')
    })
  })

  describe('with bookCoverAspectRatio = 0.6666 (rectangle preferred)', () => {
    const mountOptions = {
      propsData: {
        covers: mockCovers,
        bookCoverAspectRatio: 0.6666,
        selectedCover: ''
      },
      stubs
    }

    it('should render rectangular covers in primary section', () => {
      cy.mount(SortedCovers, mountOptions)

      // The first section should contain the rectangular covers
      cy.get('.flex.items-center.flex-wrap.justify-center')
        .first()
        .within(() => {
          // Should find 2 covers
          cy.get('.cursor-pointer').should('have.length', 2)
        })
    })
  })

  describe('cover type variations', () => {
    it('should not show divider with only square covers', () => {
      const onlySquareCovers = [
        { url: 'cover1.jpg', width: 400, height: 400 },
        { url: 'cover3.jpg', width: 200, height: 200 }
      ]
      cy.mount(SortedCovers, {
        propsData: {
          covers: onlySquareCovers,
          bookCoverAspectRatio: 1,
          selectedCover: ''
        },
        stubs
      })
      // Divider should not be present
      cy.get('&sortedCoversDivider').should('not.exist')
    })

    it('should not show divider with only rectangular covers', () => {
      const onlyRectCovers = [
        { url: 'cover2.jpg', width: 300, height: 450 },
        { url: 'cover4.jpg', width: 350, height: 500 }
      ]
      cy.mount(SortedCovers, {
        propsData: {
          covers: onlyRectCovers,
          bookCoverAspectRatio: 1,
          selectedCover: ''
        },
        stubs
      })
      // Divider should not be present
      cy.get('&sortedCoversDivider').should('not.exist')
    })
  })

  it('should emit select-cover event when cover is clicked', () => {
    cy.mount(SortedCovers, {
      propsData: {
        covers: mockCovers,
        bookCoverAspectRatio: 1, // square covers preferred and sorted first.
        selectedCover: ''
      },
      stubs
    })

    // Spy on the emit event
    const spy = cy.spy()
    cy.mount(SortedCovers, {
      propsData: { covers: mockCovers, bookCoverAspectRatio: 1 },
      stubs,
      listeners: {
        'select-cover': spy
      }
    })

    // Click the first cover and verify the event
    cy.get('.cursor-pointer')
      .first()
      .click()
      .then(() => {
        expect(spy).to.be.calledWith(mockCovers[2].url) // Currently the third cover is the smallest square cover and would be first in the list given the aspect ratio
      })
  })
})
