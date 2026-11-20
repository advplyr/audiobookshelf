const chai = require('chai')
const expect = chai.expect
const Path = require('path')
const os = require('os')
const fs = require('fs')
const AbsMetadataFileScanner = require('../../../server/scanner/AbsMetadataFileScanner')

describe('AbsMetadataFileScanner - scanBookMetadataFile', () => {
  let tmpDir

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(Path.join(os.tmpdir(), 'abs-metadata-scanner-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  async function scan(metadata, bookMetadata) {
    const metadataFilePath = Path.join(tmpDir, 'metadata.json')
    fs.writeFileSync(metadataFilePath, JSON.stringify(metadata))
    const libraryScan = { addLog: () => {} }
    const libraryItemData = { metadataJsonLibraryFile: { metadata: { path: metadataFilePath } } }
    await AbsMetadataFileScanner.scanBookMetadataFile(libraryScan, libraryItemData, bookMetadata)
    return bookMetadata
  }

  it('sets values from the metadata file', async () => {
    const bookMetadata = await scan({ subtitle: 'From metadata.json' }, { subtitle: 'From audio file tags' })
    expect(bookMetadata.subtitle).to.equal('From metadata.json')
  })

  it('keeps a value when the key is absent from the metadata file', async () => {
    const bookMetadata = await scan({ title: 'Title' }, { subtitle: 'From audio file tags' })
    expect(bookMetadata.subtitle).to.equal('From audio file tags')
  })

  it('clears a string that is null in the metadata file', async () => {
    const bookMetadata = await scan({ subtitle: null, publisher: null }, { subtitle: 'From audio file tags', publisher: 'Publisher' })
    expect(bookMetadata.subtitle).to.equal(null)
    expect(bookMetadata.publisher).to.equal(null)
  })

  it('does not clear the title', async () => {
    const bookMetadata = await scan({ title: null }, { title: 'From audio file tags' })
    expect(bookMetadata.title).to.equal('From audio file tags')
  })

  it('does not clear a boolean', async () => {
    const bookMetadata = await scan({ explicit: null, abridged: null }, { explicit: true, abridged: true })
    expect(bookMetadata.explicit).to.equal(true)
    expect(bookMetadata.abridged).to.equal(true)
  })

  it('does not clear tags or genres', async () => {
    const bookMetadata = await scan({ tags: null, genres: [] }, { tags: ['tag'], genres: ['genre'] })
    expect(bookMetadata.tags).to.deep.equal(['tag'])
    expect(bookMetadata.genres).to.deep.equal(['genre'])
  })
})
