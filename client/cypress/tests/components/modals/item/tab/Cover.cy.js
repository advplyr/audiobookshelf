import Cover from '@/components/modals/item/tabs/Cover.vue'
import PreviewCover from '@/components/covers/PreviewCover.vue'
import SortedCovers from '@/components/covers/SortedCovers.vue'
import Btn from '@/components/ui/Btn.vue'
import FileInput from '@/components/ui/FileInput.vue'
import TextareaInput from '@/components/ui/TextareaInput.vue'
import Tooltip from '@/components/ui/Tooltip.vue'
import Dropdown from '@/components/ui/Dropdown.vue'
import TextInputWithLabel from '@/components/ui/TextInputWithLabel.vue'

const sinon = Cypress.sinon

describe('Cover.vue', () => {
  const propsData = {
    processing: false,
    libraryItem: {
      id: 'item-1',
      media: {
        coverPath: 'client\\cypress\\fixtures\\images\\cover1.jpg',
        metadata: { title: 'Test Book', authorName: 'Test Author' }
      },
      mediaType: 'book',
      libraryFiles: [
        {
          ino: '649644248522215267',
          metadata: {
            filename: 'cover1.jpg',
            ext: '.jpg',
            path: 'client\\cypress\\fixtures\\images\\cover1.jpg',
            relPath: 'cover1.jpg',
            size: 325531,
            mtimeMs: 1638754803540,
            ctimeMs: 1645978261003,
            birthtimeMs: 0
          },
          addedAt: 1650621052495,
          updatedAt: 1650621052495,
          fileType: 'image'
        }
      ]
    },
    coversFound: [],
    coverPath: 'client\\cypress\\fixtures\\images\\cover1.jpg'
  }

  const mocks = {
    $strings: {
      ButtonSearch: 'Search',
      MessageNoCoversFound: 'No covers found',
      HeaderPreviewCover: 'Preview Cover',
      ButtonReset: 'Reset',
      ButtonUpload: 'Upload',
      ToastInvalidUrl: 'Invalid URL',
      ToastCoverUpdateFailed: 'Cover update failed',
      LabelSearchTitle: 'Title',
      LabelSearchTerm: 'Search term',
      LabelSearchTitleOrASIN: 'Title or ASIN'
    },
    $store: {
      getters: {
        'globals/getPlaceholderCoverSrc': 'placeholder.jpg',
        'globals/getLibraryItemCoverSrcById': () => 'cover.jpg',
        'libraries/getBookCoverAspectRatio': 1,
        'user/getUserCanUpload': true,
        'user/getUserCanDelete': true,
        'user/getUserToken': 'token',
        'scanners/providers': ['google'],
        'scanners/coverOnlyProviders': [],
        'scanners/podcastProviders': []
      },
      state: {
        libraries: {
          currentLibraryId: 'library-123'
        },
        scanners: {
          providers: ['google'],
          coverOnlyProviders: [],
          podcastProviders: []
        }
      }
    },
    $eventBus: {
      $on: () => {},
      $off: () => {}
    }
  }

  const stubs = {
    'covers-preview-cover': PreviewCover,
    'covers-sorted-covers': SortedCovers,
    'ui-btn': Btn,
    'ui-file-input': FileInput,
    'ui-text-input': TextareaInput,
    'ui-tooltip': Tooltip,
    'ui-dropdown': Dropdown,
    'ui-text-input-with-label': TextInputWithLabel
  }

  const mountOptions = {
    propsData,
    mocks,
    stubs
  }

  it('should render the default component', () => {
    // Pre-searched state

    cy.mount(Cover, mountOptions)

    cy.get('&currentBookCover').should('exist')

    cy.get('&uploadCoverAndLocalImages').should('exist')
    cy.get('&uploadCoverForm').should('exist')
    cy.get('&uploadCoverBtn').should('exist')

    cy.get('&localImagesContainer').should('exist')
    cy.get('&localImagesCountString').should('exist')

    // Click the button to show local covers
    cy.get('&localImagesCountString').find('button').click()
    cy.get('&showLocalCovers').should('exist')
    // Assert the local cover image is displayed
    cy.get('&showLocalCovers').find('img').should('have.attr', 'src').and('include', '/api/items/item-1/file/649644248522215267')

    cy.get('&bookCoverSearchForm').should('exist')
    cy.get('&providerDropDown').should('exist')
    cy.get('&searchTitleTextInput').should('exist')
    cy.get('&searchAuthorTextInput').should('exist')
    cy.get('&bookCoverSearchBtn').should('exist')
  })
})
