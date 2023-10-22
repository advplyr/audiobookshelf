require('./commands')
require('@cypress/code-coverage/support')


before(() => {

  if (Cypress.env('SEED_DATABASE')) {
    cy.exec('npm run cypress:prepare')
  }

  // Set ADMIN_TOKEN from the value store in fixtures/token.json
  // This is set by initializeDatabase.
  cy.fixture('token.json').then((token) => {
    Cypress.env('ADMIN_TOKEN', 'Bearer ' + token.bearerToken)
  })

  // Do a healthcheck
  cy.request({
    url: '/healthcheck/',
    method: 'GET',
  }).then((res) => {
    expect(res.status).to.eq(200)
  })

})
