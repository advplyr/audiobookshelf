const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const BookScanner = require('../../../server/scanner/BookScanner')
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
