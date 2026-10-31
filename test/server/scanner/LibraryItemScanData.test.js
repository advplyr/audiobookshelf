const { expect } = require('chai')
const sinon = require('sinon')
const packageJson = require('../../../package.json')
const { LogLevel } = require('../../../server/utils/constants')
const LibraryFile = require('../../../server/objects/files/LibraryFile')
const LibraryItemScanData = require('../../../server/scanner/LibraryItemScanData')

function fileMetadata(filename, extra = {}) {
  const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : ''
  return { filename, ext, path: `/lib/item/${filename}`, relPath: `item/${filename}`, size: 10, mtimeMs: 1, ctimeMs: 2, birthtimeMs: 3, ...extra }
}

function libraryFile(filename, extra = {}, ino = `ino-${filename}`) {
  return new LibraryFile({ ino, metadata: fileMetadata(filename, extra), isSupplementary: null, addedAt: 1, updatedAt: 1 })
}

function plainFile(filename, extra = {}, ino = `ino-${filename}`) {
  return { ino, metadata: fileMetadata(filename, extra), isSupplementary: null, addedAt: 1, updatedAt: 1 }
}

function scanData(files = [], overrides = {}) {
  return new LibraryItemScanData({
    libraryFolderId: 'folder-1',
    libraryId: 'lib-1',
    mediaType: 'book',
    ino: 'item-ino',
    mtimeMs: 100,
    ctimeMs: 200,
    birthtimeMs: 300,
    path: '/lib/item',
    relPath: 'item',
    isFile: false,
    mediaMetadata: { title: 'Title' },
    libraryFiles: files,
    ...overrides
  })
}

function existingItem(files = []) {
  return {
    libraryFolderId: 'folder-1',
    ino: 'item-ino',
    path: '/lib/item',
    relPath: 'item',
    isFile: false,
    mtime: 100,
    ctime: 200,
    birthtime: 300,
    isMissing: false,
    size: 0,
    lastScan: 0,
    lastScanVersion: '0',
    libraryFiles: files,
    changed: sinon.stub().returns(['x']),
    save: sinon.stub().resolves()
  }
}

