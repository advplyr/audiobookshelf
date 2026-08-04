const Path = require('path')
const chai = require('chai')
const expect = chai.expect
const scanUtils = require('../../../server/utils/scandir')

describe('scanUtils', async () => {
  it('should properly group files into potential book library items', async () => {
    global.isWin = process.platform === 'win32'
    global.ServerSettings = {
      scannerParseSubtitle: true
    }

    const filePaths = [
      'randomfile.txt', // Should be ignored because it's not a book media file
      'Book1.m4b', // Root single file audiobook
      'Book2/audiofile.m4b',
      'Book2/disk 001/audiofile.m4b',
      'Book2/disk 002/audiofile.m4b',
      'Author/Book3/audiofile.mp3',
      'Author/Book3/Disc 1/audiofile.mp3',
      'Author/Book3/Disc 2/audiofile.mp3',
      'Author/Series/Book4/cover.jpg',
      'Author/Series/Book4/CD1/audiofile.mp3',
      'Author/Series/Book4/CD2/audiofile.mp3',
      'Author/Series2/Book5/deeply/nested/cd 01/audiofile.mp3',
      'Author/Series2/Book5/deeply/nested/cd 02/audiofile.mp3',
      'Author/Series2/Book5/randomfile.js' // Should be ignored because it's not a book media file
    ]

    // Create fileItems to match the format of fileUtils.recurseFiles
    const fileItems = []
    for (const filePath of filePaths) {
      const dirname = Path.dirname(filePath)
      fileItems.push({
        name: Path.basename(filePath),
        reldirpath: dirname === '.' ? '' : dirname,
        extension: Path.extname(filePath),
        deep: filePath.split('/').length - 1
      })
    }

    const libraryItemGrouping = scanUtils.groupFileItemsIntoLibraryItemDirs('book', fileItems, false)

    expect(libraryItemGrouping).to.deep.equal({
      'Book1.m4b': 'Book1.m4b',
      Book2: ['audiofile.m4b', 'disk 001/audiofile.m4b', 'disk 002/audiofile.m4b'],
      'Author/Book3': ['audiofile.mp3', 'Disc 1/audiofile.mp3', 'Disc 2/audiofile.mp3'],
      'Author/Series/Book4': ['CD1/audiofile.mp3', 'CD2/audiofile.mp3', 'cover.jpg'],
      'Author/Series2/Book5/deeply/nested': ['cd 01/audiofile.mp3', 'cd 02/audiofile.mp3']
    })
  })

  describe('checkItemFilesMatchByIno', () => {
    const makeLibraryFile = (ino, filename) => ({ ino, metadata: { ext: Path.extname(filename), filename } })

    it('should match a single file audiobook folder recreated with the same audio file inode', () => {
      const existingLibraryFiles = [makeLibraryFile('100', 'book.m4b'), makeLibraryFile('101', 'cover.jpg')]
      expect(scanUtils.checkItemFilesMatchByIno(existingLibraryFiles, ['100', '999'])).to.be.true
    })

    it('should match when a majority of media files kept their inodes', () => {
      const existingLibraryFiles = [makeLibraryFile('100', 'cd1.mp3'), makeLibraryFile('101', 'cd2.mp3'), makeLibraryFile('102', 'cd3.mp3')]
      expect(scanUtils.checkItemFilesMatchByIno(existingLibraryFiles, ['100', '101', '999'])).to.be.true
    })

    it('should not match when only a minority of media files kept their inodes', () => {
      const existingLibraryFiles = [makeLibraryFile('100', 'cd1.mp3'), makeLibraryFile('101', 'cd2.mp3'), makeLibraryFile('102', 'cd3.mp3')]
      expect(scanUtils.checkItemFilesMatchByIno(existingLibraryFiles, ['100'])).to.be.false
    })

    it('should ignore non-media files when matching', () => {
      const existingLibraryFiles = [makeLibraryFile('100', 'book.m4b'), makeLibraryFile('101', 'cover.jpg'), makeLibraryFile('102', 'metadata.opf'), makeLibraryFile('103', 'desc.txt')]
      // Only the audio file inode is present, sidecar files were regenerated with new inodes
      expect(scanUtils.checkItemFilesMatchByIno(existingLibraryFiles, ['100', '201', '202', '203'])).to.be.true
    })

    it('should match an ebook by file inode', () => {
      const existingLibraryFiles = [makeLibraryFile('100', 'book.epub')]
      expect(scanUtils.checkItemFilesMatchByIno(existingLibraryFiles, ['100'])).to.be.true
    })

    it('should not match when the existing item has no media files', () => {
      const existingLibraryFiles = [makeLibraryFile('101', 'cover.jpg'), makeLibraryFile('103', 'desc.txt')]
      expect(scanUtils.checkItemFilesMatchByIno(existingLibraryFiles, ['101', '103'])).to.be.false
    })

    it('should not match when the scanned folder has no matching inodes', () => {
      const existingLibraryFiles = [makeLibraryFile('100', 'book.m4b')]
      expect(scanUtils.checkItemFilesMatchByIno(existingLibraryFiles, ['200', '201'])).to.be.false
    })

    it('should handle empty or missing inputs', () => {
      expect(scanUtils.checkItemFilesMatchByIno([], ['100'])).to.be.false
      expect(scanUtils.checkItemFilesMatchByIno(null, ['100'])).to.be.false
      expect(scanUtils.checkItemFilesMatchByIno([makeLibraryFile('100', 'book.m4b')], null)).to.be.false
      expect(scanUtils.checkItemFilesMatchByIno([{ ino: null, metadata: { ext: '.m4b' } }], ['100'])).to.be.false
    })
  })
})
