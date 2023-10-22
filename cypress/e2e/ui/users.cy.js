const testUser = {
  username: 'Test User',
  password: 'test1234',
}

describe('Manage Users', () => {
  beforeEach(() => {
    cy.loginAsAdmin()
    cy.visit('/config/users')
    cy.get('table[id=accounts').contains('td', Cypress.env('ADMIN_USERNAME')).should('be.visible')
  })


  it('create a new user', () => {

    // Skip if the test user already exists
    cy.get('table[id=accounts').then(($el) => {
      cy.skipIf($el.find(`td:contains(${testUser.username})`).length > 0)
    })

    cy.get('button').contains("add").click()
    cy.intercept('POST', '/api/users').as('apiCall')
    cy.get('form').filter(':visible').within(() => {
      cy.get('[data-testid=newUsername]').find('div').find('input').type(testUser.username)
      cy.get('[data-testid=newPassword]').find('div').find('input').type(testUser.password)
      cy.get('button[type=submit]').click()
    })

    cy.wait('@apiCall').then((interception) => {
      expect(interception.response.statusCode).to.eq(200)
      expect(interception.response.body.user.username).to.eq(testUser.username)
    })

    cy.toastSuccess().should('be.visible')
  })

  it('delete the newly created user', () => {

    // Skip if the test user doesn't exists
    cy.get('table[id=accounts').then(($el) => {
      cy.skipIf($el.find(`td:contains(${testUser.username})`).length === 0)
    })

    cy.get('table[id=accounts').contains('td', testUser.username).siblings().contains('button', 'delete').click()
    cy.get('table[id=accounts').contains('td', testUser.username).should('not.exist')

    cy.toastSuccess().should('be.visible')
  })

})
