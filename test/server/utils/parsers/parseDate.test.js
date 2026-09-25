const chai = require('chai')
const expect = chai.expect
const { parse } = require('../../../../server/utils/parsers/parseDate')

describe('parseDate', () => {
  describe('parse', () => {
    it('returns null for empty input', () => {
      expect(parse('')).to.be.null
      expect(parse(null)).to.be.null
      expect(parse(undefined)).to.be.null
    })

    it('returns null for non-string input', () => {
      expect(parse(20250101)).to.be.null
      expect(parse({})).to.be.null
      expect(parse([])).to.be.null
    })

    it('parses ISO 8601 date string with new Date()', () => {
      const result = parse('2024-01-15')
      expect(result).to.be.instanceOf(Date)
      expect(result.getFullYear()).to.equal(2024)
      expect(result.getMonth()).to.equal(0)
      expect(result.getDate()).to.equal(15)
    })

    it('parses date string with time using new Date()', () => {
      const result = parse('2024-06-20T14:30:00Z')
      expect(result).to.be.instanceOf(Date)
      expect(result.getFullYear()).to.equal(2024)
      expect(result.getMonth()).to.equal(5)
      expect(result.getDate()).to.equal(20)
    })

    it('parses YYYYMMDD format when new Date() fails', () => {
      const result = parse('20240325')
      expect(result).to.be.instanceOf(Date)
      expect(result.getFullYear()).to.equal(2024)
      expect(result.getMonth()).to.equal(2)
      expect(result.getDate()).to.equal(25)
    })

    it('parses YYYYMMDD format with leading zeros', () => {
      const result = parse('20240105')
      expect(result).to.be.instanceOf(Date)
      expect(result.getFullYear()).to.equal(2024)
      expect(result.getMonth()).to.equal(0)
      expect(result.getDate()).to.equal(5)
    })

    it('parses YYMMDD format (2-digit year > 50 as 19xx)', () => {
      const result = parse('750312')
      expect(result).to.be.instanceOf(Date)
      expect(result.getFullYear()).to.equal(1975)
      expect(result.getMonth()).to.equal(2)
      expect(result.getDate()).to.equal(12)
    })

    it('parses YYMMDD format (2-digit year <= 50 as 20xx)', () => {
      const result = parse('250312')
      expect(result).to.be.instanceOf(Date)
      expect(result.getFullYear()).to.equal(2025)
      expect(result.getMonth()).to.equal(2)
      expect(result.getDate()).to.equal(12)
    })

    it('parses YYMMDD format with leading zeros', () => {
      const result = parse('990105')
      expect(result).to.be.instanceOf(Date)
      expect(result.getFullYear()).to.equal(1999)
      expect(result.getMonth()).to.equal(0)
      expect(result.getDate()).to.equal(5)
    })

    it('prefers new Date() parsing over YYYYMMDD when both could work', () => {
      const result = parse('2024-01-15')
      expect(result).to.be.instanceOf(Date)
      expect(result.getFullYear()).to.equal(2024)
    })

    it('rejects month overflow in YYYYMMDD', () => {
      expect(parse('20241301')).to.be.null
    })

    it('rejects day overflow in YYYYMMDD', () => {
      expect(parse('20240235')).to.be.null
    })

    it('returns null for invalid strings', () => {
      expect(parse('not a date')).to.be.null
      expect(parse('hello world')).to.be.null
      expect(parse('202401')).to.be.null
    })

    it('returns null for YYYYMMDD with non-digits', () => {
      expect(parse('2024-01-15')).to.be.instanceOf(Date)
      expect(parse('2024/01/15')).to.be.instanceOf(Date)
      expect(parse('2024.01.15')).to.be.instanceOf(Date)
    })

    it('parses 4-digit year string as year', () => {
      const result = parse('2024')
      expect(result).to.be.instanceOf(Date)
      expect(result.getFullYear()).to.equal(2024)
      expect(result.getMonth()).to.equal(0)
      expect(result.getDate()).to.equal(1)
    })
  })
})
