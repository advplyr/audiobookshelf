const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const Database = require('../../../server/Database')

describe('Review Model', () => {
  beforeEach(async () => {
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    await Database.buildModels()
  })

  afterEach(async () => {
    await Database.sequelize.close()
  })

  async function createTestLibraryItem(id = 'li1') {
    const library = await Database.libraryModel.create({ name: 'Test', mediaType: 'book' })
    const book = await Database.bookModel.create({ title: 'Test Book' })
    return await Database.libraryItemModel.create({ id, mediaId: book.id, mediaType: 'book', libraryId: library.id })
  }

  it('should validate rating between 1 and 5', async () => {
    const user = await Database.userModel.create({ username: 'u1' })
    const item = await createTestLibraryItem('li1')
    const item2 = await createTestLibraryItem('li2')
    const item3 = await createTestLibraryItem('li3')

    // Valid
    await Database.reviewModel.create({ userId: user.id, libraryItemId: item.id, rating: 5 })

    // Invalid - too high
    let error
    try {
      await Database.reviewModel.create({ userId: user.id, libraryItemId: item2.id, rating: 6 })
    } catch (err) {
      error = err
    }
    expect(error).to.exist
    expect(error.name).to.equal('SequelizeValidationError')

    // Invalid - too low
    error = null
    try {
      await Database.reviewModel.create({ userId: user.id, libraryItemId: item3.id, rating: 0 })
    } catch (err) {
      error = err
    }
    expect(error).to.exist
    expect(error.name).to.equal('SequelizeValidationError')
  })

  it('should enforce unique constraint on userId and libraryItemId', async () => {
    const user = await Database.userModel.create({ username: 'u1' })
    const item = await createTestLibraryItem('li1')

    await Database.reviewModel.create({ userId: user.id, libraryItemId: item.id, rating: 5 })
    
    let error
    try {
      await Database.reviewModel.create({ userId: user.id, libraryItemId: item.id, rating: 4 })
    } catch (err) {
      error = err
    }
    expect(error).to.exist
    expect(error.name).to.equal('SequelizeUniqueConstraintError')
  })

  it('should cascade delete when user is deleted', async () => {
    const user = await Database.userModel.create({ username: 'u1' })
    const item = await createTestLibraryItem('li1')
    await Database.reviewModel.create({ userId: user.id, libraryItemId: item.id, rating: 5 })

    await user.destroy()
    const count = await Database.reviewModel.count()
    expect(count).to.equal(0)
  })

  it('should return correct format in toOldJSON', async () => {
    const user = await Database.userModel.create({ username: 'testuser' })
    const item = await createTestLibraryItem('li1')
    const review = await Database.reviewModel.create({
      userId: user.id,
      libraryItemId: item.id,
      rating: 4,
      reviewText: 'Nice'
    })
    
    // Manually associate user for the test
    review.user = user

    const json = review.toOldJSON()
    expect(json.rating).to.equal(4)
    expect(json.reviewText).to.equal('Nice')
    expect(json.user.username).to.equal('testuser')
    expect(json.createdAt).to.be.a('number')
    expect(json.updatedAt).to.be.a('number')
  })
})
