import { addStreamCommands } from '@lensesio/cypress-websocket-testing'
addStreamCommands()

Cypress.Commands.add('login', (username, password) => {
  cy.session(
    [username, password],
    () => {
      cy.visit('/login')

      cy.get('[data-testid=username]').find('input').type(username)
      cy.get('[data-testid=password]').find('input').type(password)

      cy.intercept('/login').as('localLogin')
      cy.get('button[type=submit]').click()

      cy.wait('@localLogin')

      cy.url().should('contain', '/')
    },
    {
      validate() {
        cy.request({
          url: '/api/me',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + localStorage.getItem('token') },
        }).then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.username).to.eq(username)
        })
      },
    }
  )
})

Cypress.Commands.add('loginAsAdmin', () => {
  cy.login(Cypress.env('ADMIN_USERNAME'), Cypress.env('ADMIN_PASSWORD'))
})

Cypress.Commands.add('loginAsUser', () => {
  cy.login(Cypress.env('USER_USERNAME'), Cypress.env('USER_PASSWORD'))
})

Cypress.Commands.add('skipIf', function (expression) {
  if (expression) {
    this.skip()
  }
})

// Success popup notification
Cypress.Commands.add('toastSuccess', () => {
  cy.get('.Vue-Toastification__toast--success')
})

Cypress.Commands.add('loginWithApi', () => {
  cy.request({
    url: '/login',
    method: 'POST',
    body: {
      username: Cypress.env('ADMIN_USERNAME'),
      password: Cypress.env('ADMIN_PASSWORD'),
    },
  }).then((response) => {
    expect(response.status).to.eq(200)
    cy.log('Logged in with token: ' + response.body.user.token)
    return cy.wrap(response.body.user.token)
  })
})

Cypress.Commands.add('getLibraryIDFromName', (libraryName) => {
  cy.request({
    url: '/api/libraries/',
    headers: { Authorization: Cypress.env('ADMIN_TOKEN') },
  }).then((res) => {
    expect(res.status).to.eq(200)
    let libraryID = res.body.libraries.find((x) => x.name == libraryName).id
    return cy.wrap(libraryID)
  })
})

Cypress.Commands.add('getLibraryItems', (libraryID) => {
  cy.request({
    url: '/api/libraries/' + libraryID + '/items',
    headers: { Authorization: Cypress.env('ADMIN_TOKEN') },
    body: { limit: 0 },
  }).then((res) => {
    expect(res.status).to.eq(200)
    let libraryItems = res.body
    return cy.wrap(libraryItems)
  })
})

Cypress.Commands.add('getLibraryItemIdFromRelPath', (libraryName, relPath) => {
  cy.getLibraryIDFromName(libraryName).then((libraryID) => {
    cy.getLibraryItems(libraryID).then((libraryItems) => {
      expect(
        libraryItems.results.map(({ relPath }) => {
          return relPath
        })
      ).to.include(relPath, 'No library item with that relPath exists!')
      let libraryItem = libraryItems.results.find((x) => x.relPath == relPath)

      return cy.wrap(libraryItem.id)
    })
  })
})
