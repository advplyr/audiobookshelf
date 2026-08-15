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
          username: 'test',
          canDelete: true,
          checkCanAccessLibraryItem: () => true
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

  describe('batch item access control', () => {
    let lib1Id
    let itemLib1Id
    let itemLib2Id

    beforeEach(async () => {
      const lib1 = await Database.libraryModel.create({ name: 'Lib 1', mediaType: 'book' })
      const folder1 = await Database.libraryFolderModel.create({ path: '/l1', libraryId: lib1.id })
      const book1 = await Database.bookModel.create({ title: 'B1', audioFiles: [], tags: [], narrators: [], genres: [], chapters: [] })
      const li1 = await Database.libraryItemModel.create({
        libraryFiles: [],
        mediaId: book1.id,
        mediaType: 'book',
        libraryId: lib1.id,
        libraryFolderId: folder1.id
      })
      lib1Id = lib1.id
      itemLib1Id = li1.id

      const lib2 = await Database.libraryModel.create({ name: 'Lib 2', mediaType: 'book' })
      const folder2 = await Database.libraryFolderModel.create({ path: '/l2', libraryId: lib2.id })
      const book2 = await Database.bookModel.create({ title: 'B2', audioFiles: [], tags: [], narrators: [], genres: [], chapters: [] })
      const li2 = await Database.libraryItemModel.create({
        libraryFiles: [],
        mediaId: book2.id,
        mediaType: 'book',
        libraryId: lib2.id,
        libraryFolderId: folder2.id
      })
      itemLib2Id = li2.id
    })

    const userLimitedToLib1 = () => ({
      username: 'limited',
      canDelete: true,
      canUpdate: true,
      checkCanAccessLibraryItem(li) {
        return li.libraryId === lib1Id
      }
    })

    it('batchGet returns 403 for a library item the user cannot access', async () => {
      const fakeRes = { sendStatus: sinon.spy(), json: sinon.spy() }
      const fakeReq = {
        body: { libraryItemIds: [itemLib2Id] },
        user: userLimitedToLib1()
      }
      await LibraryItemController.batchGet.bind(apiRouter)(fakeReq, fakeRes)
      expect(fakeRes.sendStatus.calledWith(403)).to.be.true
    })

    it('batchGet returns items when the user can access them', async () => {
      const fakeRes = { sendStatus: sinon.spy(), json: sinon.spy() }
      const fakeReq = {
        body: { libraryItemIds: [itemLib1Id] },
        user: userLimitedToLib1()
      }
      await LibraryItemController.batchGet.bind(apiRouter)(fakeReq, fakeRes)
      expect(fakeRes.json.calledOnce).to.be.true
      const payload = fakeRes.json.firstCall.args[0]
      expect(payload.libraryItems).to.have.length(1)
      expect(payload.libraryItems[0].id).to.equal(itemLib1Id)
    })

    it('batchUpdate returns 403 for a library item the user cannot access', async () => {
      const fakeRes = { sendStatus: sinon.spy(), json: sinon.spy() }
      const fakeReq = {
        user: userLimitedToLib1(),
        body: [{ id: itemLib2Id, mediaPayload: {} }]
      }
      await LibraryItemController.batchUpdate.bind(apiRouter)(fakeReq, fakeRes)
      expect(fakeRes.sendStatus.calledWith(403)).to.be.true
    })

    it('batchUpdate returns 403 when the user lacks canUpdate', async () => {
      const u = userLimitedToLib1()
      u.canUpdate = false
      const fakeRes = { sendStatus: sinon.spy(), json: sinon.spy() }
      const fakeReq = {
        user: u,
        body: [{ id: itemLib1Id, mediaPayload: {} }]
      }
      await LibraryItemController.batchUpdate.bind(apiRouter)(fakeReq, fakeRes)
      expect(fakeRes.sendStatus.calledWith(403)).to.be.true
    })

    it('batchDelete returns 403 for a library item the user cannot access', async () => {
      const fakeRes = { sendStatus: sinon.spy() }
      const fakeReq = {
        query: {},
        user: userLimitedToLib1(),
        body: { libraryItemIds: [itemLib2Id] }
      }
      await LibraryItemController.batchDelete.bind(apiRouter)(fakeReq, fakeRes)
      expect(fakeRes.sendStatus.calledWith(403)).to.be.true
    })
  })
})
