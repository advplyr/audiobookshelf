const chai = require('chai')
const expect = chai.expect
const { parseNfoMetadata } = require('../../../../server/utils/parsers/parseNfoMetadata')

describe('parseNfoMetadata', () => {
  it('returns null if nfoText is empty', () => {
    const result = parseNfoMetadata('')
    expect(result).to.be.null
  })

  it('parses title', () => {
    const nfoText = 'Title: The Great Gatsby'
    const result = parseNfoMetadata(nfoText)
    expect(result.title).to.equal('The Great Gatsby')
  })

  it('parses title with subtitle', () => {
    const nfoText = 'Title: The Great Gatsby: A Novel'
    const result = parseNfoMetadata(nfoText)
    expect(result.title).to.equal('The Great Gatsby')
    expect(result.subtitle).to.equal('A Novel')
  })

  it('parses authors', () => {
    const nfoText = 'Author: F. Scott Fitzgerald'
    const result = parseNfoMetadata(nfoText)
    expect(result.authors).to.deep.equal(['F. Scott Fitzgerald'])
  })

  it('parses multiple authors', () => {
    const nfoText = 'Author: John Steinbeck, Ernest Hemingway'
    const result = parseNfoMetadata(nfoText)
    expect(result.authors).to.deep.equal(['John Steinbeck', 'Ernest Hemingway'])
  })

  it('parses narrators', () => {
    const nfoText = 'Read by: Jake Gyllenhaal'
    const result = parseNfoMetadata(nfoText)
    expect(result.narrators).to.deep.equal(['Jake Gyllenhaal'])
  })

  it('parses multiple narrators', () => {
    const nfoText = 'Read by: Jake Gyllenhaal, Kate Winslet'
    const result = parseNfoMetadata(nfoText)
    expect(result.narrators).to.deep.equal(['Jake Gyllenhaal', 'Kate Winslet'])
  })

  it('parses series name', () => {
    const nfoText = 'Series Name: Harry Potter'
    const result = parseNfoMetadata(nfoText)
    expect(result.series).to.equal('Harry Potter')
  })

  it('parses genre', () => {
    const nfoText = 'Genre: Fiction'
    const result = parseNfoMetadata(nfoText)
    expect(result.genres).to.deep.equal(['Fiction'])
  })

  it('parses multiple genres', () => {
    const nfoText = 'Genre: Fiction, Historical'
    const result = parseNfoMetadata(nfoText)
    expect(result.genres).to.deep.equal(['Fiction', 'Historical'])
  })

  it('parses tags', () => {
    const nfoText = 'Tags: mystery, thriller'
    const result = parseNfoMetadata(nfoText)
    expect(result.tags).to.deep.equal(['mystery', 'thriller'])
  })

  it('parses year from various date fields', () => {
    const nfoText = 'Release Date: 2021-05-01\nBook Copyright: 2021\nRecording Copyright: 2021'
    const result = parseNfoMetadata(nfoText)
    expect(result.publishedYear).to.equal('2021')
  })

  it('parses position in series', () => {
    const nfoText = 'Position in Series: 2'
    const result = parseNfoMetadata(nfoText)
    expect(result.sequence).to.equal('2')
  })

  it('parses abridged flag', () => {
    const nfoText = 'Abridged: No'
    const result = parseNfoMetadata(nfoText)
    expect(result.abridged).to.be.false

    const nfoText2 = 'Unabridged: Yes'
    const result2 = parseNfoMetadata(nfoText2)
    expect(result2.abridged).to.be.false
  })

  it('parses publisher', () => {
    const nfoText = 'Publisher: Penguin Random House'
    const result = parseNfoMetadata(nfoText)
    expect(result.publisher).to.equal('Penguin Random House')
  })

  it('parses ASIN', () => {
    const nfoText = 'ASIN: B08X5JZJLH'
    const result = parseNfoMetadata(nfoText)
    expect(result.asin).to.equal('B08X5JZJLH')
  })

  it('parses language', () => {
    const nfoText = 'Language: eng'
    const result = parseNfoMetadata(nfoText)
    expect(result.language).to.equal('eng')

    const nfoText2 = 'lang: deu'
    const result2 = parseNfoMetadata(nfoText2)
    expect(result2.language).to.equal('deu')
  })

  it('parses description', () => {
    const nfoText = 'Book Description\n=========\nThis is a book.\n It\'s good'
    const result = parseNfoMetadata(nfoText)
    expect(result.description).to.equal('This is a book.\n It\'s good')
  })

  it('no value', () => {
    const nfoText = 'Title:'
    const result = parseNfoMetadata(nfoText)
    expect(result.title).to.be.undefined
  })

  it('no year value', () => {
    const nfoText = "Date:0"
    const result = parseNfoMetadata(nfoText)
    expect(result.publishedYear).to.be.undefined
  })
})