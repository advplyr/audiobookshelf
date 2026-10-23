const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const Database = require('../../../server/Database')
const authorFilters = require('../../../server/utils/queries/authorFilters')

describe('author filter queries', () => {
  let previousSequelize
  let previousSettings
  let library
  let author
  beforeEach(async () => {
    previousSequelize = Database.sequelize
    previousSettings = global.ServerSettings
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
    library = await Database.libraryModel.create({ name: 'Library', mediaType: 'book' })
    author = await Database.authorModel.create({ libraryId: library.id, name: "O'Brian" })
    const otherAuthor = await Database.authorModel.create({ libraryId: library.id, name: 'Other' })
    for (let index = 0; index < 2; index++) {
      const book = await Database.bookModel.create({ title: `Book ${index}` })
      await Database.bookAuthorModel.create({ bookId: book.id, authorId: author.id })
      if (!index) await Database.bookAuthorModel.create({ bookId: book.id, authorId: otherAuthor.id })
    }
    const otherLibrary = await Database.libraryModel.create({ name: 'Other Library', mediaType: 'book' })
    await Database.authorModel.create({ libraryId: otherLibrary.id, name: "O'Brian" })
  })
  afterEach(async () => {
    await Database.sequelize.close()
    Database.sequelize = previousSequelize
    global.ServerSettings = previousSettings
  })

  it('counts authors within a library and orders grouped book counts', async () => {
    expect(await authorFilters.getAuthorsTotalCount(library.id)).to.equal(2)
    const counts = await authorFilters.getAuthorsWithCount(library.id, 10)
    expect(counts).to.deep.equal([{ id: author.id, name: "O'Brian", count: 2 }, { id: counts[1].id, name: 'Other', count: 1 }])
    expect(await authorFilters.getAuthorsWithCount(library.id, 1)).to.have.length(1)
    expect(await authorFilters.getAuthorsTotalCount('missing')).to.equal(0)
  })

  it('uses escaped search expressions and returns legacy author JSON with counts', async () => {
    const query = new Database.TextSearchQuery(Database.sequelize, false, "O'B")
    await query.init()
    const matches = await authorFilters.search(library.id, query, 10, 0)
    expect(matches).to.have.length(1)
    expect(matches[0]).to.include({ id: author.id, name: "O'Brian", numBooks: 2, libraryId: library.id })
    expect(matches[0].addedAt).to.be.a('number')
    expect(await authorFilters.search(library.id, query, 10, 1)).to.deep.equal([])
  })
})
