const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const CollectionController = require('../../../server/controllers/CollectionController')
const Logger = require('../../../server/Logger')
const SocketAuthority = require('../../../server/SocketAuthority')

describe('CollectionController - Series Entries', () => {
  let user1, library, library2, series1, series2, book1, book2, libraryItem1, libraryItem2

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'error')
    sinon.stub(Logger, 'warn')
    sinon.stub(Logger, 'debug')
    sinon.stub(SocketAuthority, 'emitter')

    // Create test data
    library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
    library2 = await Database.libraryModel.create({ name: 'Other Library', mediaType: 'book' })

    user1 = await Database.userModel.create({
      username: 'user1',
      pash: 'hashed_password_1',
      type: 'user',
      isActive: true,
      permissions: JSON.stringify({ update: true, delete: true })
    })
    user1.mediaProgresses = []
    user1.canUpdate = true
    user1.canDelete = true
    user1.checkCanAccessLibraryItemWithTags = () => true
    user1.canAccessExplicitContent = true

    series1 = await Database.seriesModel.create({
      name: 'The Expanse',
      nameIgnorePrefix: 'Expanse',
      libraryId: library.id
    })

    series2 = await Database.seriesModel.create({
      name: 'Foundation',
      nameIgnorePrefix: 'Foundation',
      libraryId: library.id
    })

    book1 = await Database.bookModel.create({
      title: 'Book One',
      authorName: 'Author 1',
      audioFiles: [],
      chapters: [],
      tags: [],
      narrators: [],
      genres: []
    })

    libraryItem1 = await Database.libraryItemModel.create({
      path: '/books/book1',
      relPath: 'book1',
      mediaId: book1.id,
      mediaType: 'book',
      libraryId: library.id,
      libraryFiles: []
    })

    book2 = await Database.bookModel.create({
      title: 'Book Two',
      authorName: 'Author 2',
      audioFiles: [],
      chapters: [],
      tags: [],
      narrators: [],
      genres: []
    })

    libraryItem2 = await Database.libraryItemModel.create({
      path: '/books/book2',
      relPath: 'book2',
      mediaId: book2.id,
      mediaType: 'book',
      libraryId: library.id,
      libraryFiles: []
    })
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.sync({ force: true })
  })

  function makeFakeRes() {
    return {
      sendStatus: sinon.spy(),
      status: sinon.stub().returnsThis(),
      send: sinon.spy(),
      json: sinon.spy()
    }
  }

  describe('create', () => {
    it('should create collection with books and seriesIds', async () => {
      const fakeReq = {
        user: user1,
        body: {
          libraryId: library.id,
          name: 'My Collection',
          books: [libraryItem1.id],
          seriesIds: [series1.id]
        }
      }
      const fakeRes = makeFakeRes()

      await CollectionController.create(fakeReq, fakeRes)

      expect(fakeRes.json.calledOnce).to.be.true
      const response = fakeRes.json.firstCall.args[0]

      // books should only contain book entries
      expect(response.books).to.have.length(1)

      // entries should contain both book and series
      expect(response.entries).to.have.length(2)
      expect(response.entries[0].type).to.equal('libraryItem')
      expect(response.entries[0].libraryItemId).to.equal(libraryItem1.id)
      expect(response.entries[0].order).to.equal(1)
      expect(response.entries[1].type).to.equal('series')
      expect(response.entries[1].seriesId).to.equal(series1.id)
      expect(response.entries[1].seriesName).to.equal('The Expanse')
      expect(response.entries[1].order).to.equal(2)

      // Socket event
      expect(SocketAuthority.emitter.calledOnce).to.be.true
      expect(SocketAuthority.emitter.firstCall.args[0]).to.equal('collection_added')
    })

    it('should create collection with only seriesIds', async () => {
      const fakeReq = {
        user: user1,
        body: {
          libraryId: library.id,
          name: 'Series Only Collection',
          seriesIds: [series1.id, series2.id]
        }
      }
      const fakeRes = makeFakeRes()

      await CollectionController.create(fakeReq, fakeRes)

      expect(fakeRes.json.calledOnce).to.be.true
      const response = fakeRes.json.firstCall.args[0]

      expect(response.books).to.have.length(0)
      expect(response.entries).to.have.length(2)
      expect(response.entries[0].type).to.equal('series')
      expect(response.entries[1].type).to.equal('series')
    })

    it('should reject invalid seriesId', async () => {
      const fakeReq = {
        user: user1,
        body: {
          libraryId: library.id,
          name: 'Bad Collection',
          seriesIds: ['00000000-0000-0000-0000-000000000000']
        }
      }
      const fakeRes = makeFakeRes()

      await CollectionController.create(fakeReq, fakeRes)

      expect(fakeRes.status.calledWith(400)).to.be.true
      expect(fakeRes.send.calledWith('Invalid collection data. Invalid series')).to.be.true
    })

    it('should reject collection with no books and no series', async () => {
      const fakeReq = {
        user: user1,
        body: {
          libraryId: library.id,
          name: 'Empty'
        }
      }
      const fakeRes = makeFakeRes()

      await CollectionController.create(fakeReq, fakeRes)

      expect(fakeRes.status.calledWith(400)).to.be.true
    })
  })

  describe('addBatch', () => {
    let collection

    beforeEach(async () => {
      collection = await Database.collectionModel.create({
        libraryId: library.id,
        name: 'Test Collection'
      })
      await Database.collectionBookModel.create({
        collectionId: collection.id,
        bookId: book1.id,
        order: 1
      })
    })

    it('should add series to existing collection', async () => {
      const fakeReq = {
        user: user1,
        collection,
        body: {
          seriesIds: [series1.id]
        }
      }
      const fakeRes = makeFakeRes()

      await CollectionController.addBatch(fakeReq, fakeRes)

      expect(fakeRes.json.calledOnce).to.be.true
      const response = fakeRes.json.firstCall.args[0]

      expect(response.entries).to.have.length(2)
      expect(response.entries[0].type).to.equal('libraryItem')
      expect(response.entries[0].order).to.equal(1)
      expect(response.entries[1].type).to.equal('series')
      expect(response.entries[1].seriesId).to.equal(series1.id)
      expect(response.entries[1].order).to.equal(2)
    })

    it('should skip duplicate series', async () => {
      // Add series first
      await Database.collectionSeriesItemModel.create({
        collectionId: collection.id,
        seriesId: series1.id,
        order: 2
      })

      const fakeReq = {
        user: user1,
        collection,
        body: {
          seriesIds: [series1.id]
        }
      }
      const fakeRes = makeFakeRes()

      await CollectionController.addBatch(fakeReq, fakeRes)

      expect(fakeRes.json.calledOnce).to.be.true
      const response = fakeRes.json.firstCall.args[0]
      expect(response.entries).to.have.length(2)
      expect(SocketAuthority.emitter.called).to.be.false
    })

    it('should reject invalid series', async () => {
      const fakeReq = {
        user: user1,
        collection,
        body: {
          seriesIds: ['00000000-0000-0000-0000-000000000000']
        }
      }
      const fakeRes = makeFakeRes()

      await CollectionController.addBatch(fakeReq, fakeRes)

      expect(fakeRes.status.calledWith(400)).to.be.true
    })
  })

  describe('removeSeries', () => {
    let collection

    beforeEach(async () => {
      collection = await Database.collectionModel.create({
        libraryId: library.id,
        name: 'Test Collection'
      })
      await Database.collectionBookModel.create({
        collectionId: collection.id,
        bookId: book1.id,
        order: 1
      })
      await Database.collectionSeriesItemModel.create({
        collectionId: collection.id,
        seriesId: series1.id,
        order: 2
      })
      await Database.collectionBookModel.create({
        collectionId: collection.id,
        bookId: book2.id,
        order: 3
      })
    })

    it('should remove series and re-compact orders', async () => {
      const fakeReq = {
        user: user1,
        collection,
        params: { id: collection.id, seriesId: series1.id }
      }
      const fakeRes = makeFakeRes()

      await CollectionController.removeSeries(fakeReq, fakeRes)

      expect(fakeRes.json.calledOnce).to.be.true
      const response = fakeRes.json.firstCall.args[0]

      expect(response.entries).to.have.length(2)
      expect(response.entries[0].order).to.equal(1)
      expect(response.entries[1].order).to.equal(2)
      expect(response.entries[0].type).to.equal('libraryItem')
      expect(response.entries[1].type).to.equal('libraryItem')

      expect(SocketAuthority.emitter.calledOnce).to.be.true
      expect(SocketAuthority.emitter.firstCall.args[0]).to.equal('collection_updated')
    })

    it('should return 200 for non-existent series (idempotent)', async () => {
      const fakeReq = {
        user: user1,
        collection,
        params: { id: collection.id, seriesId: '00000000-0000-0000-0000-000000000000' }
      }
      const fakeRes = makeFakeRes()

      await CollectionController.removeSeries(fakeReq, fakeRes)

      expect(fakeRes.json.calledOnce).to.be.true
      const response = fakeRes.json.firstCall.args[0]
      expect(response.entries).to.have.length(3)
    })
  })

  describe('findOne', () => {
    it('should include entries in response', async () => {
      const collection = await Database.collectionModel.create({
        libraryId: library.id,
        name: 'Test Collection'
      })
      await Database.collectionBookModel.create({
        collectionId: collection.id,
        bookId: book1.id,
        order: 1
      })
      await Database.collectionSeriesItemModel.create({
        collectionId: collection.id,
        seriesId: series1.id,
        order: 2
      })

      const fakeReq = {
        user: user1,
        collection,
        query: {}
      }
      const fakeRes = makeFakeRes()

      await CollectionController.findOne(fakeReq, fakeRes)

      expect(fakeRes.json.calledOnce).to.be.true
      const response = fakeRes.json.firstCall.args[0]

      expect(response.entries).to.be.an('array')
      expect(response.entries).to.have.length(2)
      expect(response.books).to.be.an('array')
      expect(response.books).to.have.length(1)
    })
  })

  describe('backward compatibility', () => {
    it('books array should only contain book entries', async () => {
      const collection = await Database.collectionModel.create({
        libraryId: library.id,
        name: 'Mixed Collection'
      })
      await Database.collectionBookModel.create({
        collectionId: collection.id,
        bookId: book1.id,
        order: 1
      })
      await Database.collectionSeriesItemModel.create({
        collectionId: collection.id,
        seriesId: series1.id,
        order: 2
      })

      collection.books = await collection.getBooksExpandedWithLibraryItem()
      collection.collectionSeriesItems = await collection.getSeriesItemsExpanded()

      const json = collection.toOldJSONExpanded()

      // books should only have book entries
      expect(json.books).to.have.length(1)

      // entries should have both
      expect(json.entries).to.have.length(2)
      expect(json.entries.filter((e) => e.type === 'libraryItem')).to.have.length(1)
      expect(json.entries.filter((e) => e.type === 'series')).to.have.length(1)
    })
  })

  describe('cascade delete', () => {
    it('should auto-remove CollectionSeriesItem when series is deleted', async () => {
      const collection = await Database.collectionModel.create({
        libraryId: library.id,
        name: 'Cascade Test'
      })
      await Database.collectionSeriesItemModel.create({
        collectionId: collection.id,
        seriesId: series1.id,
        order: 1
      })

      // Delete the series
      await series1.destroy()

      // CollectionSeriesItem should be gone via CASCADE
      const remaining = await Database.collectionSeriesItemModel.findAll({
        where: { collectionId: collection.id }
      })
      expect(remaining).to.have.length(0)
    })
  })
})
