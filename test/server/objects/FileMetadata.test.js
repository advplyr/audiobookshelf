const { expect } = require('chai')
const FileMetadata = require('../../../server/objects/metadata/FileMetadata')

const sample = {
  filename: 'Book One.MP3',
  ext: '.MP3',
  path: '/audiobooks/Author/Book One.MP3',
  relPath: 'Author/Book One.MP3',
  size: 1234,
  mtimeMs: 1,
  ctimeMs: 2,
  birthtimeMs: 3
}

describe('FileMetadata', () => {
  it('starts with null fields and wasModified false when no data is given', () => {
    const metadata = new FileMetadata()
    expect(metadata.toJSON()).to.deep.equal({
      filename: null,
      ext: null,
      path: null,
      relPath: null,
      size: null,
      mtimeMs: null,
      ctimeMs: null,
      birthtimeMs: null
    })
    expect(metadata.wasModified).to.equal(false)
  })

  it('round trips through toJSON and does not serialize wasModified', () => {
    const metadata = new FileMetadata(sample)
    metadata.wasModified = true
    expect(metadata.toJSON()).to.deep.equal(sample)
  })

  it('clone copies the data but resets wasModified', () => {
    const metadata = new FileMetadata(sample)
    metadata.wasModified = true
    const copy = metadata.clone()
    expect(copy).to.not.equal(metadata)
    expect(copy.toJSON()).to.deep.equal(sample)
    expect(copy.wasModified).to.equal(false)
  })

  it('format is lowercase extension without the dot, or empty when there is no extension', () => {
    expect(new FileMetadata(sample).format).to.equal('mp3')
    expect(new FileMetadata().format).to.equal('')
  })

  it('filenameNoExt removes the extension', () => {
    expect(new FileMetadata(sample).filenameNoExt).to.equal('Book One')
  })

  it('update returns true only when a value changes', () => {
    const metadata = new FileMetadata(sample)
    expect(metadata.update({ size: 1234 })).to.equal(false)
    expect(metadata.update({ size: 99 })).to.equal(true)
    expect(metadata.size).to.equal(99)
  })

  it('update and setData ignore keys that do not exist on the object', () => {
    const metadata = new FileMetadata(sample)
    expect(metadata.update({ unknownKey: 'x' })).to.equal(false)
    metadata.setData({ unknownKey: 'x', size: 5 })
    expect(metadata).to.not.have.property('unknownKey')
    expect(metadata.size).to.equal(5)
  })
})
