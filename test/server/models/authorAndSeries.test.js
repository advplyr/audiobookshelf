const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const Database = require('../../../server/Database')

describe('authors and series', () => {
  let previousSequelize
  let previousSettings

  beforeEach(async () => {
    previousSequelize = Database.sequelize
    previousSettings = global.ServerSettings
    global.ServerSettings = { sortingPrefixes: ['the'], sortingIgnorePrefix: true }
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
  })

  afterEach(async () => {
    await Database.sequelize.close()
    Database.sequelize = previousSequelize
    global.ServerSettings = previousSettings
  })

  it('finds authors case-insensitively within a library and preserves old JSON', async () => {
    const library = await Database.libraryModel.create({ name: 'Books' })
    const first = await Database.authorModel.findOrCreateByNameAndLibrary('Jane Doe', library.id)
    const second = await Database.authorModel.findOrCreateByNameAndLibrary('jane doe', library.id)
    expect(first.created).to.equal(true)
    expect(second.created).to.equal(false)
    expect(second.author.id).to.equal(first.author.id)
    expect(first.author.lastFirst).to.equal('Doe, Jane')
    expect(Database.authorModel.getLastFirst(null)).to.equal(null)
    expect(first.author.toOldJSONExpanded(3)).to.include({ numBooks: 3, addedAt: first.author.createdAt.valueOf() })
    expect(await Database.authorModel.checkExistsById(first.author.id)).to.equal(true)
    expect(await Database.authorModel.getByNameAndLibrary('Missing', library.id)).to.equal(null)
  })

  it('returns library items with expanded media and removes the back-reference', async () => {
    const author = await Database.authorModel.create({ name: 'Author' })
    const book = await Database.bookModel.create({ title: 'Book' })
    const item = await Database.libraryItemModel.create({ mediaId: book.id, mediaType: 'book', libraryFiles: [] })
    await Database.bookAuthorModel.create({ authorId: author.id, bookId: book.id })
    const items = await Database.authorModel.getAllLibraryItemsForAuthor(author.id)
    expect(items.map((entry) => entry.id)).to.deep.equal([item.id])
    expect(items[0].media.id).to.equal(book.id)
    expect(items[0].media).not.to.have.property('libraryItem')
    try {
      await Database.authorModel.getAllLibraryItemsForAuthor('missing')
      expect.fail('Expected the existing missing-author failure')
    } catch (error) {
      expect(error).to.be.instanceOf(TypeError)
    }
  })

  it('reuses series names and sorts numeric sequences before missing sequences', async () => {
    const library = await Database.libraryModel.create({ name: 'Books' })
    const series = await Database.seriesModel.findOrCreateByNameAndLibrary('The Series', library.id)
    expect((await Database.seriesModel.findOrCreateByNameAndLibrary('the series', library.id)).id).to.equal(series.id)
    expect(series.nameIgnorePrefix).to.equal('Series')
    expect(series.toOldJSON().nameIgnorePrefix).to.equal('Series, The')
    for (const sequence of ['10', null, '2']) {
      const book = await Database.bookModel.create({ title: `Book ${sequence}` })
      await Database.libraryItemModel.create({ mediaId: book.id, mediaType: 'book', libraryFiles: [] })
      await Database.bookSeriesModel.create({ seriesId: series.id, bookId: book.id, sequence })
    }
    const expanded = await Database.seriesModel.getExpandedById(series.id)
    expect(expanded.books.map((book) => book.bookSeries.sequence)).to.deep.equal(['2', '10', null])
    expect(await Database.seriesModel.getExpandedById('missing')).to.equal(null)
    expect(await Database.seriesModel.checkExistsById(series.id)).to.equal(true)
    expect(series.toJSONMinimal('2')).to.deep.equal({ id: series.id, name: 'The Series', sequence: '2' })
  })
})
