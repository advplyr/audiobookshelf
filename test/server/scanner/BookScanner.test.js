const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')
const Path = require('path')

const Database = require('../../../server/Database')
const BookScanner = require('../../../server/scanner/BookScanner')
const AudioFileScanner = require('../../../server/scanner/AudioFileScanner')
const LibraryItemScanData = require('../../../server/scanner/LibraryItemScanData')
const LibraryFile = require('../../../server/objects/files/LibraryFile')
const CoverManager = require('../../../server/managers/CoverManager')
const Logger = require('../../../server/Logger')

/**
 * Unit tests for BookScanner.findMissingBookLibraryItemMatch - the "adopt a missing library item
 * instead of creating a duplicate" matching used when a folder is moved/renamed and its inodes change.
 */
describe('BookScanner.findMissingBookLibraryItemMatch', () => {
  let library
  let libraryFolder
  /** minimal LibraryScan stand-in */
  const libraryScan = { addLog() {} }

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'debug')

    library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
    libraryFolder = await Database.libraryFolderModel.create({ path: '/lib', libraryId: library.id })
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.close()
  })

  /** Audio file object shaped like a scanned/stored audio file (only fields the matcher reads) */
  const af = (size, duration) => ({ index: 1, ino: `${size}`, metadata: { size }, duration })

  async function createBookItem({ title, asin = null, duration = 100, audioFiles = [], authors = [], isMissing = true, libraryId = library.id }) {
    const book = await Database.bookModel.create({
      title,
      asin,
      duration,
      audioFiles,
      tags: [],
      narrators: [],
      genres: [],
      chapters: []
    })
    const item = await Database.libraryItemModel.create({
      path: `/lib/${title}`,
      relPath: title,
      mediaId: book.id,
      mediaType: 'book',
      libraryId,
      libraryFolderId: libraryFolder.id,
      isMissing,
      libraryFiles: []
    })
    for (const name of authors) {
      const author = await Database.authorModel.create({ name, libraryId })
      await Database.bookAuthorModel.create({ bookId: book.id, authorId: author.id })
    }
    return { book, item }
  }

  const find = (bookMetadata, scannedAudioFiles, duration) => BookScanner.findMissingBookLibraryItemMatch(library.id, bookMetadata, scannedAudioFiles, duration, libraryScan)

  it('returns null when there are no missing library items', async () => {
    await createBookItem({ title: 'Present Book', isMissing: false, audioFiles: [af(1000, 100)] })
    const result = await find({ asin: null, title: 'Present Book', authors: [] }, [af(1000, 100)], 100)
    expect(result).to.be.null
  })

  describe('tier 1 - ASIN', () => {
    it('matches a missing item by ASIN (case-insensitive) when duration is within 5s', async () => {
      const { item } = await createBookItem({ title: 'Old Title', asin: 'B012345678', duration: 3600, audioFiles: [af(1000, 3600)] })
      const result = await find({ asin: 'b012345678', title: 'Completely Different Title', authors: ['Nobody'] }, [af(999, 3603)], 3603)
      expect(result?.id).to.equal(item.id)
    })

    it('does not match when the ASIN duration differs by more than 5s', async () => {
      await createBookItem({ title: 'Old Title', asin: 'B012345678', duration: 3600, audioFiles: [af(1000, 3600)] })
      const result = await find({ asin: 'B012345678', title: 'Old Title', authors: [] }, [af(1000, 3610)], 3610)
      expect(result).to.be.null
    })

    it('excludes a candidate whose ASIN disagrees, even if title/authors/fingerprint would match', async () => {
      await createBookItem({ title: 'Same Title', asin: 'B000000001', duration: 100, audioFiles: [af(1000, 100)], authors: ['Jane Doe'] })
      const result = await find({ asin: 'B000000002', title: 'Same Title', authors: ['Jane Doe'] }, [af(1000, 100)], 100)
      expect(result).to.be.null
    })

    it('returns null (ambiguous) when two missing items match the same ASIN', async () => {
      await createBookItem({ title: 'Copy A', asin: 'BDUPDUPDUP', duration: 100, audioFiles: [af(1000, 100)] })
      await createBookItem({ title: 'Copy B', asin: 'BDUPDUPDUP', duration: 100, audioFiles: [af(2000, 100)] })
      const result = await find({ asin: 'BDUPDUPDUP', title: 'Copy A', authors: [] }, [af(1000, 100)], 100)
      expect(result).to.be.null
    })
  })

  describe('tier 2 - title + authors', () => {
    it('matches on normalized title and author set when neither side has a comparable ASIN', async () => {
      const { item } = await createBookItem({ title: 'the hobbit.', duration: 500, audioFiles: [af(10, 500)], authors: ['J.R.R. Tolkien', 'Andy Serkis'] })
      // new side: different punctuation/case, author order reversed, no ASIN
      const result = await find({ asin: null, title: 'The Hobbit', authors: ['Andy Serkis', 'JRR Tolkien'] }, [af(10, 502)], 502)
      expect(result?.id).to.equal(item.id)
    })

    it('still matches by title/authors when only the missing item has an ASIN (new side has none)', async () => {
      const { item } = await createBookItem({ title: 'Dune', asin: 'B00ASINONLY', duration: 100, audioFiles: [af(1, 100)], authors: ['Frank Herbert'] })
      const result = await find({ asin: null, title: 'Dune', authors: ['Frank Herbert'] }, [af(9999, 100)], 100)
      expect(result?.id).to.equal(item.id)
    })

    it('does not match when the title matches but the author set differs', async () => {
      await createBookItem({ title: 'Common Title', duration: 100, audioFiles: [af(1, 100)], authors: ['Author One'] })
      const result = await find({ asin: null, title: 'Common Title', authors: ['Author Two'] }, [af(2, 100)], 100)
      expect(result).to.be.null
    })

    it('returns null (ambiguous) when two missing items share the same title and authors', async () => {
      await createBookItem({ title: 'Twin', duration: 100, audioFiles: [af(1, 100)], authors: ['A'] })
      await createBookItem({ title: 'Twin', duration: 100, audioFiles: [af(2, 100)], authors: ['A'] })
      const result = await find({ asin: null, title: 'Twin', authors: ['A'] }, [af(3, 100)], 100)
      expect(result).to.be.null
    })
  })

  describe('tier 3 - file fingerprint', () => {
    it('matches on identical audio file count and size multiset when title/authors differ', async () => {
      const { item } = await createBookItem({
        title: 'Raw Tag Title',
        duration: 300,
        audioFiles: [af(111, 100), af(222, 100), af(333, 100)],
        authors: []
      })
      // new side: curated title, files in a different order, sizes identical
      const result = await find({ asin: null, title: 'Curated Title', authors: ['Someone'] }, [af(333, 100), af(111, 100), af(222, 100)], 300)
      expect(result?.id).to.equal(item.id)
    })

    it('does not match when an audio file size differs', async () => {
      await createBookItem({ title: 'A', duration: 300, audioFiles: [af(111, 100), af(222, 100)] })
      const result = await find({ asin: null, title: 'B', authors: [] }, [af(111, 100), af(999, 100)], 300)
      expect(result).to.be.null
    })

    it('does not match when the audio file count differs', async () => {
      await createBookItem({ title: 'A', duration: 300, audioFiles: [af(111, 100), af(222, 100)] })
      const result = await find({ asin: null, title: 'B', authors: [] }, [af(111, 100), af(222, 100), af(333, 100)], 300)
      expect(result).to.be.null
    })

    it('returns null (ambiguous) when two missing items share the same fingerprint', async () => {
      await createBookItem({ title: 'One', duration: 100, audioFiles: [af(500, 100)] })
      await createBookItem({ title: 'Two', duration: 100, audioFiles: [af(500, 100)] })
      const result = await find({ asin: null, title: 'Three', authors: [] }, [af(500, 100)], 100)
      expect(result).to.be.null
    })
  })

  it('does not fall through to fingerprint matching when the new folder has no audio files', async () => {
    await createBookItem({ title: 'Ebook Only', duration: 0, audioFiles: [] })
    const result = await find({ asin: null, title: 'Something Else', authors: [] }, [], 0)
    expect(result).to.be.null
  })

  it('ignores a matching item in a different library', async () => {
    const otherLibrary = await Database.libraryModel.create({ name: 'Other', mediaType: 'book' })
    await Database.libraryFolderModel.create({ path: '/other', libraryId: otherLibrary.id })
    await createBookItem({ title: 'Cross Library', asin: 'BXLIBXLIBX', duration: 100, audioFiles: [af(1, 100)], libraryId: otherLibrary.id })
    const result = await find({ asin: 'BXLIBXLIBX', title: 'Cross Library', authors: [] }, [af(1, 100)], 100)
    expect(result).to.be.null
  })

  it('ignores a present (non-missing) item even if metadata matches exactly', async () => {
    await createBookItem({ title: 'Still Here', asin: 'BPRESENT00', duration: 100, audioFiles: [af(1, 100)], isMissing: false })
    const result = await find({ asin: 'BPRESENT00', title: 'Still Here', authors: [] }, [af(1, 100)], 100)
    expect(result).to.be.null
  })
})

