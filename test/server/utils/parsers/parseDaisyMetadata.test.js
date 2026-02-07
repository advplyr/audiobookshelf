const chai = require('chai')
const expect = chai.expect
const { parseDaisyMetadata } = require('../../../../server/utils/parsers/parseDaisyMetadata')

describe('parseDaisyMetadata', () => {
  it('returns null if htmlText is empty', () => {
    const result = parseDaisyMetadata('')
    expect(result).to.be.null
  })

  it('parses common metadata values from DAISY ncc.html', () => {
    const nccHtml = `
      <html>
        <head>
          <title>Fallback Title</title>
          <meta name="dc:title" content="The DAISY Book">
          <meta name="dc:creator" content="Jane Doe & Richard Roe">
          <meta name="ncc:narrator" content="Reader One; Reader Two">
          <meta name="dc:publisher" content="Talking Books Inc">
          <meta name="dc:date" content="2021-06-04">
          <meta name="dc:language" content="en">
          <meta name="dc:subject" content="Fiction, Mystery">
          <meta name="ncc:keywords" content="audio; daisy">
          <meta name="dc:identifier" content="ISBN 978-1-4028-9462-6">
          <meta name="dc:identifier:asin" content="ASIN: B012345678">
        </head>
      </html>
    `

    const result = parseDaisyMetadata(nccHtml)
    expect(result.title).to.equal('The DAISY Book')
    expect(result.authors).to.deep.equal(['Jane Doe', 'Richard Roe'])
    expect(result.narrators).to.deep.equal(['Reader One', 'Reader Two'])
    expect(result.publisher).to.equal('Talking Books Inc')
    expect(result.publishedYear).to.equal('2021')
    expect(result.language).to.equal('en')
    expect(result.genres).to.deep.equal(['Fiction', 'Mystery'])
    expect(result.tags).to.deep.equal(['audio', 'daisy'])
    expect(result.isbn).to.equal('978-1-4028-9462-6')
    expect(result.asin).to.equal('B012345678')
  })

  it('falls back to title tag when dc:title is not set', () => {
    const nccHtml = `
      <html>
        <head>
          <title>Title From Head</title>
        </head>
      </html>
    `
    const result = parseDaisyMetadata(nccHtml)
    expect(result.title).to.equal('Title From Head')
  })

  it('parses chapter names from heading entries in ncc.html', () => {
    const nccHtml = `
      <html>
        <body>
          <h1><a href="book.smil#id1">Chapter 1</a></h1>
          <h2><a href="book.smil#id2">Chapter 2: The Road</a></h2>
          <h3>Part 1</h3>
        </body>
      </html>
    `

    const result = parseDaisyMetadata(nccHtml)
    expect(result.chapters).to.deep.equal([
      { title: 'Chapter 1' },
      { title: 'Chapter 2: The Road' },
      { title: 'Part 1' }
    ])
  })
})
