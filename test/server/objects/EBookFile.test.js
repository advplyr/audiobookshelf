const { expect } = require('chai')
const EBookFile = require('../../../server/objects/files/EBookFile')
const FileMetadata = require('../../../server/objects/metadata/FileMetadata')

const metadata = {
  filename: 'Book.epub',
  ext: '.epub',
  path: '/books/Book.epub',
  relPath: 'Book.epub',
  size: 100,
  mtimeMs: 1,
  ctimeMs: 2,
  birthtimeMs: 3
}

describe('EBookFile', () => {
  it('starts empty and constructs from json', () => {
    const empty = new EBookFile()
    expect(empty.ino).to.equal(null)
    expect(empty.metadata).to.equal(null)
    expect(empty.ebookFormat).to.equal(null)

    const file = new EBookFile({ ino: '1', metadata, addedAt: 10, updatedAt: 20 })
    expect(file.metadata).to.be.instanceOf(FileMetadata)
    expect(file.ebookFormat).to.equal('epub')
    expect(file.isEpub).to.equal(true)
    expect(file.toJSON()).to.deep.equal({ ino: '1', metadata, ebookFormat: 'epub', addedAt: 10, updatedAt: 20 })
  })

  it('keeps an explicit ebookFormat over the file extension', () => {
    const file = new EBookFile({ ino: '1', metadata, ebookFormat: 'pdf', addedAt: 10, updatedAt: 20 })
    expect(file.ebookFormat).to.equal('pdf')
    expect(file.isEpub).to.equal(false)
  })

  it('setData copies the library file without sharing its metadata', () => {
    const libraryFile = { ino: '9', metadata: new FileMetadata(metadata) }
    const file = new EBookFile()
    file.setData(libraryFile)
    expect(file.ino).to.equal('9')
    expect(file.ebookFormat).to.equal('epub')
    expect(file.metadata).to.not.equal(libraryFile.metadata)
    expect(file.metadata.toJSON()).to.deep.equal(metadata)
    expect(file.addedAt).to.be.a('number')
    expect(file.updatedAt).to.be.a('number')
  })

  it('updateFromLibraryFile reports metadata and format changes only', () => {
    const file = new EBookFile({ ino: '1', metadata, addedAt: 10, updatedAt: 20 })
    expect(file.updateFromLibraryFile({ metadata: new FileMetadata(metadata) })).to.equal(false)

    expect(file.updateFromLibraryFile({ metadata: new FileMetadata({ ...metadata, size: 200 }) })).to.equal(true)
    expect(file.metadata.size).to.equal(200)

    const changedFormat = new FileMetadata({ ...metadata, size: 200, filename: 'Book.pdf', ext: '.pdf' })
    expect(file.updateFromLibraryFile({ metadata: changedFormat })).to.equal(true)
    expect(file.ebookFormat).to.equal('pdf')
  })
})
