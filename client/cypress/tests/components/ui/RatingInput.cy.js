import RatingInput from '@/components/ui/RatingInput.vue'
import FlameIcon from '@/components/ui/FlameIcon.vue'

describe('<RatingInput />', () => {
  it('renders with initial value', () => {
    cy.mount(RatingInput, {
      propsData: {
        value: 3.5
      }
    })
    cy.get('.rating-input').should('be.visible')
    cy.get('.star-filled').should('have.length', 5)
    cy.get('span').should('contain.text', '3.5/5')
  })

  it('updates value on click', () => {
    const onInput = cy.spy().as('onInput')
    cy.mount(RatingInput, {
      propsData: {
        value: 0
      },
      listeners: {
        input: onInput
      }
    })

    cy.get('.star-container[data-star="4"]').click()
    cy.get('@onInput').should('have.been.calledWith', 4)
  })

  it('handles half-star clicks', () => {
    const onInput = cy.spy().as('onInput')
    cy.mount(RatingInput, {
      propsData: {
        value: 0
      },
      listeners: {
        input: onInput
      }
    })

    // Clicking on the left half of the 3rd star
    cy.get('.star-container[data-star="3"]').click('left')
    cy.get('@onInput').should('have.been.calledWith', 2.5)
  })

  it('shows hover value on mousemove', () => {
    cy.mount(RatingInput, {
      propsData: {
        value: 1
      }
    })

    cy.get('.star-container[data-star="5"]').trigger('mousemove', 'center')
    // After hover, the internal value should be 5, so the 5th star should be fully visible
    cy.get('.star-filled').last().should('have.css', 'clip-path', 'inset(0px)')
  })

  it('is readonly when prop is set', () => {
    const onInput = cy.spy().as('onInput')
    cy.mount(RatingInput, {
      propsData: {
        value: 2,
        readOnly: true
      },
      listeners: {
        input: onInput
      }
    })

    cy.get('.star-container[data-star="4"]').click()
    cy.get('@onInput').should('not.have.been.called')
  })

  it('renders flame icons when specified', () => {
    cy.mount(RatingInput, {
      propsData: {
        value: 4.5,
        icon: 'flame'
      },
      stubs: {
        'ui-flame-icon': FlameIcon
      }
    })

    cy.get('svg > path[d="M18.61,54.89C15.7,28.8,30.94,10.45,59.52,0C42.02,22.71,74.44,47.31,76.23,70.89 c4.19-7.15,6.57-16.69,7.04-29.45c21.43,33.62,3.66,88.57-43.5,80.67c-4.33-0.72-8.5-2.09-12.3-4.13C10.27,108.8,0,88.79,0,69.68 C0,57.5,5.21,46.63,11.95,37.99C12.85,46.45,14.77,52.76,18.61,54.89L18.61,54.89z"]').should('exist')
  })
})
