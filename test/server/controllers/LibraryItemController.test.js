const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const ApiRouter = require('../../../server/routers/ApiRouter')
const LibraryItemController = require('../../../server/controllers/LibraryItemController')
const ApiCacheManager = require('../../../server/managers/ApiCacheManager')
const Auth = require('../../../server/Auth')
const Logger = require('../../../server/Logger')

describe('LibraryItemController', () => {
  /** @type {ApiRouter} */
  let apiRouter

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    apiRouter = new ApiRouter({
      auth: new Auth(),
      apiCacheManager: new ApiCacheManager()
    })

    sinon.stub(Logger, 'info')
  })

  afterEach(async () => {
    sinon.restore()

    // Clear all tables
    await Database.sequelize.sync({ force: true })
  })

  describe('downloadChapterFiles', () => {
    const makeReq = (overrides = {}) => ({
      user: { canDownload: true, username: 'testuser' },
      libraryItem: {
        isBook: true,
        id: 'item-1',
        media: {
          title: 'Test Book',
          chapters: [],
          audioFiles: []
        }
      },
      query: {},
      ...overrides
    })

    const makeRes = () => ({
      sendStatus: sinon.spy(),
      status: sinon.stub().returnsThis(),
      send: sinon.spy()
    })

    it('should return 403 when user cannot download', async () => {
      const req = makeReq({ user: { canDownload: false, username: 'testuser' } })
      const res = makeRes()
      await LibraryItemController.downloadChapterFiles.bind(apiRouter)(req, res)
      expect(res.sendStatus.calledWith(403)).to.be.true
    })

    it('should return 400 when library item is not a book', async () => {
      const req = makeReq({ libraryItem: { isBook: false, media: {} } })
      const res = makeRes()
      await LibraryItemController.downloadChapterFiles.bind(apiRouter)(req, res)
      expect(res.status.calledWith(400)).to.be.true
    })

    it('should return 400 when book has no chapters', async () => {
      const req = makeReq()
      req.libraryItem.media.chapters = []
      const res = makeRes()
      await LibraryItemController.downloadChapterFiles.bind(apiRouter)(req, res)
      expect(res.status.calledWith(400)).to.be.true
    })

    it('should return 400 when specified fileIno is not found', async () => {
      const req = makeReq()
      req.libraryItem.media.chapters = [{ id: 0, start: 0, end: 100, title: 'Ch 1' }]
      req.libraryItem.media.audioFiles = [{ ino: 'abc', exclude: false, index: 1, duration: 100, metadata: { filename: 'book.mp3', path: '/book.mp3' } }]
      req.query = { fileIno: 'nonexistent' }
      const res = makeRes()
      await LibraryItemController.downloadChapterFiles.bind(apiRouter)(req, res)
      expect(res.status.calledWith(400)).to.be.true
    })
  })

  describe('getChaptersForAudioFile', () => {
    const file1 = { ino: 'f1', index: 1, duration: 1000 }
    const file2 = { ino: 'f2', index: 2, duration: 800 }

    it('returns all chapters unchanged for a single audio file', () => {
      const chapters = [
        { id: 0, start: 0, end: 300, title: 'Intro' },
        { id: 1, start: 300, end: 700, title: 'Part 1' },
        { id: 2, start: 700, end: 1000, title: 'Part 2' }
      ]
      const result = LibraryItemController.constructor.getChaptersForAudioFile(chapters, file1, [file1])
      expect(result).to.have.length(3)
      expect(result[0].start).to.equal(0)
      expect(result[2].end).to.equal(1000)
    })

    it('filters chapters to the selected file when multiple files exist', () => {
      // file1: 0–1000s, file2: 1000–1800s (global)
      const chapters = [
        { id: 0, start: 0, end: 500, title: 'A' },
        { id: 1, start: 500, end: 1000, title: 'B' },
        { id: 2, start: 1000, end: 1400, title: 'C' },
        { id: 3, start: 1400, end: 1800, title: 'D' }
      ]
      const result = LibraryItemController.constructor.getChaptersForAudioFile(chapters, file2, [file1, file2])
      expect(result).to.have.length(2)
      expect(result[0].title).to.equal('C')
      expect(result[1].title).to.equal('D')
    })

    it('converts global timestamps to file-relative timestamps', () => {
      // file1: 0–1000s, file2: 1000–1800s (global)
      const chapters = [
        { id: 2, start: 1000, end: 1400, title: 'C' },
        { id: 3, start: 1400, end: 1800, title: 'D' }
      ]
      const result = LibraryItemController.constructor.getChaptersForAudioFile(chapters, file2, [file1, file2])
      expect(result[0].start).to.equal(0)
      expect(result[0].end).to.equal(400)
      expect(result[1].start).to.equal(400)
      expect(result[1].end).to.equal(800)
    })

    it('clamps the last chapter end to the file duration', () => {
      // Global chapter end overshoots the file boundary
      const chapters = [{ id: 0, start: 1000, end: 9999, title: 'Last' }]
      const result = LibraryItemController.constructor.getChaptersForAudioFile(chapters, file2, [file1, file2])
      expect(result[0].end).to.equal(800) // file2 duration
    })

    it('excludes chapters that start outside the selected file range', () => {
      const chapters = [
        { id: 0, start: 0, end: 1000, title: 'File1 chapter' },
        { id: 1, start: 1000, end: 1800, title: 'File2 chapter' }
      ]
      const result = LibraryItemController.constructor.getChaptersForAudioFile(chapters, file1, [file1, file2])
      expect(result).to.have.length(1)
      expect(result[0].title).to.equal('File1 chapter')
    })

    it('sorts files by index regardless of input order', () => {
      const unordered = [file2, file1] // file2 first in array, but index 2
      const chapters = [{ id: 0, start: 0, end: 500, title: 'A' }]
      const result = LibraryItemController.constructor.getChaptersForAudioFile(chapters, file1, unordered)
      expect(result).to.have.length(1)
      expect(result[0].start).to.equal(0)
    })
  })

  describe('checkRemoveAuthorsAndSeries', () => {
    let libraryItem1Id
    let libraryItem2Id
    let author1Id
    let author2Id
    let author3Id
    let series1Id
    let series2Id

    beforeEach(async () => {
      const newLibrary = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
      const newLibraryFolder = await Database.libraryFolderModel.create({ path: '/test', libraryId: newLibrary.id })

      const newBook = await Database.bookModel.create({ title: 'Test Book', audioFiles: [], tags: [], narrators: [], genres: [], chapters: [] })
      const newLibraryItem = await Database.libraryItemModel.create({ libraryFiles: [], mediaId: newBook.id, mediaType: 'book', libraryId: newLibrary.id, libraryFolderId: newLibraryFolder.id })
      libraryItem1Id = newLibraryItem.id

      const newBook2 = await Database.bookModel.create({ title: 'Test Book 2', audioFiles: [], tags: [], narrators: [], genres: [], chapters: [] })
      const newLibraryItem2 = await Database.libraryItemModel.create({ libraryFiles: [], mediaId: newBook2.id, mediaType: 'book', libraryId: newLibrary.id, libraryFolderId: newLibraryFolder.id })
      libraryItem2Id = newLibraryItem2.id

      const newAuthor = await Database.authorModel.create({ name: 'Test Author', libraryId: newLibrary.id })
      author1Id = newAuthor.id
      const newAuthor2 = await Database.authorModel.create({ name: 'Test Author 2', libraryId: newLibrary.id })
      author2Id = newAuthor2.id
      const newAuthor3 = await Database.authorModel.create({ name: 'Test Author 3', imagePath: '/fake/path/author.png', libraryId: newLibrary.id })
      author3Id = newAuthor3.id

      // Book 1 has Author 1, Author 2 and Author 3
      await Database.bookAuthorModel.create({ bookId: newBook.id, authorId: newAuthor.id })
      await Database.bookAuthorModel.create({ bookId: newBook.id, authorId: newAuthor2.id })
      await Database.bookAuthorModel.create({ bookId: newBook.id, authorId: newAuthor3.id })

      // Book 2 has Author 2
      await Database.bookAuthorModel.create({ bookId: newBook2.id, authorId: newAuthor2.id })

      const newSeries = await Database.seriesModel.create({ name: 'Test Series', libraryId: newLibrary.id })
      series1Id = newSeries.id
      const newSeries2 = await Database.seriesModel.create({ name: 'Test Series 2', libraryId: newLibrary.id })
      series2Id = newSeries2.id

      // Book 1 is in Series 1 and Series 2
      await Database.bookSeriesModel.create({ bookId: newBook.id, seriesId: newSeries.id })
      await Database.bookSeriesModel.create({ bookId: newBook.id, seriesId: newSeries2.id })

      // Book 2 is in Series 2
      await Database.bookSeriesModel.create({ bookId: newBook2.id, seriesId: newSeries2.id })
    })

    it('should remove authors and series with no books on library item delete', async () => {
      const libraryItem = await Database.libraryItemModel.getExpandedById(libraryItem1Id)

      const fakeReq = {
        query: {},
        libraryItem
      }
      const fakeRes = {
        sendStatus: sinon.spy()
      }
      await LibraryItemController.delete.bind(apiRouter)(fakeReq, fakeRes)

      expect(fakeRes.sendStatus.calledWith(200)).to.be.true

      // Author 1 should be removed because it has no books
      const author1Exists = await Database.authorModel.checkExistsById(author1Id)
      expect(author1Exists).to.be.false

      // Author 2 should not be removed because it still has Book 2
      const author2Exists = await Database.authorModel.checkExistsById(author2Id)
      expect(author2Exists).to.be.true

      // Author 3 should not be removed because it has an image
      const author3Exists = await Database.authorModel.checkExistsById(author3Id)
      expect(author3Exists).to.be.true

      // Series 1 should be removed because it has no books
      const series1Exists = await Database.seriesModel.checkExistsById(series1Id)
      expect(series1Exists).to.be.false

      // Series 2 should not be removed because it still has Book 2
      const series2Exists = await Database.seriesModel.checkExistsById(series2Id)
      expect(series2Exists).to.be.true
    })

    it('should remove authors and series with no books on library item batch delete', async () => {
      // Batch delete library item 1
      const fakeReq = {
        query: {},
        user: {
          canDelete: true
        },
        body: {
          libraryItemIds: [libraryItem1Id]
        }
      }
      const fakeRes = {
        sendStatus: sinon.spy()
      }
      await LibraryItemController.batchDelete.bind(apiRouter)(fakeReq, fakeRes)

      expect(fakeRes.sendStatus.calledWith(200)).to.be.true

      // Author 1 should be removed because it has no books
      const author1Exists = await Database.authorModel.checkExistsById(author1Id)
      expect(author1Exists).to.be.false

      // Author 2 should not be removed because it still has Book 2
      const author2Exists = await Database.authorModel.checkExistsById(author2Id)
      expect(author2Exists).to.be.true

      // Author 3 should not be removed because it has an image
      const author3Exists = await Database.authorModel.checkExistsById(author3Id)
      expect(author3Exists).to.be.true

      // Series 1 should be removed because it has no books
      const series1Exists = await Database.seriesModel.checkExistsById(series1Id)
      expect(series1Exists).to.be.false

      // Series 2 should not be removed because it still has Book 2
      const series2Exists = await Database.seriesModel.checkExistsById(series2Id)
      expect(series2Exists).to.be.true
    })

    it('should remove authors and series with no books on library item update media', async () => {
      const libraryItem = await Database.libraryItemModel.getExpandedById(libraryItem1Id)
      libraryItem.saveMetadataFile = sinon.stub()
      // Update library item 1 remove all authors and series
      const fakeReq = {
        query: {},
        body: {
          metadata: {
            authors: [],
            series: []
          }
        },
        libraryItem
      }
      const fakeRes = {
        json: sinon.spy()
      }
      await LibraryItemController.updateMedia.bind(apiRouter)(fakeReq, fakeRes)

      expect(fakeRes.json.calledOnce).to.be.true

      // Author 1 should be removed because it has no books
      const author1Exists = await Database.authorModel.checkExistsById(author1Id)
      expect(author1Exists).to.be.false

      // Author 2 should not be removed because it still has Book 2
      const author2Exists = await Database.authorModel.checkExistsById(author2Id)
      expect(author2Exists).to.be.true

      // Author 3 should not be removed because it has an image
      const author3Exists = await Database.authorModel.checkExistsById(author3Id)
      expect(author3Exists).to.be.true

      // Series 1 should be removed because it has no books
      const series1Exists = await Database.seriesModel.checkExistsById(series1Id)
      expect(series1Exists).to.be.false

      // Series 2 should not be removed because it still has Book 2
      const series2Exists = await Database.seriesModel.checkExistsById(series2Id)
      expect(series2Exists).to.be.true
    })
  })
})
