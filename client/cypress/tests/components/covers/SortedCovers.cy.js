import SortedCovers from '@/components/covers/SortedCovers.vue'
import DisplayCover from '@/components/covers/DisplayCover.vue'

describe('SortedCovers.vue', () => {
  const mockCovers = [
    // 3 rectangles, 4 squares
    { url: 'cover1.jpg', width: 400, height: 400 }, // middle square
    { url: 'cover2.jpg', width: 300, height: 450 }, // smallest rectangle
    { url: 'cover3.jpg', width: 200, height: 200 }, // smallest square
    { url: 'cover4.jpg', width: 350, height: 500 }, // middle rectangle
    { url: 'cover5.jpg', width: 500, height: 500 }, // largest square
    { url: 'cover6.jpg', width: 600, height: 800 }, // largest rectangle
    { url: 'cover7.jpg', width: 450, height: 450 } // middle2 square
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

    it('should correctly sort covers by size within their categories', () => {
      cy.mount(SortedCovers, mountOptions)

      // Check primary section (squares)
      cy.get('[cy-id="primaryCoversSectionContainer"] img')
        .eq(0) // First section
        .should('have.attr', 'src')
        .and('include', 'cover3.jpg') // Smallest square first
      cy.get('[cy-id="primaryCoversSectionContainer"] img')
        .eq(1) // First section
        .should('have.attr', 'src')
        .and('include', 'cover1.jpg') // Middle square second
      cy.get('[cy-id="primaryCoversSectionContainer"] img')
        .eq(2) // First section
        .should('have.attr', 'src')
        .and('include', 'cover7.jpg') // Middle2 square third
      cy.get('[cy-id="primaryCoversSectionContainer"] img')
        .eq(3) // First section
        .should('have.attr', 'src')
        .and('include', 'cover5.jpg') // Largest square last

      // Check secondary section (rectangles)
      cy.get('[cy-id="secondaryCoversSectionContainer"] img')
        .eq(0) // Second section
        .should('have.attr', 'src')
        .and('include', 'cover2.jpg') // Smallest rectangle first
      cy.get('[cy-id="secondaryCoversSectionContainer"] img')
        .eq(1) // Second section
        .should('have.attr', 'src')
        .and('include', 'cover4.jpg') // Middle rectangle second
      cy.get('[cy-id="secondaryCoversSectionContainer"] img')
        .eq(2) // Second section
        .should('have.attr', 'src')
        .and('include', 'cover6.jpg') // Largest rectangle last
    })

    it('should render square covers in primary section', () => {
      cy.mount(SortedCovers, mountOptions)

      // The first section should contain the square covers
      cy.get('.flex.items-center.flex-wrap.justify-center')
        .first()
        .within(() => {
          // Should find 3 covers
          cy.get('.cursor-pointer').should('have.length', 4)
        })
    })

    it('should render rectangular covers in secondary section', () => {
      cy.mount(SortedCovers, mountOptions)

      // The second section should contain the rectangular covers
      cy.get('.flex.items-center.flex-wrap.justify-center')
        .eq(1)
        .within(() => {
          // Should find 3 covers
          cy.get('.cursor-pointer').should('have.length', 3)
        })
    })

    it('should show divider when both cover types exist', () => {
      cy.mount(SortedCovers, mountOptions)
      // Divider should be present
      cy.get('&sortedCoversDivider').should('exist')
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
          // Should find 3 covers
          cy.get('.cursor-pointer').should('have.length', 3)
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
