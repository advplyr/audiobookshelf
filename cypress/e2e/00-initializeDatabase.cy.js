/** 
 * This spec is more of a procedure to seed a fresh database, meant to be run before other tests.
 * It uses the ui to create the administrator account, add a first library, and start a scan.
*/

describe('Initialize a fresh database', () => {
  let token, libraryID

  // Only run these tests if the database isn't initialized
  before(function () {
    cy.request('/status').then((response) => {
      cy.skipIf(response.body.isInit)
    })
  })

  it('Initialize the server and root user', () => {
    cy.request({
      url: '/init',
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
      body: {
        newRoot: {
          "username": Cypress.env('ADMIN_USERNAME'),
          "password": Cypress.env('ADMIN_PASSWORD')
        }
      }
    }).then((response) => {
      expect(response.status).to.eq(200)
    })
  })

  it('Save the root user token to fixtures/token.json', () => {
    cy.loginWithApi().then((adminToken) => {
      cy.readFile("cypress/fixtures/token.json").then((data) => {
        token = data.bearerToken = adminToken
        cy.writeFile("./cypress/fixtures/token.json", JSON.stringify(data))
      })
    })
  })

  it('Set log level to warn', () => {
    cy.request({
      url: '/api/settings',
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + token },
      body: { "logLevel": 3 }
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
    cy.request({
      url: '/api/libraries',
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
      body: {
        "name": Cypress.env('AUDIOBOOK_LIBRARY_NAME'),
        "folders": [{ "fullPath": Cypress.env('AUDIOBOOK_LIBRARY_PATH') }],
        "provider": "audible"
      }
    }).then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body).to.have.property("id")
      libraryID = response.body.id
    })
  })


  it('Scan the library', () => {
    cy.request({
      url: `/api/libraries/${libraryID}/scan`,
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token }
    }).then((response) => {
      expect(response.status).to.eq(200)

    })

    // Wait for the scan to complete
    cy.then(function checkIfScanFinished(retries = 0) {
      cy.request({
        url: `/api/libraries/${libraryID}`,
        headers: { Authorization: 'Bearer ' + token }
      }).then((response) => {
        expect(response.status).to.eq(200)
        cy.log('Waiting for library scan to finish, attempt: ' + retries)
        if (response.body.lastScan !== null)
          return
        else if (retries > 10)
          throw new Error("Library scan didn't complete!")
        else {
          retries++
          cy.wait(1000).then(() => checkIfScanFinished(retries))
        }
      })
    })

  })

})



