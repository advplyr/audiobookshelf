const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const ApiRouter = require('../../../server/routers/ApiRouter')
const ReviewController = require('../../../server/controllers/ReviewController')
const ApiCacheManager = require('../../../server/managers/ApiCacheManager')
const Auth = require('../../../server/Auth')
const Logger = require('../../../server/Logger')

describe('ReviewController', () => {
  /** @type {ApiRouter} */
  let apiRouter

  beforeEach(async () => {
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    Database.serverSettings = {
      enableReviews: true
    }

    apiRouter = new ApiRouter({
      auth: new Auth(),
      apiCacheManager: new ApiCacheManager()
    })

    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'error')
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.close()
  })

  async function createTestLibraryItem() {
    const library = await Database.libraryModel.create({ name: 'Test', mediaType: 'book' })
    const book = await Database.bookModel.create({ title: 'Test Book' })
    return await Database.libraryItemModel.create({ mediaId: book.id, mediaType: 'book', libraryId: library.id })
  }

  describe('createUpdate', () => {
    it('should create a new review', async () => {
      const user = await Database.userModel.create({ username: 'testuser', type: 'root' })
      const libraryItem = await createTestLibraryItem()

      const fakeReq = {
        params: { id: libraryItem.id },
        body: { rating: 5, reviewText: 'Great book!' },
        user
      }
      const fakeRes = {
        json: sinon.spy(),
        status: sinon.stub().returns({ send: sinon.spy() })
      }

      await ReviewController.createUpdate(fakeReq, fakeRes)

      expect(fakeRes.json.calledOnce).to.be.true
      const review = fakeRes.json.firstCall.args[0]
      expect(review.rating).to.equal(5)
      expect(review.reviewText).to.equal('Great book!')
      expect(review.userId).to.equal(user.id)
    })

    it('should update an existing review', async () => {
      const user = await Database.userModel.create({ username: 'testuser', type: 'root' })
      const libraryItem = await createTestLibraryItem()

      await Database.reviewModel.create({ userId: user.id, libraryItemId: libraryItem.id, rating: 3 })

      const fakeReq = {
        params: { id: libraryItem.id },
        body: { rating: 4, reviewText: 'Actually better' },
        user
      }
      const fakeRes = {
        json: sinon.spy()
      }

      await ReviewController.createUpdate(fakeReq, fakeRes)

      const review = fakeRes.json.firstCall.args[0]
      expect(review.rating).to.equal(4)
      expect(review.reviewText).to.equal('Actually better')
    })

    it('should return 400 for invalid rating', async () => {
      const fakeReq = {
        params: { id: 'some-id' },
        body: { rating: 6 },
        user: { id: 'u1' }
      }
      const fakeRes = {
        status: sinon.stub().returns({ send: sinon.spy() })
      }

      await ReviewController.createUpdate(fakeReq, fakeRes)
      expect(fakeRes.status.calledWith(400)).to.be.true
    })
  })

  describe('findAllForItem', () => {
    it('should return all reviews for an item', async () => {
      const user1 = await Database.userModel.create({ username: 'u1', type: 'user' })
      const user2 = await Database.userModel.create({ username: 'u2', type: 'user' })
      const libraryItem = await createTestLibraryItem()

      await Database.reviewModel.create({ userId: user1.id, libraryItemId: libraryItem.id, rating: 5 })
      await Database.reviewModel.create({ userId: user2.id, libraryItemId: libraryItem.id, rating: 4 })

      const fakeReq = { params: { id: libraryItem.id } }
      const fakeRes = { json: sinon.spy() }

      await ReviewController.findAllForItem(fakeReq, fakeRes)

      expect(fakeRes.json.calledOnce).to.be.true
      expect(fakeRes.json.firstCall.args[0]).to.have.lengthOf(2)
    })
  })

  describe('delete', () => {
    it('should delete a review', async () => {
      const user = await Database.userModel.create({ username: 'u1', type: 'user' })
      const libraryItem = await createTestLibraryItem()
      await Database.reviewModel.create({ userId: user.id, libraryItemId: libraryItem.id, rating: 5 })

      const fakeReq = { params: { id: libraryItem.id }, user }
      const fakeRes = { sendStatus: sinon.spy() }

      await ReviewController.delete(fakeReq, fakeRes)
      expect(fakeRes.sendStatus.calledWith(200)).to.be.true

      const count = await Database.reviewModel.count()
      expect(count).to.equal(0)
    })
  })

  describe('middleware', () => {
    it('should block when enableReviews is false', async () => {
      Database.serverSettings.enableReviews = false
      const fakeReq = {}
      const fakeRes = { status: sinon.stub().returns({ send: sinon.spy() }) }
      const next = sinon.spy()

      await ReviewController.middleware(fakeReq, fakeRes, next)
      expect(fakeRes.status.calledWith(403)).to.be.true
      expect(next.called).to.be.false
    })
  })
})
