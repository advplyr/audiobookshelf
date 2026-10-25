const chai = require('chai')
const expect = chai.expect

const BookScanner = require('../../../server/scanner/BookScanner')
const LibraryItemScanData = require('../../../server/scanner/LibraryItemScanData')
const LibraryFile = require('../../../server/objects/files/LibraryFile')

const ITEM_PATH = '/audiobooks/Author/Book'

function fileMetadata(relPath, overrides = {}) {
  return {
    filename: relPath.split('/').pop(),
    ext: '.m4b',
    path: `${ITEM_PATH}/${relPath}`,
    relPath,
    size: 1151287783,
    mtimeMs: 1770220224585,
    ctimeMs: 1779895182349,
    birthtimeMs: 0,
    ...overrides
  }
}

function libraryFile(ino, relPath, overrides = {}) {
  return new LibraryFile({ ino, metadata: fileMetadata(relPath, overrides), addedAt: 1, updatedAt: 1 })
}

function audioFile(ino, relPath, overrides = {}) {
  return { index: 1, ino, metadata: fileMetadata(relPath, overrides), duration: 72454.671678, chapters: [], exclude: false, manuallyVerified: false }
}

function scanData(libraryFiles) {
  return new LibraryItemScanData({ path: ITEM_PATH, relPath: 'Author/Book', libraryFiles })
}

const libraryScan = { addLog: () => {} }

describe('BookScanner', () => {
  describe('reconcileAudioFileIdentity', () => {
    it('updates an audio file whose inode no longer matches the library file', () => {
      const media = { title: 'Book', audioFiles: [audioFile('14395', 'book.m4b')] }
      const numUpdated = BookScanner.reconcileAudioFileIdentity(media, scanData([libraryFile('281474976727661', 'book.m4b')]), libraryScan)

      expect(numUpdated).to.equal(1)
      expect(media.audioFiles[0].ino).to.equal('281474976727661')
      expect(media.audioFiles[0].duration).to.equal(72454.671678)
      expect(media.audioFiles[0].index).to.equal(1)
    })

    it('updates a stale path when the parent directory was renamed and the inode did not change', () => {
      const stale = audioFile('281474976727661', 'book.m4b', { path: '/audiobooks/Old Author/Book/book.m4b' })
      const media = { title: 'Book', audioFiles: [stale] }
      const numUpdated = BookScanner.reconcileAudioFileIdentity(media, scanData([libraryFile('281474976727661', 'book.m4b')]), libraryScan)

      expect(numUpdated).to.equal(1)
      expect(media.audioFiles[0].metadata.path).to.equal(`${ITEM_PATH}/book.m4b`)
    })

    it('updates a file whose stale inode is currently held by another file in the item', () => {
      const media = { title: 'Book', audioFiles: [audioFile('999', 'book.m4b')] }
      const files = [libraryFile('281474976727661', 'book.m4b'), libraryFile('999', 'cover.jpg', { ext: '.jpg' })]
      const numUpdated = BookScanner.reconcileAudioFileIdentity(media, scanData(files), libraryScan)

      expect(numUpdated).to.equal(1)
      expect(media.audioFiles[0].ino).to.equal('281474976727661')
    })

    it('repairs both sides of a hardlinked pair that share an inode', () => {
      const media = { title: 'Book', audioFiles: [audioFile('101', 'a.m4b'), audioFile('101', 'b.m4b')] }
      const files = [libraryFile('202', 'a.m4b'), libraryFile('202', 'b.m4b')]
      const numUpdated = BookScanner.reconcileAudioFileIdentity(media, scanData(files), libraryScan)

      expect(numUpdated).to.equal(2)
      expect(media.audioFiles.map((af) => af.ino)).to.deep.equal(['202', '202'])
    })

    it('does not resolve two audio files to the same library file', () => {
      const media = { title: 'Book', audioFiles: [audioFile('101', 'book.m4b'), audioFile('102', 'book.m4b')] }
      const numUpdated = BookScanner.reconcileAudioFileIdentity(media, scanData([libraryFile('202', 'book.m4b')]), libraryScan)

      expect(numUpdated).to.equal(1)
      expect(media.audioFiles[0].ino).to.equal('202')
      expect(media.audioFiles[1].ino).to.equal('102')
    })

    it('leaves a file alone when the size differs', () => {
      const media = { title: 'Book', audioFiles: [audioFile('14395', 'book.m4b')] }
      const numUpdated = BookScanner.reconcileAudioFileIdentity(media, scanData([libraryFile('281474976727661', 'book.m4b', { size: 999 })]), libraryScan)

      expect(numUpdated).to.equal(0)
      expect(media.audioFiles[0].ino).to.equal('14395')
    })

    it('leaves a file alone when the mtime differs', () => {
      const media = { title: 'Book', audioFiles: [audioFile('14395', 'book.m4b')] }
      const numUpdated = BookScanner.reconcileAudioFileIdentity(media, scanData([libraryFile('281474976727661', 'book.m4b', { mtimeMs: 1 })]), libraryScan)

      expect(numUpdated).to.equal(0)
      expect(media.audioFiles[0].ino).to.equal('14395')
    })

    it('leaves a file alone when two library files share its relPath', () => {
      const media = { title: 'Book', audioFiles: [audioFile('14395', 'book.m4b', { path: '/audiobooks/Old Author/Book/book.m4b' })] }
      const duplicated = [libraryFile('281474976727661', 'CD1/book.m4b'), libraryFile('281474976727662', 'CD2/book.m4b')]
      duplicated.forEach((lf) => (lf.metadata.relPath = 'book.m4b'))
      const numUpdated = BookScanner.reconcileAudioFileIdentity(media, scanData(duplicated), libraryScan)

      expect(numUpdated).to.equal(0)
      expect(media.audioFiles[0].ino).to.equal('14395')
    })

    it('ignores non-audio library files', () => {
      const media = { title: 'Book', audioFiles: [audioFile('14395', 'cover.jpg', { ext: '.jpg' })] }
      const numUpdated = BookScanner.reconcileAudioFileIdentity(media, scanData([libraryFile('281474976727661', 'cover.jpg', { ext: '.jpg' })]), libraryScan)

      expect(numUpdated).to.equal(0)
    })

    it('does nothing when the stored identity already matches', () => {
      const media = { title: 'Book', audioFiles: [audioFile('281474976727661', 'book.m4b')] }
      const numUpdated = BookScanner.reconcileAudioFileIdentity(media, scanData([libraryFile('281474976727661', 'book.m4b')]), libraryScan)

      expect(numUpdated).to.equal(0)
    })

    it('does nothing on a second pass', () => {
      const media = { title: 'Book', audioFiles: [audioFile('14395', 'book.m4b')] }
      const data = scanData([libraryFile('281474976727661', 'book.m4b')])

      expect(BookScanner.reconcileAudioFileIdentity(media, data, libraryScan)).to.equal(1)
      expect(BookScanner.reconcileAudioFileIdentity(media, data, libraryScan)).to.equal(0)
    })
  })
})
