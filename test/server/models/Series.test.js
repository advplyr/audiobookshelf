const { expect } = require('chai')
const { normalizeAudibleSeriesAsin } = require('../../../server/models/Series')

describe('Series', function () {
  describe('normalizeAudibleSeriesAsin', function () {
    it('should return null for null/undefined/empty', function () {
      expect(normalizeAudibleSeriesAsin(null)).to.equal(null)
      expect(normalizeAudibleSeriesAsin(undefined)).to.equal(null)
      expect(normalizeAudibleSeriesAsin('')).to.equal(null)
      expect(normalizeAudibleSeriesAsin('   ')).to.equal(null)
    })

    it('should uppercase valid ASINs', function () {
      expect(normalizeAudibleSeriesAsin('b0182nwm9i')).to.equal('B0182NWM9I')
      expect(normalizeAudibleSeriesAsin('B0182NWM9I')).to.equal('B0182NWM9I')
    })

    it('should trim whitespace', function () {
      expect(normalizeAudibleSeriesAsin('  B0182NWM9I  ')).to.equal('B0182NWM9I')
    })

    it('should extract ASIN from Audible series URL', function () {
      expect(normalizeAudibleSeriesAsin('https://www.audible.com/series/Harry-Potter/B0182NWM9I')).to.equal('B0182NWM9I')
      expect(normalizeAudibleSeriesAsin('https://www.audible.com/series/B0182NWM9I')).to.equal('B0182NWM9I')
      expect(normalizeAudibleSeriesAsin('/series/Harry-Potter/B0182NWM9I')).to.equal('B0182NWM9I')
      expect(normalizeAudibleSeriesAsin('/series/B0182NWM9I')).to.equal('B0182NWM9I')
    })

    it('should extract ASIN from URL with query params', function () {
      expect(normalizeAudibleSeriesAsin('https://www.audible.com/series/B0182NWM9I?ref=a_search')).to.equal('B0182NWM9I')
    })

    it('should throw for invalid ASIN format (too short)', function () {
      expect(() => normalizeAudibleSeriesAsin('B0182NWM9')).to.throw('Invalid ASIN format')
    })

    it('should throw for invalid ASIN format (too long)', function () {
      expect(() => normalizeAudibleSeriesAsin('B0182NWM9I1')).to.throw('Invalid ASIN format')
    })

    it('should throw for invalid characters', function () {
      expect(() => normalizeAudibleSeriesAsin('B0182NWM9-')).to.throw('Invalid ASIN format')
      expect(() => normalizeAudibleSeriesAsin('B0182NWM9!')).to.throw('Invalid ASIN format')
    })

    it('should throw for non-string types', function () {
      expect(() => normalizeAudibleSeriesAsin(123)).to.throw('audibleSeriesAsin must be a string or null')
      expect(() => normalizeAudibleSeriesAsin({})).to.throw('audibleSeriesAsin must be a string or null')
    })

    it('should throw for URL without valid ASIN', function () {
      expect(() => normalizeAudibleSeriesAsin('https://www.audible.com/series/Harry-Potter')).to.throw('Invalid ASIN format')
    })
  })
})
