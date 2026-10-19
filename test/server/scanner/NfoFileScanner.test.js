const { expect } = require('chai')
const fs = require('fs')
const os = require('os')
const Path = require('path')
const NfoFileScanner = require('../../../server/scanner/NfoFileScanner')

describe('NfoFileScanner', () => {
  let dir

  beforeEach(() => {
    dir = fs.mkdtempSync(Path.join(os.tmpdir(), 'abs-nfo-'))
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  function nfoFile(text) {
    const path = Path.join(dir, 'book.nfo')
    fs.writeFileSync(path, text)
    return { metadata: { path } }
  }

  it('copies parsed values onto the book metadata and turns series and sequence into a series list', async () => {
    const bookMetadata = { title: 'Old', tags: ['keep'] }
    await NfoFileScanner.scanBookNfoFile(
      nfoFile(['Title: New Book: The Sub', 'Author: A One, B Two', 'Read By: N One', 'Series Name: Saga', 'Position in Series: 2', 'Genre: Fantasy, Adventure', 'Publisher: Pub', 'ASIN: B000TEST', 'Unabridged: yes', 'Date: 2020-05-01'].join('\n')),
      bookMetadata
    )
    expect(bookMetadata).to.deep.equal({
      title: 'New Book',
      subtitle: 'The Sub',
      authors: ['A One', 'B Two'],
      narrators: ['N One'],
      series: [{ name: 'Saga', sequence: '2' }],
      genres: ['Fantasy', 'Adventure'],
      publisher: 'Pub',
      asin: 'B000TEST',
      publishedYear: '2020',
      tags: ['keep']
    })
    expect(bookMetadata).to.not.have.property('sequence')
  })

  it('only copies abridged when it is true because falsy values are skipped', async () => {
    const abridged = {}
    await NfoFileScanner.scanBookNfoFile(nfoFile('Abridged: yes'), abridged)
    expect(abridged).to.deep.equal({ abridged: true })

    const unabridged = { abridged: true }
    await NfoFileScanner.scanBookNfoFile(nfoFile('Unabridged: yes'), unabridged)
    expect(unabridged).to.deep.equal({ abridged: true })
  })

  it('uses a null sequence when the nfo has a series but no position', async () => {
    const bookMetadata = {}
    await NfoFileScanner.scanBookNfoFile(nfoFile('Series Name: Saga'), bookMetadata)
    expect(bookMetadata.series).to.deep.equal([{ name: 'Saga', sequence: null }])
  })

  it('does not replace existing authors, genres and tags with empty values', async () => {
    const bookMetadata = { authors: ['Existing'], genres: ['Existing'], tags: ['Existing'] }
    await NfoFileScanner.scanBookNfoFile(nfoFile('Title: Only Title'), bookMetadata)
    expect(bookMetadata).to.deep.equal({ authors: ['Existing'], genres: ['Existing'], tags: ['Existing'], title: 'Only Title' })
  })

  it('leaves the book metadata alone when the nfo is missing or empty', async () => {
    const bookMetadata = { title: 'Same' }
    await NfoFileScanner.scanBookNfoFile({ metadata: { path: Path.join(dir, 'missing.nfo') } }, bookMetadata)
    await NfoFileScanner.scanBookNfoFile(nfoFile(''), bookMetadata)
    expect(bookMetadata).to.deep.equal({ title: 'Same' })
  })
})
