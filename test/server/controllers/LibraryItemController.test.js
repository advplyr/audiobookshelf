const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')
const chai = require('chai')
const { mockReq, mockRes } = require('sinon-express-mock')

const Database = require('../../../server/Database')
const ApiRouter = require('../../../server/routers/ApiRouter')
const LibraryItemController = require('../../../server/controllers/LibraryItemController')
const ApiCacheManager = require('../../../server/managers/ApiCacheManager')
const Logger = require('../../../server/Logger')
const ServerSettings = require('../../../server/objects/settings/ServerSettings')
const Book = require('../../../server/models/Book')
const User = require('../../../server/models/User')
const RssFeedManager = require('../../../server/managers/RssFeedManager')
const CacheManager = require('../../../server/managers/CacheManager')
const fs = require('../../../server/libs/fsExtra')
const SocketAuthority = require('../../../server/SocketAuthority')

describe('LibraryItemController', () => {
  /** @type {ApiRouter} */
  let apiRouter
  let sandbox

  beforeEach(async () => {
    sandbox = sinon.createSandbox()
    sandbox.stub(Logger, 'info')
    sandbox.stub(Logger, 'error')
    global.MetadataPath = '/tmp/audiobookshelf-test'
    global.ServerSettings = new ServerSettings()
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    apiRouter = new ApiRouter({
      apiCacheManager: new ApiCacheManager()
    })
    sandbox.stub(RssFeedManager, 'closeFeedForEntityId').resolves()
    sandbox.stub(RssFeedManager, 'closeFeedsForEntityIds').resolves()
    sandbox.stub(CacheManager, 'purgeCoverCache').resolves()
    sandbox.stub(fs, 'remove').resolves()
    sandbox.stub(SocketAuthority, 'emitter')
  })

  afterEach(async () => {
    sandbox.restore()

    // Clear all tables
    await Database.sequelize.sync({ force: true })
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
        user: { id: 'test-user-id' },
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

  describe('_getExpandedItemWithRatings', () => {
    let user, libraryItem

    beforeEach(() => {
      user = new User({ id: 'user1' })
      libraryItem = {
        isBook: true,
        media: { id: 'book1' },
        toOldJSONExpanded: () => ({ media: {} })
      }
      sandbox.stub(Database, 'userBookRatingModel').value({ findOne: () => {}, findAll: () => [] })
      sandbox.stub(Database, 'userBookExplicitRatingModel').value({ findOne: () => {}, findAll: () => [] })
    })

    it('should not add any rating if all rating settings are disabled', async () => {
      global.ServerSettings.enableRating = false
      global.ServerSettings.enableExplicitRating = false
      const result = await LibraryItemController._getExpandedItemWithRatings(libraryItem, user)
      expect(result.media.myRating).to.be.undefined
      expect(result.media.communityRating).to.be.undefined
      expect(result.media.myExplicitRating).to.be.undefined
      expect(result.media.communityExplicitRating).to.be.undefined
    })

    it('should add personal rating if enabled', async () => {
      global.ServerSettings.enableRating = true
      sandbox.stub(Database.userBookRatingModel, 'findOne').resolves({ rating: 4 })
      const result = await LibraryItemController._getExpandedItemWithRatings(libraryItem, user)
      expect(result.media.myRating).to.equal(4)
    })

    it('should add community rating if enabled', async () => {
      global.ServerSettings.enableRating = true
      global.ServerSettings.enableCommunityRating = true
      sandbox.stub(Database.userBookRatingModel, 'findAll').resolves([{ rating: 3 }, { rating: 5 }])
      const result = await LibraryItemController._getExpandedItemWithRatings(libraryItem, user)
      expect(result.media.communityRating.average).to.equal(4)
      expect(result.media.communityRating.count).to.equal(2)
    })

    it('should add personal explicit rating if enabled', async () => {
      global.ServerSettings.enableExplicitRating = true
      sandbox.stub(Database.userBookExplicitRatingModel, 'findOne').resolves({ rating: 2 })
      const result = await LibraryItemController._getExpandedItemWithRatings(libraryItem, user)
      expect(result.media.myExplicitRating).to.equal(2)
    })

    it('should add community explicit rating if enabled', async () => {
      global.ServerSettings.enableExplicitRating = true
      global.ServerSettings.enableCommunityRating = true
      sandbox.stub(Database.userBookExplicitRatingModel, 'findAll').resolves([{ rating: 1 }, { rating: 5 }])
      const result = await LibraryItemController._getExpandedItemWithRatings(libraryItem, user)
      expect(result.media.communityExplicitRating.average).to.equal(3)
      expect(result.media.communityExplicitRating.count).to.equal(2)
    })
  })

  describe('updateMedia', () => {
    let user, libraryItem, book, bookSaveStub

    beforeEach(async () => {
      user = await Database.userModel.create({ username: 'test', password: 'password' })
      const newLibrary = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
      const newLibraryFolder = await Database.libraryFolderModel.create({ path: '/test', libraryId: newLibrary.id })
      book = await Database.bookModel.create({ title: 'Test Book', audioFiles: [], tags: [], narrators: [], genres: [], chapters: [] })
      libraryItem = await Database.libraryItemModel.create({ libraryFiles: [], mediaId: book.id, mediaType: 'book', libraryId: newLibrary.id, libraryFolderId: newLibraryFolder.id })
      libraryItem.media = book
      libraryItem.saveMetadataFile = sinon.stub()
      bookSaveStub = sandbox.stub(Book.prototype, 'save').resolves()
    })

    it('should update rating from metadata', async () => {
      const req = mockReq({
        user,
        libraryItem,
        body: { metadata: { rating: 4.5 } }
      })
      const res = mockRes()

      await LibraryItemController.updateMedia.bind(apiRouter)(req, res)

      expect(book.providerRating).to.equal(4.5)
      expect(bookSaveStub.called).to.be.true
      expect(res.json.calledOnce).to.be.true
    })

    it('should update rating from provider_data', async () => {
      const req = mockReq({
        user,
        libraryItem,
        body: {
          provider_data: {
            rating: 4.2,
            provider: 'test-provider',
            providerId: 'test-id'
          }
        }
      })
      const res = mockRes()

      await LibraryItemController.updateMedia.bind(apiRouter)(req, res)

      expect(book.providerRating).to.equal(4.2)
      expect(book.provider).to.equal('test-provider')
      expect(book.providerId).to.equal('test-id')
      expect(bookSaveStub.called).to.be.true
      expect(res.json.calledOnce).to.be.true
    })
  })

  describe('rate', () => {
    let user, libraryItem, book

    beforeEach(async () => {
      user = await Database.userModel.create({ username: 'test', password: 'password', id: 'user-1' })
      const newLibrary = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
      const newLibraryFolder = await Database.libraryFolderModel.create({ path: '/test', libraryId: newLibrary.id })
      book = await Database.bookModel.create({ id: 'book-1', title: 'Test Book', audioFiles: [], tags: [], narrators: [], genres: [], chapters: [] })
      libraryItem = await Database.libraryItemModel.create({ libraryFiles: [], mediaId: book.id, mediaType: 'book', libraryId: newLibrary.id, libraryFolderId: newLibraryFolder.id })
      libraryItem.media = book
    })

    it('should return 403 if rating is disabled', async () => {
      global.ServerSettings.enableRating = false
      const req = mockReq()
      const res = mockRes()
      await LibraryItemController.rate.bind(apiRouter)(req, res)
      expect(res.status.args[0][0]).to.equal(403)
    })

    it('should return 400 for invalid rating', async () => {
      global.ServerSettings.enableRating = true
      const req = mockReq({ user, libraryItem, body: { rating: 6 } })
      const res = mockRes()
      await LibraryItemController.rate(req, res)
      expect(res.status.args[0][0]).to.equal(400)
    })

    it('should save a valid rating and return 200', async () => {
      global.ServerSettings.enableRating = true
      const req = mockReq({ user, libraryItem, body: { rating: 4 } })
      const res = mockRes()
      await LibraryItemController.rate(req, res)
      expect(res.status.args[0][0]).to.equal(200)
      const userRating = await Database.userBookRatingModel.findOne({ where: { userId: user.id, bookId: book.id } })
      expect(userRating.rating).to.equal(4)
    })
  })

  describe('rateExplicit', () => {
    let user, libraryItem, book
    beforeEach(async () => {
      user = await Database.userModel.create({ username: 'test', password: 'password', id: 'user-1' })
      const newLibrary = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
      const newLibraryFolder = await Database.libraryFolderModel.create({ path: '/test', libraryId: newLibrary.id })
      book = await Database.bookModel.create({ id: 'book-1', title: 'Test Book', audioFiles: [], tags: [], narrators: [], genres: [], chapters: [] })
      libraryItem = await Database.libraryItemModel.create({ libraryFiles: [], mediaId: book.id, mediaType: 'book', libraryId: newLibrary.id, libraryFolderId: newLibraryFolder.id })
      libraryItem.media = book
    })

    it('should return 403 if explicit rating is disabled', async () => {
      global.ServerSettings.enableExplicitRating = false
      const req = mockReq()
      const res = mockRes()
      await LibraryItemController.rateExplicit.bind(apiRouter)(req, res)
      expect(res.status.args[0][0]).to.equal(403)
    })

    it('should return 400 for invalid explicit rating', async () => {
      global.ServerSettings.enableExplicitRating = true
      const req = mockReq({ user, libraryItem, body: { rating: -1 } })
      const res = mockRes()
      await LibraryItemController.rateExplicit(req, res)
      expect(res.status.args[0][0]).to.equal(400)
    })

    it('should save a valid explicit rating and return 200', async () => {
      global.ServerSettings.enableExplicitRating = true
      const req = mockReq({ user, libraryItem, body: { rating: 5 } })
      const res = mockRes()
      await LibraryItemController.rateExplicit(req, res)
      expect(res.status.args[0][0]).to.equal(200)
      const userRating = await Database.userBookExplicitRatingModel.findOne({ where: { userId: user.id, bookId: book.id } })
      expect(userRating.rating).to.equal(5)
    })
  })
})
