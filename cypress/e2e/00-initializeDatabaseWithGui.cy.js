/** 
 * This spec is more of a procedure to seed a fresh database, meant to be run before other tests.
 * It uses the ui to create the administrator account, add a first library, and start a scan.
*/
describe('Initialize a fresh database', () => {
  let token = ""

  // Only run these tests if the database isn't initialized
  before(function () {
    cy.request('/status').then((response) => {
      cy.skipIf(response.body.isInit)
    })
  })

  it('Create the admin account', () => {
    cy.visit('/login');

    cy.get('[data-testid=username]').find('input').clear().type(Cypress.env('ADMIN_USERNAME'))
    cy.get('[data-testid=password]').find('input').clear().type(Cypress.env('ADMIN_PASSWORD'))
    cy.get('[data-testid=confirm-password]').find('input').clear().type(Cypress.env('ADMIN_PASSWORD'))

    cy.intercept('POST', '/init').as('init')
    cy.get('button[type=submit]').click()
    cy.wait('@init').its('response.statusCode').should('eq', 200)
  })


  it('Save the admin user token to fixtures/token.json', () => {
    cy.loginAsAdmin().then(() => {
      cy.readFile("cypress/fixtures/token.json").then((data) => {
        token = localStorage.getItem("token")
        expect(token).to.exist
        data.bearerToken = token
        cy.writeFile("./cypress/fixtures/token.json", JSON.stringify(data))
      })
    })
  })

  it('Set log level to warn', () => {
    cy.request({
      url: '/api/settings',
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + token },
      body: { "logLevel": 0 }
    }).then((response) => {
      expect(response.status).to.eq(200)
    })
  })

  it('Create a non-admin user account', () => {
    cy.request({
      url: '/api/users',
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
      body: {
        "username": Cypress.env('USER_USERNAME'),
        "password": Cypress.env('USER_PASSWORD'),
        "type": "user"
      }
    }).then((response) => {
      expect(response.status).to.eq(200)
    })
  })



  it('Create a library', () => {
    cy.loginAsAdmin()
    cy.visit('/');
    cy.intercept('POST', '/api/libraries').as('apiCall')

    // cy.get('button').contains("add").click()
    cy.get('[data-testid=ButtonAddYourFirstLibrary]').click()

    cy.get(".modal").filter(':visible').within(() => {
      cy.get('[data-testid=LabelLibraryName]').find('input').type(Cypress.env('AUDIOBOOK_LIBRARY_NAME'))
      cy.get('input[data-testid=newFolderInput]').type(Cypress.env('AUDIOBOOK_LIBRARY_PATH'))
      cy.get('[data-testid=metadataProvider]').click().get('[id=listbox-option-audible]').click()
      cy.get('[data-testid=createLibrary]').click()
    })

    // Save the library ID to the settings fixture
    cy.wait('@apiCall').then((interception) => {
      expect(interception.response.statusCode).to.eq(200)
    })

    // Wait for the success notification to appear and the library name to show up in the list
    cy.toastSuccess().should('be.visible')
    cy.get(".list-group").contains(".item", Cypress.env('AUDIOBOOK_LIBRARY_NAME'))
  })


  it('Scan the library', () => {
    cy.loginAsAdmin()
    cy.visit('/', {
      onBeforeLoad(win) {
        // This allows us to wait for the the 'Scan complete received' message in the console log
        cy.stub(win.console, 'log').as('consoleLog')
      },
    })

    // Press the scan button and confirm that scanning started
    cy.get('[data-testid="ButtonScanLibrary"]').click()
    cy.toastSuccess().should('be.visible')

    // Wait for the scan to complete
    cy.get('@consoleLog', { timeout: 20000 }).should('be.calledWith', 'Scan complete received')
  })

})