/**
 * Unit tests for BookScanner.rescanExistingBookLibraryItem when a rescan leaves the book with no media files -
 * the last known audio files & duration are kept so the missing item can still be matched when the files show
 * up in another folder (e.g. files moved one by one while the old folder is left behind).
 */
describe('BookScanner.rescanExistingBookLibraryItem - item left with no media files', () => {
  let library
  let libraryFolder
  let libraryScan

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
    Database.serverSettings = { scannerFindCovers: false }
    global.MetadataPath = '/metadata'

    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'debug')
    sinon.stub(BookScanner, 'saveMetadataFile').resolves()
    sinon.stub(CoverManager, 'saveEmbeddedCoverArt').resolves(null)
    sinon.stub(AudioFileScanner, 'runSmartTrackOrder').callsFake((relPath, audioFiles) => audioFiles)
    sinon.stub(AudioFileScanner, 'executeMediaFileScans').callsFake(async (mediaType, libraryItemData, libraryFiles) => libraryFiles.map((f) => af(f, 100)))

    /** minimal LibraryScan stand-in */
    libraryScan = { addLog() {}, seriesRemovedFromBooks: [], authorsRemovedFromBooks: [], authorsNumBooksChangedIds: new Set() }

    library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
    libraryFolder = await Database.libraryFolderModel.create({ path: '/lib', libraryId: library.id })
  })

  afterEach(async () => {
    sinon.restore()
    Database.serverSettings = null
    await Database.sequelize.close()
  })

  /** Library file as scanned from disk */
  const lf = (dir, filename, ino, size) =>
    new LibraryFile({
      ino,
      metadata: { filename, ext: Path.extname(filename), path: `/lib/${dir}/${filename}`, relPath: filename, size, mtimeMs: 0, ctimeMs: 0, birthtimeMs: 0 },
      addedAt: 0,
      updatedAt: 0
    })
  /** Audio file object as stored on the book / returned from an audio file scan */
  const af = (libraryFile, duration) => ({ ...libraryFile.toJSON(), duration, metaTags: {}, chapters: [] })

  const scanData = (dir, libraryFiles) =>
    new LibraryItemScanData({
      libraryFolderId: libraryFolder.id,
      libraryId: library.id,
      mediaType: 'book',
      ino: `ino-${dir}`,
      mtimeMs: 0,
      ctimeMs: 0,
      birthtimeMs: 0,
      path: `/lib/${dir}`,
      relPath: dir,
      isFile: false,
      mediaMetadata: { title: 'Moved Book' },
      libraryFiles
    })

  async function createBookItem(libraryFiles) {
    const audioLibraryFiles = libraryFiles.filter((f) => f.fileType === 'audio')
    const book = await Database.bookModel.create({
      title: 'Moved Book',
      duration: audioLibraryFiles.length * 100,
      audioFiles: audioLibraryFiles.map((f) => af(f, 100)),
      tags: [],
      narrators: [],
      genres: [],
      chapters: []
    })
    return Database.libraryItemModel.create({
      ino: 'ino-Old',
      path: '/lib/Old',
      relPath: 'Old',
      mediaId: book.id,
      mediaType: 'book',
      libraryId: library.id,
      libraryFolderId: libraryFolder.id,
      isMissing: false,
      libraryFiles: libraryFiles.map((f) => f.toJSON())
    })
  }

  /** Same steps as LibraryItemScanner.scanLibraryItem */
  async function rescan(libraryItemId, libraryItemData) {
    const libraryItem = await Database.libraryItemModel.findByPk(libraryItemId)
    await libraryItemData.checkLibraryItemData(libraryItem, libraryScan)
    return BookScanner.rescanExistingBookLibraryItem(libraryItem, libraryItemData, {}, libraryScan)
  }

  it('keeps the last known audio files and duration when all audio files were removed', async () => {
    const notes = lf('Old', 'notes.txt', '3', 10)
    const libraryItem = await createBookItem([lf('Old', '01.mp3', '1', 111), lf('Old', '02.mp3', '2', 222), notes])

    // Old folder still exists but only the text file is left in it
    const { wasUpdated } = await rescan(libraryItem.id, scanData('Old', [notes]))
    expect(wasUpdated).to.be.true

    const savedLibraryItem = await Database.libraryItemModel.findByPk(libraryItem.id)
    expect(savedLibraryItem.isMissing).to.be.true
    expect(savedLibraryItem.libraryFiles.map((f) => f.metadata.filename)).to.deep.equal(['notes.txt'])

    const savedBook = await Database.bookModel.findByPk(libraryItem.mediaId)
    expect(savedBook.duration).to.equal(200)
    expect(savedBook.audioFiles.map((f) => f.metadata.size)).to.deep.equal([111, 222])
  })

  it('leaves the missing item matchable by findMissingBookLibraryItemMatch', async () => {
    const libraryItem = await createBookItem([lf('Old', '01.mp3', '1', 111), lf('Old', '02.mp3', '2', 222)])
    await rescan(libraryItem.id, scanData('Old', []))

    const newAudioFiles = [af(lf('New', '01.mp3', '11', 111), 100), af(lf('New', '02.mp3', '12', 222), 100)]
    const match = await BookScanner.findMissingBookLibraryItemMatch(library.id, { asin: null, title: 'Different Title', authors: [] }, newAudioFiles, 200, libraryScan)
    expect(match?.id).to.equal(libraryItem.id)
  })

  it('replaces the kept audio files when the item is reused for a new folder', async () => {
    const libraryItem = await createBookItem([lf('Old', '01.mp3', '1', 111), lf('Old', '02.mp3', '2', 222)])
    await rescan(libraryItem.id, scanData('Old', []))

    // Same files at a new path with new inodes
    await rescan(libraryItem.id, scanData('New', [lf('New', '01.mp3', '11', 111), lf('New', '02.mp3', '12', 222)]))

    const savedLibraryItem = await Database.libraryItemModel.findByPk(libraryItem.id)
    expect(savedLibraryItem.isMissing).to.be.false
    expect(savedLibraryItem.path).to.equal('/lib/New')

    const savedBook = await Database.bookModel.findByPk(libraryItem.mediaId)
    expect(savedBook.duration).to.equal(200)
    expect(savedBook.audioFiles.map((f) => f.metadata.path)).to.deep.equal(['/lib/New/01.mp3', '/lib/New/02.mp3'])
  })

  it('replaces the kept audio files when the files are moved back to the old folder', async () => {
    const libraryFiles = [lf('Old', '01.mp3', '1', 111), lf('Old', '02.mp3', '2', 222)]
    const libraryItem = await createBookItem(libraryFiles)
    await rescan(libraryItem.id, scanData('Old', []))

    await rescan(libraryItem.id, scanData('Old', libraryFiles))

    const savedLibraryItem = await Database.libraryItemModel.findByPk(libraryItem.id)
    expect(savedLibraryItem.isMissing).to.be.false

    const savedBook = await Database.bookModel.findByPk(libraryItem.mediaId)
    expect(savedBook.duration).to.equal(200)
    expect(savedBook.audioFiles.map((f) => f.metadata.path)).to.deep.equal(['/lib/Old/01.mp3', '/lib/Old/02.mp3'])
  })
})
