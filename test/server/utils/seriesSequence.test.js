const { expect } = require('chai')
const { normalizeSeriesSequence, normalizeSeriesSequences } = require('../../../server/utils/seriesSequence')

describe('seriesSequence', () => {
  describe('normalizeSeriesSequence', () => {
    it('removes redundant integer leading zeros and fractional trailing zeros', () => {
      expect(normalizeSeriesSequence('05.5')).to.equal('5.5')
      expect(normalizeSeriesSequence('00.5')).to.equal('0.5')
      expect(normalizeSeriesSequence('08.0')).to.equal('8')
      expect(normalizeSeriesSequence('00.05')).to.equal('0.05')
    })

    it('preserves zero, empty values, and non-numeric sequences', () => {
      expect(normalizeSeriesSequence('0')).to.equal('0')
      expect(normalizeSeriesSequence('')).to.equal('')
      expect(normalizeSeriesSequence(null)).to.equal(null)
      expect(normalizeSeriesSequence('1a')).to.equal('1a')
    })

    it('preserves precision for large numeric sequences', () => {
      expect(normalizeSeriesSequence('000123456789012345678901234567890.5000')).to.equal('123456789012345678901234567890.5')
    })
  })

  describe('normalizeSeriesSequences', () => {
    it('normalizes the sequence on every series entry', () => {
      const series = [
        { name: 'Series One', sequence: '05.5' },
        { name: 'Series Two', sequence: '08.0' },
        { name: 'Series Three', sequence: '1a' },
        { name: 'Series Four', sequence: null }
      ]

      expect(normalizeSeriesSequences(series)).to.deep.equal([
        { name: 'Series One', sequence: '5.5' },
        { name: 'Series Two', sequence: '8' },
        { name: 'Series Three', sequence: '1a' },
        { name: 'Series Four', sequence: null }
      ])
    })
  })
})
