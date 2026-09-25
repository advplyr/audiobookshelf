const chai = require('chai')
const expect = chai.expect
const { parse, nameToLastFirst } = require('../../../../server/utils/parsers/parseNameString')

describe('parseNameString', () => {
  describe('parse', () => {
    it('returns null if nameString is empty', () => {
      const result = parse('')
      expect(result).to.be.null
    })

    it('parses single name in First Last format', () => {
      const result = parse('John Smith')
      expect(result.names).to.deep.equal(['John Smith'])
    })

    it('parses single name in Last, First format', () => {
      const result = parse('Smith, John')
      expect(result.names).to.deep.equal(['John Smith'])
    })

    it('parses multiple names separated by &', () => {
      const result = parse('John Smith & Jane Doe')
      expect(result.names).to.deep.equal(['John Smith', 'Jane Doe'])
    })

    it('parses multiple names separated by "and"', () => {
      const result = parse('John Smith and Jane Doe')
      expect(result.names).to.deep.equal(['John Smith', 'Jane Doe'])
    })

    it('parses multiple names separated by comma and "and"', () => {
      const result = parse('John Smith, Jane Doe and John Doe')
      expect(result.names).to.deep.equal(['John Smith', 'Jane Doe', 'John Doe'])
    })

    it('parses multiple names separated by semicolon', () => {
      const result = parse('John Smith; Jane Doe')
      expect(result.names).to.deep.equal(['John Smith', 'Jane Doe'])
    })

    it('parses multiple names in Last, First format', () => {
      const result = parse('Smith, John, Doe, Jane')
      expect(result.names).to.deep.equal(['John Smith', 'Jane Doe'])
    })

    it('parses multiple names with single word name', () => {
      const result = parse('John Smith, Jones, James Doe, Ludwig von Mises')
      expect(result.names).to.deep.equal(['John Smith', 'Jones', 'James Doe', 'Ludwig von Mises'])
    })

    it('parses multiple names with single word name listed first (semicolon separator)', () => {
      const result = parse('Jones; John Smith; James Doe; Ludwig von Mises')
      expect(result.names).to.deep.equal(['Jones', 'John Smith', 'James Doe', 'Ludwig von Mises'])
    })

    it('handles names with suffixes', () => {
      const result = parse('Smith, John Jr.')
      expect(result.names).to.deep.equal(['John Jr. Smith'])
    })

    it('handles compound last names', () => {
      const result = parse('von Mises, Ludwig')
      expect(result.names).to.deep.equal(['Ludwig von Mises'])
    })

    it('handles Chinese/Japanese/Korean names', () => {
      const result = parse('张三, 李四')
      expect(result.names).to.deep.equal(['张三', '李四'])
    })

    // Regression: https://github.com/advplyr/audiobookshelf/issues/5367
    // Some taggers join first/last names with U+202F (narrow no-break space) or
    // U+00A0 (no-break space) instead of a regular space. Those are not matched
    // by ' ', so every chunk read as a space-less "last name" and the whole
    // First Last list was flipped into "Last, First" pairing mode.
    it('does not pair a First Last list joined by narrow no-break spaces (U+202F)', () => {
      const result = parse('Joanna\u202fWyatt, Paul\u202fPanting, Stephen\u202fWebb, Julian\u202fGlover')
      expect(result.names).to.deep.equal(['Joanna Wyatt', 'Paul Panting', 'Stephen Webb', 'Julian Glover'])
    })

    it('does not pair a First Last list joined by no-break spaces (U+00A0)', () => {
      const result = parse('Jane\u00a0Doe, John\u00a0Smith')
      expect(result.names).to.deep.equal(['Jane Doe', 'John Smith'])
    })

    it('keeps every name in a large odd-length First Last list joined by narrow no-break spaces', () => {
      const expected = ['Joanna Wyatt', 'Paul Panting', 'Stephen Webb', 'Julian Glover', 'Tim Bentinck']
      const input = expected.map((n) => n.replace(' ', '\u202f')).join(', ')
      const result = parse(input)
      expect(result.names).to.deep.equal(expected)
    })

    it('still pairs a genuine Last, First list that uses narrow no-break spaces inside first/last parts', () => {
      const result = parse('von\u202fMises, Ludwig, Smith, John')
      expect(result.names).to.deep.equal(['Ludwig von Mises', 'John Smith'])
    })

    it('removes duplicate names', () => {
      const result = parse('John Smith & John Smith')
      expect(result.names).to.deep.equal(['John Smith'])
    })

    it('filters out empty names', () => {
      const result = parse('John Smith,')
      expect(result.names).to.deep.equal(['John Smith'])
    })
  })

  describe('nameToLastFirst', () => {
    it('converts First Last to Last, First format', () => {
      const result = nameToLastFirst('John Smith')
      expect(result).to.equal('Smith, John')
    })

    it('returns last name only when no first name', () => {
      const result = nameToLastFirst('Smith')
      expect(result).to.equal('Smith')
    })

    it('handles names with middle names', () => {
      const result = nameToLastFirst('John Middle Smith')
      expect(result).to.equal('Smith, John Middle')
    })
  })
})
