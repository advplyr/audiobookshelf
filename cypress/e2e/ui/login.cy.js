describe('Login', () => {
  it('log in as an admin', () => {
    cy.loginAsAdmin()
    cy.visit('/')
  })

  it('log in as a user', () => {
    cy.loginAsUser()
    cy.visit('/')
  })
})
