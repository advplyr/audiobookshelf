const chai = require('chai')
const expect = chai.expect
const { parse } = require('../../../../server/utils/parsers/parseSeriesString')

describe('parseSeriesString', () => {
  it('returns null for an empty or non-string value', () => {
    expect(parse('')).to.be.null
    expect(parse(null)).to.be.null
    expect(parse(5)).to.be.null
    expect(parse('   ')).to.be.null
  })

  it('splits the name and the sequence', () => {
    expect(parse('Name #1')).to.deep.equal({ name: 'Name', sequence: '1' })
    expect(parse('Name #1a')).to.deep.equal({ name: 'Name', sequence: '1a' })
    expect(parse('Name #1.5')).to.deep.equal({ name: 'Name', sequence: '1.5' })
  })

  it('keeps a name without a sequence', () => {
    expect(parse('Name')).to.deep.equal({ name: 'Name', sequence: null })
    expect(parse('Name #1 a')).to.deep.equal({ name: 'Name #1 a', sequence: null })
  })

  it('removes the sequence at the end, not the same text earlier in the name', () => {
    expect(parse('Agent #7 Files #7')).to.deep.equal({ name: 'Agent #7 Files', sequence: '7' })
    expect(parse('Mission #2 #2')).to.deep.equal({ name: 'Mission #2', sequence: '2' })
  })

  it('ignores whitespace around the value and before the sequence', () => {
    expect(parse(' Name #2 ')).to.deep.equal({ name: 'Name', sequence: '2' })
    expect(parse('Name  #3')).to.deep.equal({ name: 'Name', sequence: '3' })
    expect(parse('  Name  ')).to.deep.equal({ name: 'Name', sequence: null })
  })
})
