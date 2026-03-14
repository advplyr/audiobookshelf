const chai = require('chai')
const expect = chai.expect

const {
  encodeBrowseCursor,
  decodeBrowseCursor
} = require('../../../server/utils/queries/libraryBrowseCursor')

describe('libraryBrowseCursor', () => {
  it('round-trips a deterministic title cursor with id tie-breaker', () => {
    const encoded = encodeBrowseCursor({
      sortBy: 'media.metadata.title',
      desc: false,
      keys: ['titleIgnorePrefix', 'id'],
      values: ['Dune', 'item_42']
    })

    expect(decodeBrowseCursor(encoded)).to.deep.equal({
      sortBy: 'media.metadata.title',
      desc: false,
      keys: ['titleIgnorePrefix', 'id'],
      values: ['Dune', 'item_42']
    })
  })

  it('rejects a cursor without the full ordered key set', () => {
    expect(() => decodeBrowseCursor(encodeBrowseCursor({
      sortBy: 'media.metadata.title',
      desc: false,
      keys: ['titleIgnorePrefix', 'id'],
      values: ['Dune']
    }))).to.throw('full ordered key set')
  })

  it('rejects a cursor without the id tie-breaker', () => {
    expect(() => decodeBrowseCursor(encodeBrowseCursor({
      sortBy: 'media.metadata.title',
      desc: false,
      keys: ['titleIgnorePrefix'],
      values: ['Dune']
    }))).to.throw('tie-breaker')
  })

  it('rejects a cursor when the id tie-breaker value is null', () => {
    expect(() => decodeBrowseCursor(encodeBrowseCursor({
      sortBy: 'media.metadata.title',
      desc: false,
      keys: ['titleIgnorePrefix', 'id'],
      values: ['Dune', null]
    }))).to.throw('tie-breaker')
  })

  it('rejects a malformed cursor string with a controlled invalid-cursor error', () => {
    expect(() => decodeBrowseCursor('%%%not-base64%%%')).to.throw('Invalid browse cursor')
  })

  it('rejects malformed cursor json with a controlled invalid-cursor error', () => {
    const malformedJsonCursor = Buffer.from('{"sortBy":', 'utf8').toString('base64url')

    expect(() => decodeBrowseCursor(malformedJsonCursor)).to.throw('Invalid browse cursor')
  })
})
