const Path = require('path')
const { expect } = require('chai')
const sinon = require('sinon')
const { Sequelize } = require('sequelize')

const Database = require('../../../server/Database')
const BookScanner = require('../../../server/scanner/BookScanner')
const AudioFileScanner = require('../../../server/scanner/AudioFileScanner')
const LibraryItemScanData = require('../../../server/scanner/LibraryItemScanData')
const LibraryFile = require('../../../server/objects/files/LibraryFile')
const AudioFile = require('../../../server/objects/files/AudioFile')
const parseEbookMetadata = require('../../../server/utils/parsers/parseEbookMetadata')

describe('BookScanner ebook selection', () => {
  let library
  let folder
  let libraryScan
  let previousSettings
  let previousGlobalSettings
  let previousSequelize

  function file(filename, isSupplementary = null) {
    return new LibraryFile({
      ino: filename,
      isSupplementary,
      addedAt: 1000,
      updatedAt: 1000,
      metadata: {
        filename,
        ext: Path.extname(filename),
        path: `/books/Test Book/${filename}`,
        relPath: filename,
        size: 100,
        mtimeMs: 1000,
        ctimeMs: 1000,
        birthtimeMs: 1000
      }
    })
  }

  function audioFile(libraryFile) {
    return new AudioFile({ ...new LibraryFile(libraryFile).toJSON(), duration: 60, chapters: [], metaTags: {} })
  }

  function scanData(files) {
    return new LibraryItemScanData({
      libraryId: library.id,
      libraryFolderId: folder.id,
      mediaType: 'book',
      ino: 'book-directory',
      path: '/books/Test Book',
      relPath: 'Test Book',
      isFile: false,
      mtimeMs: 1000,
      ctimeMs: 1000,
      birthtimeMs: 1000,
      mediaMetadata: {},
      libraryFiles: files
    })
  }

  async function existingBook(ebooks, primary = null) {
    const audio = file('book.m4b')
    const book = await Database.bookModel.create({
      title: 'Test Book',
      coverPath: '/covers/test.jpg',
      audioFiles: [audioFile(audio).toJSON()],
      ebookFile: primary ? { ...primary.toJSON(), ebookFormat: primary.metadata.format } : null,
      duration: 60,
      tags: [],
      narrators: [],
      genres: [],
      chapters: []
    })
    return Database.libraryItemModel.create({
      ...scanData([audio, ...ebooks]).libraryItemObject,
      libraryFiles: [audio, ...ebooks].map((lf) => lf.toJSON()),
      mediaId: book.id,
      isMissing: false
    })
  }

  async function rescan(item, files, settings = {}) {
    const data = scanData(files)
    // Disk scans do not carry the supplementary flag saved in the database.
    await data.checkLibraryItemData(item, libraryScan)
    await BookScanner.rescanExistingBookLibraryItem(item, data, settings, libraryScan)
    await item.reload()
    return { book: await item.getMedia(), data }
  }

  beforeEach(async () => {
    previousSettings = Database.serverSettings
    previousGlobalSettings = global.ServerSettings
    previousSequelize = Database.sequelize
    Database.serverSettings = { scannerFindCovers: false }
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.slice(1)}` : '')
    await Database.buildModels()
    library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
    folder = await Database.libraryFolderModel.create({ path: '/books', libraryId: library.id })
    libraryScan = { addLog: sinon.stub(), authorsRemovedFromBooks: [], seriesRemovedFromBooks: [] }

    sinon.stub(parseEbookMetadata, 'parse').resolves(null)
    sinon.stub(BookScanner, 'getBookMetadataFromScanData').resolves({
      title: 'Test Book',
      coverPath: '/covers/test.jpg',
      authors: [],
      series: [],
      tags: [],
      narrators: [],
      genres: []
    })
    sinon.stub(BookScanner, 'saveMetadataFile').resolves()
    sinon.stub(AudioFileScanner, 'executeMediaFileScans').callsFake(async (type, data, files) => files.map(audioFile))
    sinon.stub(AudioFileScanner, 'runSmartTrackOrder').callsFake((path, files) => files)
    for (const name of ['Narrators', 'Genres', 'Tags', 'Publisher', 'Language', 'PublishedDecade']) {
      sinon.stub(Database, `add${name}ToFilterData`)
    }
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.close()
    Database.sequelize = previousSequelize
    Database.serverSettings = previousSettings
    global.ServerSettings = previousGlobalSettings
  })

  it('preserves a supplementary ebook when an uploaded audio file replaces the previous audio', async () => {
    const item = await existingBook([file('book.epub', true)])
    const replacement = file('book.m4b')
    replacement.ino = 'replacement-audio'
    replacement.metadata.size = 200
    const { book } = await rescan(item, [replacement, file('book.epub')])

    expect(book.audioFiles[0].ino).to.equal('replacement-audio')
    expect(book.ebookFile).to.equal(null)
    expect(item.libraryFiles.find((lf) => lf.ino === 'book.epub').isSupplementary).to.equal(true)
  })

  it('preserves supplementary ebooks on a rescan with no file changes', async () => {
    const item = await existingBook([file('book.epub', true), file('notes.pdf', true)])
    const { book } = await rescan(item, [file('book.m4b'), file('book.epub'), file('notes.pdf')])

    expect(book.ebookFile).to.equal(null)
    expect(item.libraryFiles.filter((lf) => lf.fileType === 'ebook').every((lf) => lf.isSupplementary)).to.equal(true)
  })

  it('preserves the supplementary choice when the ebook inode changes at the same path', async () => {
    const item = await existingBook([file('book.epub', true)])
    const replacement = file('book.epub')
    replacement.ino = 'replacement-ebook'
    const { book } = await rescan(item, [file('book.m4b'), replacement])

    expect(book.ebookFile).to.equal(null)
    expect(item.libraryFiles.find((lf) => lf.ino === 'replacement-ebook').isSupplementary).to.equal(true)
  })

  it('selects a newly added PDF instead of promoting an existing supplementary EPUB', async () => {
    const item = await existingBook([file('book.epub', true)])
    const { book, data } = await rescan(item, [file('book.m4b'), file('book.epub'), file('new.pdf')])

    expect(data.ebookLibraryFilesAdded[0].isSupplementary).to.equal(true)
    expect(book.ebookFile.ino).to.equal('new.pdf')
    expect(item.libraryFiles.find((lf) => lf.ino === 'book.epub').isSupplementary).to.equal(true)
    expect(item.libraryFiles.find((lf) => lf.ino === 'new.pdf').isSupplementary).to.equal(false)
  })

  it('prefers EPUB among newly added ebooks when no primary ebook is set', async () => {
    const item = await existingBook([])
    const { book } = await rescan(item, [file('book.m4b'), file('notes.pdf'), file('book.epub')])

    expect(book.ebookFile.ino).to.equal('book.epub')
    expect(book.ebookFile.ebookFormat).to.equal('epub')
  })

  it('keeps the existing primary ebook when a new EPUB is added', async () => {
    const primary = file('book.pdf', false)
    const item = await existingBook([primary], primary)
    const { book } = await rescan(item, [file('book.m4b'), file('book.pdf'), file('new.epub')])

    expect(book.ebookFile.ino).to.equal('book.pdf')
    expect(item.libraryFiles.find((lf) => lf.ino === 'new.epub').isSupplementary).to.equal(true)
  })

  it('does not promote a supplementary ebook after the primary ebook is removed', async () => {
    const primary = file('book.epub', false)
    const item = await existingBook([primary, file('notes.pdf', true)], primary)
    const { book } = await rescan(item, [file('book.m4b'), file('notes.pdf')])

    expect(book.ebookFile).to.equal(null)
    expect(item.libraryFiles.find((lf) => lf.ino === 'notes.pdf').isSupplementary).to.equal(true)
  })

  it('does not select a primary ebook in an audiobooks-only library', async () => {
    const item = await existingBook([])
    const { book } = await rescan(item, [file('book.m4b'), file('book.epub')], { audiobooksOnly: true })

    expect(book.ebookFile).to.equal(null)
    expect(item.libraryFiles.find((lf) => lf.ino === 'book.epub').isSupplementary).to.equal(true)
  })

  it('still selects an EPUB as primary when first importing a book', async () => {
    const item = await BookScanner.scanNewBookLibraryItem(scanData([file('book.m4b'), file('notes.pdf'), file('book.epub')]), {}, libraryScan)
    await item.reload()
    const book = await item.getMedia()

    expect(book.ebookFile.ino).to.equal('book.epub')
    expect(item.libraryFiles.find((lf) => lf.ino === 'book.epub').isSupplementary).to.equal(false)
    expect(item.libraryFiles.find((lf) => lf.ino === 'notes.pdf').isSupplementary).to.equal(true)
  })
})
