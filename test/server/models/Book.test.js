const { expect } = require('chai')
const sinon = require('sinon')
const Book = require('../../../server/models/Book')

describe('Book', () => {
  describe('updateFromRequest', () => {
    it('normalizes an ISO date submitted as the published year', async () => {
      const book = {
        title: 'Test Book',
        publishedYear: null,
        save: sinon.stub().resolves(),
        changed: sinon.stub().returns(['publishedYear'])
      }

      const updated = await Book.prototype.updateFromRequest.call(book, {
        metadata: { publishedYear: '2013-01-01' }
      })

      expect(updated).to.equal(true)
      expect(book.publishedYear).to.equal('2013')
      expect(book.save.calledOnce).to.equal(true)
    })
  })
})
