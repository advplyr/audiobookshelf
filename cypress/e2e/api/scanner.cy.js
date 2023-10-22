import books from '../../fixtures/bookMetadata/index'
import data from '../../fixtures/token.json'
const headers = { Authorization: 'Bearer ' + data.bearerToken }


describe('Compare the metadata in the library to the reference files', () => {
  let libraryID, libraryItems

  before(() => {

    // Get the library ID of env.AUDIOBOOK_LIBRARY_NAME
    cy.request({
      url: '/api/libraries/',
      headers: headers,
    }).then((res) => {
      expect(res.status).to.eq(200)
      libraryID = res.body.libraries.find(x => x.name == Cypress.env('AUDIOBOOK_LIBRARY_NAME')).id
    })

    // Load all library items
    cy.then(() => {
      cy.request({
        url: `api/libraries/${libraryID}/items`,
        headers: headers,
        body: { limit: 0 }
      }).then((res) => {
        expect(res.status).to.eq(200)
        libraryItems = res.body
      })

    })
  })


  it('Check that the library contains more than zero items', () => {
    expect(libraryItems.total).to.be.greaterThan(0)
    expect(libraryItems.total).to.equal(libraryItems.results.length)
  })


  for (const expectedMetadata of books) {
    it(`Verify metadata for "${expectedMetadata.relPath}"`, function () {

      // Use the relPath to search for the library item
      const thisItem = libraryItems.results.find(x => x.relPath == expectedMetadata.relPath)
      expect(thisItem).to.have.property("id")

      cy.request({
        url: `/api/items/${thisItem.id}`,
        headers: headers,
        qs: { expanded: 0 }
      }).then((res) => {
        expect(res.status).to.eq(200)

        expect(res.body).to.deep.include.all.keys(expectedMetadata)
        expect(res.body.media.metadata.authors.map(e => ({ name: e.name }))).to.have.deep.members(expectedMetadata.media.metadata.authors)
        expect(res.body.media.metadata.series.map(e => ({ name: e.name, sequence: e.sequence }))).to.have.deep.members(expectedMetadata.media.metadata.series)
        expect(res.body).to.nested.deep.include({
          'media.metadata.title': expectedMetadata.media.metadata.title,
          'media.metadata.subtitle': expectedMetadata.media.metadata.subtitle,
          'media.metadata.narrators': expectedMetadata.media.metadata.narrators,
          'media.metadata.description': expectedMetadata.media.metadata.description,
          'media.metadata.genres': expectedMetadata.media.metadata.genres,
          // 'media.metadata.publisher': expectedMetadata.media.metadata.publisher,
          'media.metadata.asin': expectedMetadata.media.metadata.asin,
          'media.chapters': expectedMetadata.media.chapters,
        })

      })
    })
  }

})
