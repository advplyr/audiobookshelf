const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const Database = require('../../../server/Database')

describe('Collection model', () => {
  let previousSequelize
  let previousSettings
  let library
  let collection
  let firstBook
  let secondBook
  beforeEach(async () => {
    previousSequelize = Database.sequelize
    previousSettings = global.ServerSettings
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
    library = await Database.libraryModel.create({ name: 'Library', mediaType: 'book' })
    collection = await Database.collectionModel.create({ name: 'Collection', libraryId: library.id })
    firstBook = await Database.bookModel.create({ title: 'First', tags: ['allowed'], audioFiles: [], narrators: [], chapters: [], genres: [] })
    secondBook = await Database.bookModel.create({ title: 'Second', tags: ['restricted'], explicit: true, audioFiles: [], narrators: [], chapters: [], genres: [] })
    for (const book of [firstBook, secondBook]) {
      await Database.libraryItemModel.create({ mediaId: book.id, mediaType: 'book', libraryId: library.id, libraryFiles: [] })
    }
    await Database.collectionBookModel.create({ collectionId: collection.id, bookId: secondBook.id, order: 2 })
    await Database.collectionBookModel.create({ collectionId: collection.id, bookId: firstBook.id, order: 1 })
  })
  afterEach(async () => {
    await Database.sequelize.close()
    Database.sequelize = previousSequelize
    global.ServerSettings = previousSettings
  })

  it('expands books in join order and serializes the original library items', async () => {
    const expanded = await Database.collectionModel.getExpandedById(collection.id)
    expect(expanded.books.map((book) => book.id)).to.deep.equal([firstBook.id, secondBook.id])
    const json = expanded.toOldJSONExpanded()
    expect(json.books.map((item) => item.media.metadata.title)).to.deep.equal(['First', 'Second'])
    expect(json).to.include({ id: collection.id, name: 'Collection', libraryId: library.id })
    expect(json.lastUpdate).to.be.a('number')
    expect(expanded.books[0]).not.to.have.property('libraryItem')
    expect(() => collection.toOldJSONExpanded()).to.throw('Books are required')
  })

  it('filters instance expansion by tags and explicit-content permission', async () => {
    const user = { checkCanAccessLibraryItemWithTags: (tags) => tags.includes('allowed'), canAccessExplicitContent: false }
    const json = await collection.getOldJsonExpanded(user)
    expect(json.books).to.have.length(1)
    expect(json.books[0].media.metadata.title).to.equal('First')
    const blocked = { checkCanAccessLibraryItemWithTags: () => false, canAccessExplicitContent: false }
    expect(await collection.getOldJsonExpanded(blocked)).to.equal(null)
  })

  it('supports unfiltered static expansion, inaccessible collections and library removal', async () => {
    const all = await Database.collectionModel.getOldCollectionsJsonExpanded(null)
    expect(all).to.have.length(1)
    expect(all[0].books).to.have.length(2)
    const blocked = { checkCanAccessLibraryItemWithTags: () => false, canAccessExplicitContent: false }
    expect(await Database.collectionModel.getOldCollectionsJsonExpanded(blocked, library.id)).to.deep.equal([])
    expect(await Database.collectionModel.getExpandedById('missing')).to.equal(null)
    expect(await Database.collectionModel.removeAllForLibrary('')).to.equal(0)
    expect(await Database.collectionModel.removeAllForLibrary(library.id)).to.equal(1)
  })
})
