import ItemSlider from '@/components/widgets/ItemSlider.vue'
import NarratorCard from '@/components/cards/NarratorCard.vue'
import AuthorCard from '@/components/cards/AuthorCard.vue'

function createMountOptions(shelftype) {
  const items = {
    narrators: [
      { name: 'John Doe', numBooks: 5 },
      { name: 'Jane Doe', numBooks: 3 },
      { name: 'Jack Doe', numBooks: 1 },
      { name: 'Jill Doe', numBooks: 7 }
    ],
    authors: [
      { id: 1, name: 'John Doe', numBooks: 5 },
      { id: 2, name: 'Jane Doe', numBooks: 3 },
      { id: 3, name: 'Jack Doe', numBooks: 1 },
      { id: 4, name: 'Jill Doe', numBooks: 7 }
    ]
  }
  const propsData = {
    items: items[shelftype],
    shelfId: 'shelf-123',
    type: shelftype
  }
  const stubs = {
    'cards-narrator-card': NarratorCard,
    'cards-author-card': AuthorCard
  }
  const mocks = {
    $store: {
      getters: {
        'user/getUserCanUpdate': true,
        'user/getSizeMultiplier': 1,
        'globals/getIsBatchSelectingMediaItems': false
      },
      state: {
        libraries: {
          currentLibraryId: 'library-123'
        }
      }
    },
    $eventBus: {
      $on: () => {},
      $off: () => {}
    }
  }
  const slots = {
    default: `<p class="font-semibold text-gray-100">${shelftype}</p>`
  }

  return { propsData, stubs, mocks, slots }
}

describe('ItemSlider', () => {
  let mountOptions = null

  beforeEach(() => {})

  it('renders a narrators slider', () => {
    mountOptions = createMountOptions('narrators')
    cy.mount(ItemSlider, mountOptions)

    cy.get('&item').should('have.length', 4)
    cy.get('&leftScrollButton').should('be.visible').and('not.have.class', 'text-gray-300')
    cy.get('&rightScrollButton').should('be.visible').and('have.class', 'text-gray-300')
  })

  it('renders an authors slider', () => {
    mountOptions = createMountOptions('authors')
    cy.mount(ItemSlider, mountOptions)

    cy.get('&item').should('have.length', 4)
    cy.get('&leftScrollButton').should('be.visible').and('not.have.class', 'text-gray-300')
    cy.get('&rightScrollButton').should('be.visible').and('have.class', 'text-gray-300')
  })

  it('hides the scroll button when all items are visible', () => {
    mountOptions = createMountOptions('narrators')
    mountOptions.propsData.items = mountOptions.propsData.items.slice(0, 2)
    cy.mount(ItemSlider, mountOptions)

    cy.get('&leftScrollButton').should('not.exist')
    cy.get('&rightScrollButton').should('not.exist')
  })
})
