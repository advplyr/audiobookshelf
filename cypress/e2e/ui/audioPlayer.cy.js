
import books from '../../fixtures/bookMetadata/index'


describe('Play an audiobook', () => {
  // Use the relative path of an audiobook for the test, so it doesn't depend on the book's ID.
  let testAudiobookId
  const testItemRelPath = books[0].relPath

  beforeEach(() => {
    cy.loginAsAdmin()
    cy.getLibraryItemIdFromRelPath(Cypress.env('AUDIOBOOK_LIBRARY_NAME'), testItemRelPath).then((itemID) => {
      testAudiobookId = itemID
      cy.visit('/item/' + testAudiobookId)
    })
  })

  it(`Navigate to an audiobook, press play, and verify that audio is playing (${testItemRelPath})`, () => {

    // Press play and check that the request was sent
    cy.intercept('POST', '/api/items/' + testAudiobookId + '/play').as('play');
    cy.get("[data-testid=playButton]").click()
    cy.wait('@play')

    // Check that the player ui opened
    cy.get("#streamContainer").should("exist")

    // Check that the timestamp display is changing. This rely's on cypress's retry feature
    var timestamp = '0:00'
    for (let i = 0; i < 3; i++) {
      cy.get('[data-testid=currentTimestamp]').invoke('text').should((currentTimestamp) => {
        expect(currentTimestamp).to.not.equal(timestamp)
        timestamp = currentTimestamp
      })
    }

    // Check that the audio element is actually loaded and playing
    cy.get("audio").should((audioElement) => {
      expect(audioElement.get(0).duration).to.be.greaterThan(0)
      expect(audioElement.get(0).paused).to.be.false
    })

    // Press the pause button and verify that audio is paused
    cy.get("[data-testid=playPause]").click()
    cy.get("audio").should((audioElement) => {
      expect(audioElement.get(0).paused).to.be.true
    })

  })
})
