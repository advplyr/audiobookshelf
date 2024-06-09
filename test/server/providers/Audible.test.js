const Audible = require('../../../server/providers/Audible')
const { expect } = require('chai')
const sinon = require('sinon')

describe('Audible', () => {
  let audible;

  beforeEach(() => {
    audible = new Audible();
  });

  describe('cleanSeriesSequence', () => {
    it('should return an empty string if sequence is falsy', () => {
      const result = audible.cleanSeriesSequence('Series Name', null)
      expect(result).to.equal('')
    })

    it('should return the sequence as is if it does not contain a number', () => {
      const result = audible.cleanSeriesSequence('Series Name', 'part a')
      expect(result).to.equal('part a')
    })

    it('should return the sequence as is if contains just a number', () => {
      const result = audible.cleanSeriesSequence('Series Name', '2')
      expect(result).to.equal('2')
    })

    it('should return the sequence as is if contains just a number with decimals', () => {
      const result = audible.cleanSeriesSequence('Series Name', '2.3')
      expect(result).to.equal('2.3')
    })

    it('should extract and return the first number from the sequence', () => {
      const result = audible.cleanSeriesSequence('Series Name', 'Book 1')
      expect(result).to.equal('1')
    })

    it('should extract and return the number with decimals from the sequence', () => {
      const result = audible.cleanSeriesSequence('Series Name', 'Book 1.5')
      expect(result).to.equal('1.5')
    })
    
    it('should extract and return the number even if it has no leading zero', () => {
      const result = audible.cleanSeriesSequence('Series Name', 'Book .5')
      expect(result).to.equal('.5')
    })
  })
})