const { expect } = require('chai')
const fs = require('fs')
const os = require('os')
const Path = require('path')
const OpfFileScanner = require('../../../server/scanner/OpfFileScanner')

const opf = `<?xml version="1.0"?>
<package xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata>
    <dc:title>OPF Title</dc:title>
    <dc:creator opf:role="aut">OPF Author</dc:creator>
    <dc:publisher>OPF Pub</dc:publisher>
    <dc:language>en</dc:language>
  </metadata>
</package>`

describe('OpfFileScanner', () => {
  let dir

  beforeEach(() => {
    dir = fs.mkdtempSync(Path.join(os.tmpdir(), 'abs-opf-'))
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  function opfFile(text) {
    const path = Path.join(dir, 'metadata.opf')
    fs.writeFileSync(path, text)
    return { metadata: { path } }
  }

  it('copies parsed values onto the book metadata', async () => {
    const bookMetadata = { title: 'Old', tags: ['keep'] }
    await OpfFileScanner.scanBookOpfFile(opfFile(opf), bookMetadata)
    expect(bookMetadata.title).to.equal('OPF Title')
    expect(bookMetadata.authors).to.deep.equal(['OPF Author'])
    expect(bookMetadata.publisher).to.equal('OPF Pub')
    expect(bookMetadata.language).to.equal('en')
    expect(bookMetadata.tags).to.deep.equal(['keep'])
    expect(bookMetadata).to.not.have.property('sequence')
  })

  it('does not replace existing authors, genres and tags with empty values', async () => {
    const bookMetadata = { authors: ['Existing'], genres: ['Existing'], tags: ['Existing'], narrators: ['Existing'], series: [{ name: 'S', sequence: '1' }] }
    await OpfFileScanner.scanBookOpfFile(opfFile(opf.replace('<dc:creator opf:role="aut">OPF Author</dc:creator>', '')), bookMetadata)
    expect(bookMetadata.authors).to.deep.equal(['Existing'])
    expect(bookMetadata.genres).to.deep.equal(['Existing'])
    expect(bookMetadata.tags).to.deep.equal(['Existing'])
    expect(bookMetadata.narrators).to.deep.equal(['Existing'])
    expect(bookMetadata.series).to.deep.equal([{ name: 'S', sequence: '1' }])
    expect(bookMetadata.title).to.equal('OPF Title')
  })

  it('leaves the book metadata alone when the opf is missing or empty', async () => {
    const bookMetadata = { title: 'Same' }
    await OpfFileScanner.scanBookOpfFile({ metadata: { path: Path.join(dir, 'missing.opf') } }, bookMetadata)
    await OpfFileScanner.scanBookOpfFile(opfFile(''), bookMetadata)
    expect(bookMetadata).to.deep.equal({ title: 'Same' })
  })
})
