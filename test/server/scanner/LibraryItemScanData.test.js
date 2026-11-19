const { expect } = require('chai')
const sinon = require('sinon')

const LibraryItemScanData = require('../../../server/scanner/LibraryItemScanData')
const LibraryFile = require('../../../server/objects/files/LibraryFile')

function libraryFile(path, ino, size = 100) {
  const relPath = path.replace('/books/Book/', '')
  return {
    ino,
    isSupplementary: false,
    addedAt: 1,
    updatedAt: 1,
    metadata: { filename: relPath.split('/').pop(), ext: '.opus', path, relPath, size, mtimeMs: 1, ctimeMs: 1, birthtimeMs: 1 }
  }
}

/** Files found on disk are LibraryFile instances, stored ones are plain JSON */
function scannedFile(path, ino, size) {
  return new LibraryFile(libraryFile(path, ino, size))
}

function existingItem(libraryFiles) {
  return {
    libraryFolderId: 'folder',
    ino: 'dir',
    path: '/books/Book',
    relPath: 'Book',
    isFile: false,
    mtime: new Date(1),
    birthtime: new Date(1),
    ctime: new Date(1),
    isMissing: false,
    libraryFiles,
    changed: () => [],
    save: sinon.stub().resolves()
  }
}

function scanData(libraryFiles) {
  return new LibraryItemScanData({
    libraryFolderId: 'folder',
    libraryId: 'library',
    mediaType: 'book',
    ino: 'dir',
    mtimeMs: 1,
    ctimeMs: 1,
    birthtimeMs: 1,
    path: '/books/Book',
    relPath: 'Book',
    isFile: false,
    mediaMetadata: {},
    libraryFiles
  })
}

const libraryScan = { addLog: () => {} }

describe('LibraryItemScanData.checkLibraryItemData', () => {
  // https://github.com/advplyr/audiobookshelf/issues/4415
  // 1. "c/Book.opus" is created in the item folder (inode 2) and scanned in as a second file
  // 2. "mv c/Book.opus ." replaces "Book.opus" (inode 1) with inode 2 and "c/Book.opus" is gone
  it('does not match a file by inode when that file was already matched by path', async () => {
    const item = existingItem([libraryFile('/books/Book/Book.opus', '1'), libraryFile('/books/Book/c/Book.opus', '2')])
    const data = scanData([scannedFile('/books/Book/Book.opus', '2')])

    await data.checkLibraryItemData(item, libraryScan)

    expect(item.libraryFiles.map((lf) => lf.metadata.path)).to.deep.equal(['/books/Book/Book.opus'])
    expect(item.libraryFiles[0].ino).to.equal('2')
    expect(data.libraryFilesRemoved.map((lf) => lf.metadata.path)).to.deep.equal(['/books/Book/c/Book.opus'])
    expect(data.libraryFilesModified).to.have.length(1)
    expect(data.libraryFilesAdded).to.have.length(0)
    expect(data.checkAudioFileRemoved({ ino: '2', metadata: { path: '/books/Book/c/Book.opus' } })).to.equal(true)
  })

  it('still follows a renamed file by inode', async () => {
    const item = existingItem([libraryFile('/books/Book/old.opus', '1')])
    const data = scanData([scannedFile('/books/Book/new.opus', '1')])

    await data.checkLibraryItemData(item, libraryScan)

    expect(item.libraryFiles.map((lf) => lf.metadata.path)).to.deep.equal(['/books/Book/new.opus'])
    expect(data.libraryFilesRemoved).to.have.length(0)
    expect(data.libraryFilesAdded).to.have.length(0)
    expect(data.libraryFilesModified).to.have.length(1)
  })

  it('matches each scanned file to at most one existing file when inodes repeat', async () => {
    // Two existing records with the same inode (e.g. after an inode was reused) and one file on disk
    const item = existingItem([libraryFile('/books/Book/a.opus', '5'), libraryFile('/books/Book/b.opus', '5')])
    const data = scanData([scannedFile('/books/Book/c.opus', '5')])

    await data.checkLibraryItemData(item, libraryScan)

    expect(item.libraryFiles).to.have.length(1)
    expect(item.libraryFiles[0].metadata.path).to.equal('/books/Book/c.opus')
    expect(data.libraryFilesRemoved).to.have.length(1)
  })
})

