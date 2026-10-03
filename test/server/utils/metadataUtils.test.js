const chai = require('chai')
const expect = chai.expect
const { normalizePublishedYear } = require('../../../server/utils/metadataUtils')

describe('normalizePublishedYear', () => {
  it('keeps a four-digit year unchanged', () => {
    expect(normalizePublishedYear('2013')).to.equal('2013')
  })

  it('extracts the year from ISO-style dates', () => {
    expect(normalizePublishedYear('2013-01')).to.equal('2013')
    expect(normalizePublishedYear('2013-01-01')).to.equal('2013')
    expect(normalizePublishedYear('2013-01-01T12:34:56')).to.equal('2013')
  })

  it('leaves unsupported values unchanged', () => {
    expect(normalizePublishedYear(null)).to.equal(null)
    expect(normalizePublishedYear(2013)).to.equal(2013)
    expect(normalizePublishedYear('01-01-2013')).to.equal('01-01-2013')
    expect(normalizePublishedYear('2013/01/01')).to.equal('2013/01/01')
  })
})
