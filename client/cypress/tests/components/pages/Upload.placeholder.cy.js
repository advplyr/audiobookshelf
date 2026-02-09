import UploadPage from '@/pages/upload/index.vue'

describe('Upload page placeholder targeting', () => {
  it('renders directory/placeholder selector in item card without none option and sends folder-specific placeholder payload', () => {
    const uploadFile = new File(['audio'], 'track-01.mp3', { type: 'audio/mpeg' })
    const library = {
      id: 'library-1',
      name: 'Test Library',
      mediaType: 'book',
      folders: [
        {
          id: 'folder-1',
          fullPath: '/library',
          path: '/library'
        },
        {
          id: 'folder-2',
          fullPath: '/library-2',
          path: '/library-2'
        }
      ]
    }

    const placeholderItemsPayload = {
      results: [
        {
          id: 'placeholder-1',
          isPlaceholder: true,
          folderId: 'folder-1',
          media: { metadata: { title: 'Placeholder One', authorName: 'Author One' } }
        },
        {
          id: 'placeholder-2',
          isPlaceholder: true,
          folderId: 'folder-2',
          media: { metadata: { title: 'Placeholder Two', authorName: 'Author Two' } }
        }
      ]
    }

    const postStub = cy.stub().callsFake((url, payload) => {
      if (url === '/api/upload') {
        expect(payload.get('folder')).to.equal('folder-2')
        expect(payload.get('placeholder')).to.equal('id:placeholder-2')
        return Promise.resolve()
      }

      if (url === '/api/filesystem/pathexists') {
        throw new Error('Path checks should be skipped for placeholder uploads')
      }

      return Promise.resolve({ exists: false })
    })

    const mountOptions = {
      mocks: {
        $axios: {
          $get: cy.stub().callsFake((url) => {
            if (url.includes('/api/libraries/library-1/items') && url.includes('include=placeholders')) {
              return Promise.resolve(placeholderItemsPayload)
            }
            return Promise.resolve({ results: [] })
          }),
          $post: postStub
        },
        $toast: {
          error: cy.stub()
        },
        $store: {
          dispatch: cy.stub().resolves(),
          getters: {
            'libraries/getLibraryProvider': () => 'audible.us'
          },
          state: {
            streamLibraryItem: null,
            scanners: {
              podcastProviders: [],
              bookProviders: []
            },
            libraries: {
              currentLibraryId: library.id,
              libraries: [library]
            }
          }
        }
      }
    }

    cy.mount(UploadPage, mountOptions)

    cy.wrap(Cypress.vueWrapper.vm).then((vm) => {
      vm.selectedFolderId = 'folder-2'
      vm.placeholderTargetByFolderId = {
        ...vm.placeholderTargetByFolderId,
        'folder-2': 'id:placeholder-2'
      }
      vm.items = [
        {
          index: 1,
          title: 'Placeholder',
          author: 'Author Name',
          series: 'Series Name',
          itemFiles: [uploadFile],
          otherFiles: [],
          ignoredFiles: []
        }
      ]
      return vm.$nextTick()
    })

    cy.contains('label', 'Directory/Placeholder').should('exist')
    cy.get('&directoryPlaceholderSelector').should('have.length', 1)
    cy.get('&directoryPlaceholderSelector').contains('Placeholder Two')
    cy.get('&directoryPlaceholderSelector').contains('Author Two')
    cy.get('&directoryPlaceholderSelector').should('not.contain', 'None (upload as new item)')

    cy.contains('button', 'Upload').click()

    cy.wrap(postStub).should('have.been.calledOnceWithMatch', '/api/upload')
    cy.wrap(postStub).should('have.been.calledWithMatch', '/api/upload')
  })
})
