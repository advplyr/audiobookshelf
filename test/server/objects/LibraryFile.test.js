const { expect } = require('chai')
const fs = require('fs')
const os = require('os')
const Path = require('path')
const sinon = require('sinon')
const Logger = require('../../../server/Logger')
const LibraryFile = require('../../../server/objects/files/LibraryFile')
const FileMetadata = require('../../../server/objects/metadata/FileMetadata')
const { filePathToPOSIX } = require('../../../server/utils/fileUtils')

function metadataFor(filename) {
  const ext = Path.extname(filename)
  return { filename, ext, path: `/lib/${filename}`, relPath: filename, size: 1, mtimeMs: 1, ctimeMs: 2, birthtimeMs: 3 }
}

describe('LibraryFile', () => {
  afterEach(() => sinon.restore())

  it('starts empty and constructs from json with isSupplementary defaulting to null', () => {
    const empty = new LibraryFile()
    expect(empty.ino).to.equal(null)
    expect(empty.metadata).to.equal(null)

    const file = new LibraryFile({ ino: '1', metadata: metadataFor('a.mp3'), addedAt: 10, updatedAt: 20 })
    expect(file.metadata).to.be.instanceOf(FileMetadata)
    expect(file.isSupplementary).to.equal(null)
    expect(new LibraryFile({ ino: '1', metadata: metadataFor('a.mp3'), isSupplementary: false }).isSupplementary).to.equal(false)
  })

  it('toJSON includes the derived fileType and clone round trips', () => {
    const file = new LibraryFile({ ino: '1', metadata: metadataFor('a.mp3'), isSupplementary: true, addedAt: 10, updatedAt: 20 })
    expect(file.toJSON()).to.deep.equal({
      ino: '1',
      metadata: metadataFor('a.mp3'),
      isSupplementary: true,
      addedAt: 10,
      updatedAt: 20,
      fileType: 'audio'
    })
    const copy = file.clone()
    expect(copy).to.not.equal(file)
    expect(copy.toJSON()).to.deep.equal(file.toJSON())
  })

  it('derives fileType from the extension', () => {
    const typeOf = (filename) => new LibraryFile({ ino: '1', metadata: metadataFor(filename) }).fileType
    expect(typeOf('a.jpg')).to.equal('image')
    expect(typeOf('a.mp3')).to.equal('audio')
    expect(typeOf('a.epub')).to.equal('ebook')
    expect(typeOf('a.txt')).to.equal('text')
    expect(typeOf('a.opf')).to.equal('metadata')
    expect(typeOf('a.zzz')).to.equal('unknown')
  })

  it('exposes media, ebook and opf helpers', () => {
    const make = (filename) => new LibraryFile({ ino: '1', metadata: metadataFor(filename) })
    expect(make('a.mp3').isMediaFile).to.equal(true)
    expect(make('a.epub').isMediaFile).to.equal(true)
    expect(make('a.epub').isEBookFile).to.equal(true)
    expect(make('a.jpg').isMediaFile).to.equal(false)
    expect(make('a.opf').isOPFFile).to.equal(true)
    expect(make('a.mp3').isOPFFile).to.equal(false)
  })

  it('setDataFromPath reads timestamps and path info from disk', async () => {
    const dir = fs.mkdtempSync(Path.join(os.tmpdir(), 'abs-libraryfile-'))
    const filePath = Path.join(dir, 'Book.mp3')
    fs.writeFileSync(filePath, 'abc')
    try {
      const file = new LibraryFile()
      await file.setDataFromPath(filePath, 'Author/Book.mp3')
      expect(file.ino).to.be.a('string').and.not.equal('')
      expect(file.metadata).to.be.instanceOf(FileMetadata)
      expect(file.metadata.filename).to.equal('Book.mp3')
      expect(file.metadata.ext).to.equal('.mp3')
      expect(file.metadata.relPath).to.equal('Author/Book.mp3')
      expect(file.metadata.path).to.equal(filePathToPOSIX(filePath))
      expect(file.metadata.size).to.equal(3)
      expect(file.addedAt).to.be.a('number')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('setDataFromPath leaves the ino unset when the file cannot be read', async () => {
    sinon.stub(Logger, 'error')
    const file = new LibraryFile()
    await file.setDataFromPath('/does/not/exist/Book.mp3', 'Book.mp3')
    expect(file.ino).to.equal(undefined)
    expect(file.metadata.filename).to.equal('Book.mp3')
    expect(file.metadata.size).to.equal(null)
  })
})