describe('LibraryItemScanData', () => {
  it('constructor copies the scanned data and starts with no file changes', () => {
    const files = [libraryFile('a.mp3')]
    const data = scanData(files)
    expect(data.libraryFolderId).to.equal('folder-1')
    expect(data.libraryId).to.equal('lib-1')
    expect(data.mediaType).to.equal('book')
    expect(data.ino).to.equal('item-ino')
    expect(data.isFile).to.equal(false)
    expect(data.mediaMetadata).to.deep.equal({ title: 'Title' })
    expect(data.libraryFiles).to.equal(files)
    expect(data.libraryFilesRemoved).to.deep.equal([])
    expect(data.libraryFilesAdded).to.deep.equal([])
    expect(data.libraryFilesModified).to.deep.equal([])
    expect(data.hasChanges).to.equal(undefined)
    expect(data.hasPathChange).to.equal(undefined)
  })

  it('libraryItemObject builds the data used to create a library item and sums file sizes', () => {
    const data = scanData([libraryFile('a.mp3', { size: 5 }), libraryFile('b.mp3', { size: '7' }), libraryFile('c.txt', { size: 'abc' })])
    const obj = data.libraryItemObject
    expect(obj).to.include({
      ino: 'item-ino',
      path: '/lib/item',
      relPath: 'item',
      mediaType: 'book',
      isFile: false,
      mtime: 100,
      ctime: 200,
      birthtime: 300,
      lastScanVersion: packageJson.version,
      libraryId: 'lib-1',
      libraryFolderId: 'folder-1',
      size: 12
    })
    expect(obj.lastScan).to.be.a('number')
    expect(obj.libraryFiles).to.equal(data.libraryFiles)
  })

  describe('file type getters', () => {
    const files = [libraryFile('a.mp3'), libraryFile('B.FLAC'), libraryFile('cover.jpg'), libraryFile('book.epub'), libraryFile('notes.txt'), libraryFile('noext')]

    it('filter the library files by audio, image and ebook extension case insensitively', () => {
      const data = scanData(files)
      expect(data.audioLibraryFiles.map((f) => f.metadata.filename)).to.deep.equal(['a.mp3', 'B.FLAC'])
      expect(data.imageLibraryFiles.map((f) => f.metadata.filename)).to.deep.equal(['cover.jpg'])
      expect(data.ebookLibraryFiles.map((f) => f.metadata.filename)).to.deep.equal(['book.epub'])
    })

    it('filter the removed, added and modified lists the same way', () => {
      const data = scanData([])
      data.libraryFilesRemoved = [plainFile('r.mp3'), plainFile('r.jpg'), plainFile('r.epub'), plainFile('r.txt')]
      data.libraryFilesAdded = [libraryFile('n.mp3'), libraryFile('n.png'), libraryFile('n.pdf'), libraryFile('n.nfo')]
      data.libraryFilesModified = [
        { old: plainFile('m.m4b'), new: plainFile('m.m4b') },
        { old: plainFile('m.webp'), new: plainFile('m.webp') },
        { old: plainFile('m.mobi'), new: plainFile('m.mobi') },
        { old: plainFile('m.json'), new: plainFile('m.json') }
      ]
      expect(data.audioLibraryFilesRemoved.map((f) => f.metadata.filename)).to.deep.equal(['r.mp3'])
      expect(data.imageLibraryFilesRemoved.map((f) => f.metadata.filename)).to.deep.equal(['r.jpg'])
      expect(data.ebookLibraryFilesRemoved.map((f) => f.metadata.filename)).to.deep.equal(['r.epub'])
      expect(data.audioLibraryFilesAdded.map((f) => f.metadata.filename)).to.deep.equal(['n.mp3'])
      expect(data.imageLibraryFilesAdded.map((f) => f.metadata.filename)).to.deep.equal(['n.png'])
      expect(data.ebookLibraryFilesAdded.map((f) => f.metadata.filename)).to.deep.equal(['n.pdf'])
      expect(data.audioLibraryFilesModified.map((f) => f.old.metadata.filename)).to.deep.equal(['m.m4b'])
      expect(data.imageLibraryFilesModified.map((f) => f.old.metadata.filename)).to.deep.equal(['m.webp'])
      expect(data.ebookLibraryFilesModified.map((f) => f.old.metadata.filename)).to.deep.equal(['m.mobi'])
    })

    it('report whether there were library file or audio file changes', () => {
      const data = scanData([])
      expect(data.hasLibraryFileChanges).to.equal(0)
      expect(data.hasAudioFileChanges).to.equal(false)
      data.libraryFilesRemoved = [plainFile('r.txt')]
      data.libraryFilesAdded = [libraryFile('n.txt')]
      expect(data.hasLibraryFileChanges).to.equal(2)
      expect(data.hasAudioFileChanges).to.equal(false)
      data.libraryFilesAdded.push(libraryFile('n.mp3'))
      expect(data.hasAudioFileChanges).to.equal(true)
    })
  })

  it('finds the special metadata files', () => {
    const desc = libraryFile('desc.txt')
    const reader = libraryFile('reader.txt')
    const abs = libraryFile('metadata.abs')
    const json = libraryFile('metadata.json')
    const opf = libraryFile('content.OPF')
    const nfo = libraryFile('info.Nfo')
    const data = scanData([libraryFile('a.mp3'), desc, reader, abs, json, opf, nfo])
    expect(data.descTxtLibraryFile).to.equal(desc)
    expect(data.readerTxtLibraryFile).to.equal(reader)
    expect(data.metadataAbsLibraryFile).to.equal(abs)
    expect(data.metadataJsonLibraryFile).to.equal(json)
    expect(data.metadataOpfLibraryFile).to.equal(opf)
    expect(data.metadataNfoLibraryFile).to.equal(nfo)
    expect(scanData([libraryFile('a.mp3')]).descTxtLibraryFile).to.equal(undefined)
    expect(scanData([libraryFile('a.mp3')]).metadataJsonLibraryFile).to.equal(undefined)
  })

  describe('checkLibraryItemData', () => {
    let libraryScan

    beforeEach(() => {
      libraryScan = { addLog: sinon.spy() }
    })

    it('returns false and does not save when nothing changed', async () => {
      const files = [libraryFile('a.mp3')]
      const item = existingItem([plainFile('a.mp3')])
      const data = scanData(files)
      expect(await data.checkLibraryItemData(item, libraryScan)).to.equal(false)
      expect(item.save.called).to.equal(false)
      expect(data.hasChanges).to.equal(false)
      expect(data.hasPathChange).to.equal(false)
      expect(data.libraryFilesAdded).to.deep.equal([])
      expect(data.libraryFilesRemoved).to.deep.equal([])
      expect(data.libraryFilesModified).to.deep.equal([])
    })

    it('updates changed item keys, flags path changes and saves', async () => {
      const item = existingItem([plainFile('a.mp3')])
      const data = scanData([libraryFile('a.mp3')], { relPath: 'moved', libraryFolderId: 'folder-2' })
      expect(await data.checkLibraryItemData(item, libraryScan)).to.equal(true)
      expect(item.relPath).to.equal('moved')
      expect(item.libraryFolderId).to.equal('folder-2')
      expect(data.hasChanges).to.equal(true)
      expect(data.hasPathChange).to.equal(true)
      expect(item.save.calledOnce).to.equal(true)
      expect(item.lastScanVersion).to.equal(packageJson.version)
      expect(item.lastScan).to.be.a('number').and.greaterThan(0)
      expect(libraryScan.addLog.calledWith(LogLevel.DEBUG, 'Library item "item" key "relPath" changed from "item" to "moved"')).to.equal(true)
    })

    it('does not flag a path change when only the inode changed', async () => {
      const item = existingItem([plainFile('a.mp3')])
      const data = scanData([libraryFile('a.mp3')], { ino: 'new-ino' })
      expect(await data.checkLibraryItemData(item, libraryScan)).to.equal(true)
      expect(item.ino).to.equal('new-ino')
      expect(data.hasPathChange).to.equal(false)
    })

    it('updates mtime, ctime and birthtime and clears the missing flag', async () => {
      const item = existingItem([plainFile('a.mp3')])
      item.mtime = new Date(5)
      item.ctime = null
      item.birthtime = 1
      item.isMissing = true
      const data = scanData([libraryFile('a.mp3')])
      expect(await data.checkLibraryItemData(item, libraryScan)).to.equal(true)
      expect(item.mtime).to.equal(100)
      expect(item.ctime).to.equal(200)
      expect(item.birthtime).to.equal(300)
      expect(item.isMissing).to.equal(false)
      expect(libraryScan.addLog.calledWith(LogLevel.DEBUG, 'Library item "item" was missing but now found')).to.equal(true)
    })

    it('detects removed, added and modified library files and recalculates the size', async () => {
      const removed = plainFile('gone.mp3')
      const kept = plainFile('kept.mp3', { size: 10 })
      const item = existingItem([removed, kept])
      const data = scanData([libraryFile('kept.mp3', { size: 40 }), libraryFile('new.mp3', { size: 5 }), libraryFile('book.epub', { size: 1 })])
      expect(await data.checkLibraryItemData(item, libraryScan)).to.equal(true)

      expect(data.libraryFilesRemoved).to.deep.equal([removed])
      expect(data.libraryFilesModified).to.have.length(1)
      expect(data.libraryFilesModified[0].old.metadata.size).to.equal(10)
      expect(data.libraryFilesModified[0].new).to.equal(kept)
      expect(kept.metadata.size).to.equal(40)
      expect(kept.updatedAt).to.be.greaterThan(1)
      expect(data.libraryFilesAdded.map((f) => f.metadata.filename)).to.deep.equal(['new.mp3', 'book.epub'])
      expect(item.libraryFiles.map((f) => f.metadata.filename)).to.deep.equal(['kept.mp3', 'new.mp3', 'book.epub'])
      const addedEbook = item.libraryFiles[2]
      expect(addedEbook.isSupplementary).to.equal(true)
      expect(addedEbook).to.not.be.instanceOf(LibraryFile)
      expect(item.size).to.equal(40 + 5 + 1)
      expect(item.changed.calledWith('libraryFiles', true)).to.equal(true)
      expect(item.save.calledOnce).to.equal(true)
    })

    it('matches a moved library file by inode', async () => {
      const item = existingItem([plainFile('old.mp3', {}, 'same-ino')])
      const data = scanData([libraryFile('renamed.mp3', {}, 'same-ino')])
      expect(await data.checkLibraryItemData(item, libraryScan)).to.equal(true)
      expect(data.libraryFilesRemoved).to.deep.equal([])
      expect(data.libraryFilesAdded).to.deep.equal([])
      expect(data.libraryFilesModified).to.have.length(1)
      expect(item.libraryFiles[0].metadata.path).to.equal('/lib/item/renamed.mp3')
      expect(libraryScan.addLog.calledWith(LogLevel.INFO, sinon.match('matching inode value'))).to.equal(true)
    })
  })

  describe('compareUpdateLibraryFile', () => {
    it('returns false when nothing changed', () => {
      const existing = plainFile('a.mp3')
      const data = scanData([])
      expect(data.compareUpdateLibraryFile('/lib/item', existing, libraryFile('a.mp3'), { addLog: sinon.spy() })).to.equal(false)
      expect(existing.updatedAt).to.equal(1)
    })

    it('copies a changed inode and metadata values and logs each change', () => {
      const existing = plainFile('a.mp3')
      const scanned = libraryFile('a.mp3', { size: 99, path: '/other/a.mp3' }, 'new-ino')
      const libraryScan = { addLog: sinon.spy() }
      expect(scanData([]).compareUpdateLibraryFile('/lib/item', existing, scanned, libraryScan)).to.equal(true)
      expect(existing.ino).to.equal('new-ino')
      expect(existing.metadata.size).to.equal(99)
      expect(existing.metadata.path).to.equal('/other/a.mp3')
      expect(existing.updatedAt).to.be.greaterThan(1)
      expect(libraryScan.addLog.callCount).to.equal(2)
      expect(libraryScan.addLog.firstCall.args[1]).to.equal('Library file for library item "/lib/item" key "path" changed from "/lib/item/a.mp3" to "/other/a.mp3"')
      expect(libraryScan.addLog.secondCall.args[1]).to.equal('Library file "item/a.mp3" for library item "/lib/item" key "size" changed from "10" to "99"')
    })
  })

  describe('checkAudioFileRemoved and checkEbookFileRemoved', () => {
    it('checkAudioFileRemoved matches a removed audio file by path or inode', () => {
      const data = scanData([])
      expect(data.checkAudioFileRemoved({ ino: 'x', metadata: { path: '/p' } })).to.equal(false)
      data.libraryFilesRemoved = [plainFile('gone.mp3', {}, 'ino-gone')]
      expect(data.checkAudioFileRemoved({ ino: 'other', metadata: { path: '/lib/item/gone.mp3' } })).to.equal(true)
      expect(data.checkAudioFileRemoved({ ino: 'ino-gone', metadata: { path: '/elsewhere' } })).to.equal(true)
      expect(data.checkAudioFileRemoved({ ino: 'other', metadata: { path: '/elsewhere' } })).to.equal(false)
    })

    it('checkEbookFileRemoved is true when no ebook is left or none match by path or inode', () => {
      expect(scanData([libraryFile('a.mp3')]).checkEbookFileRemoved({ ino: 'x', metadata: { path: '/p' } })).to.equal(true)
      const data = scanData([libraryFile('book.epub', {}, 'ino-book')])
      expect(data.checkEbookFileRemoved({ ino: 'other', metadata: { path: '/lib/item/book.epub' } })).to.equal(false)
      expect(data.checkEbookFileRemoved({ ino: 'ino-book', metadata: { path: '/elsewhere' } })).to.equal(false)
      expect(data.checkEbookFileRemoved({ ino: 'other', metadata: { path: '/elsewhere' } })).to.equal(true)
    })
  })

  describe('setBookMetadataFromFilenames', () => {
    it('copies title, subtitle, year and asin only when they have values', () => {
      const bookMetadata = { title: 'Old', publishedYear: '1999' }
      scanData([], { mediaMetadata: { title: 'New', subtitle: '', publishedYear: '2020', asin: 'B000' } }).setBookMetadataFromFilenames(bookMetadata)
      expect(bookMetadata).to.deep.equal({ title: 'New', publishedYear: '2020', asin: 'B000' })
    })

    it('copies authors and narrators when present and builds the series list', () => {
      const bookMetadata = { authors: ['Keep'] }
      scanData([], { mediaMetadata: { title: 'T', authors: [], narrators: ['N'], seriesName: 'Saga', seriesSequence: '2' } }).setBookMetadataFromFilenames(bookMetadata)
      expect(bookMetadata).to.deep.equal({ title: 'T', authors: ['Keep'], narrators: ['N'], series: [{ name: 'Saga', sequence: '2' }] })

      const noSequence = {}
      scanData([], { mediaMetadata: { title: 'T', seriesName: 'Saga' } }).setBookMetadataFromFilenames(noSequence)
      expect(noSequence.series).to.deep.equal([{ name: 'Saga', sequence: null }])
    })
  })
})