describe('BookScanner audio files after a file is replaced (#4415)', () => {
  const { Sequelize } = require('sequelize')
  const Database = require('../../../server/Database')
  const Logger = require('../../../server/Logger')
  const BookScanner = require('../../../server/scanner/BookScanner')
  const AudioFileScanner = require('../../../server/scanner/AudioFileScanner')
  const LibraryScan = require('../../../server/scanner/LibraryScan')
  const AudioFile = require('../../../server/objects/files/AudioFile')

  let libraryItem
  let book
  let libraryScan

  function audioFile(path, ino, duration = 3600) {
    const lf = libraryFile(path, ino)
    return { index: 1, ino, metadata: lf.metadata, addedAt: 1, updatedAt: 1, exclude: false, duration, chapters: [], metaTags: {} }
  }

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
    sinon.stub(Database, 'serverSettings').value({ scannerFindCovers: false })
    for (const level of ['info', 'debug', 'warn', 'error']) sinon.stub(Logger, level)

    const library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
    const folder = await Database.libraryFolderModel.create({ path: '/books', libraryId: library.id })
    book = await Database.bookModel.create({ title: 'Book', audioFiles: [], tags: [], narrators: [], genres: [], chapters: [] })
    libraryItem = await Database.libraryItemModel.create({ path: '/books/Book', relPath: 'Book', ino: 'dir', isFile: false, libraryFiles: [], mediaId: book.id, mediaType: 'book', libraryId: library.id, libraryFolderId: folder.id })
    libraryScan = new LibraryScan()
    libraryScan.library = library

    // ffprobe is not needed: scanned audio files get the inode and path of the library file
    sinon.stub(AudioFileScanner, 'executeMediaFileScans').callsFake(async (mediaType, data, libraryFiles) => libraryFiles.map((lf) => new AudioFile(audioFile(lf.metadata.path, lf.ino))))
    sinon.stub(BookScanner, 'getBookMetadataFromScanData').resolves({ title: 'Book', authors: [], series: [] })
    sinon.stub(BookScanner, 'saveMetadataFile').resolves()
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.sync({ force: true })
  })

  async function rescan(storedLibraryFiles, storedAudioFiles, scannedLibraryFiles) {
    libraryItem.libraryFiles = storedLibraryFiles
    await libraryItem.save()
    book.audioFiles = storedAudioFiles
    book.changed('audioFiles', true)
    await book.save()

    const data = scanData(scannedLibraryFiles)
    data.libraryFolderId = libraryItem.libraryFolderId
    data.libraryId = libraryItem.libraryId
    await data.checkLibraryItemData(libraryItem, libraryScan)
    await BookScanner.rescanExistingBookLibraryItem(libraryItem, data, { audiobooksOnly: true }, libraryScan)
    return Database.bookModel.findByPk(book.id)
  }

  it('keeps one audio file when a moved file replaces the original', async () => {
    const updated = await rescan([libraryFile('/books/Book/Book.opus', '1'), libraryFile('/books/Book/c/Book.opus', '2')], [audioFile('/books/Book/Book.opus', '1'), audioFile('/books/Book/c/Book.opus', '2')], [scannedFile('/books/Book/Book.opus', '2')])
    expect(updated.audioFiles.map((af) => [af.metadata.path, af.ino])).to.deep.equal([['/books/Book/Book.opus', '2']])
    expect(updated.duration).to.equal(3600)
  })

  it('repairs a book that already has duplicate records for the same file', async () => {
    const updated = await rescan([libraryFile('/books/Book/Book.opus', '2'), libraryFile('/books/Book/Book.opus', '2')], [audioFile('/books/Book/Book.opus', '2'), audioFile('/books/Book/Book.opus', '2')], [scannedFile('/books/Book/Book.opus', '2')])
    expect(updated.audioFiles).to.have.length(1)
    expect(updated.duration).to.equal(3600)
    const item = await Database.libraryItemModel.findByPk(libraryItem.id)
    expect(item.libraryFiles).to.have.length(1)
  })
})
