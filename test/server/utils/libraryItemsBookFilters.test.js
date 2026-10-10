const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')
const Database = require('../../../server/Database')
const filters = require('../../../server/utils/queries/libraryItemsBookFilters')

describe('book filters', () => {
  let previousSequelize
  let previousSettings
  let library
  let user
  let firstBook
  let secondBook
  let standalone
  let items
  let series
  beforeEach(async () => {
    previousSequelize = Database.sequelize
    previousSettings = global.ServerSettings
    global.ServerSettings = { sortingIgnorePrefix: false }
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
    filters.clearCountCache('test')
    library = await Database.libraryModel.create({ name: 'Library', mediaType: 'book', settings: {} })
    user = await Database.userModel.create({ username: 'reader', isActive: true, permissions: { accessExplicitContent: true, accessAllTags: true }, extraData: {} })
    firstBook = await Database.bookModel.create({ title: 'Story First', duration: 10, explicit: false, audioFiles: [], tags: ['Story'], genres: ['Story'], narrators: ['Story Reader'] })
    secondBook = await Database.bookModel.create({ title: 'Story Second', duration: 30, explicit: true, audioFiles: [], tags: ['Other'] })
    standalone = await Database.bookModel.create({ title: 'Story Standalone', duration: 20, explicit: false, audioFiles: [], tags: [] })
    items = []
    for (const book of [firstBook, secondBook, standalone]) {
      items.push(await Database.libraryItemModel.create({ libraryId: library.id, mediaId: book.id, mediaType: 'book', size: book.duration, title: book.title, titleIgnorePrefix: book.title, libraryFiles: [] }))
    }
    const author = await Database.authorModel.create({ libraryId: library.id, name: 'Story Author' })
    await Database.bookAuthorModel.create({ bookId: firstBook.id, authorId: author.id })
    series = await Database.seriesModel.create({ libraryId: library.id, name: 'Story Series' })
    await Database.bookSeriesModel.create({ bookId: firstBook.id, seriesId: series.id, sequence: '1' })
    await Database.bookSeriesModel.create({ bookId: secondBook.id, seriesId: series.id, sequence: '2' })
  })
  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.close()
    Database.sequelize = previousSequelize
    global.ServerSettings = previousSettings
  })

  it('caches unfiltered counts and hydrates ordered metadata with an unbounded limit', async () => {
    const count = sinon.spy(Database.bookModel, 'count')
    for (let i = 0; i < 2; i++) {
      const result = await filters.getFilteredLibraryItems(library.id, user, null, null, 'media.metadata.title', false, false, [], 0, 0)
      expect(result.count).to.equal(3)
      expect(result.libraryItems.map((li) => li.id)).to.deep.equal(items.map((li) => li.id))
      expect(result.libraryItems[0].media.authors.map((a) => a.name)).to.deep.equal(['Story Author'])
      expect(result.libraryItems[0].media.series[0].bookSeries.sequence).to.equal('1')
    }
    sinon.assert.calledOnce(count)
  })

  it('collapses series to the first sequence and includes the original member IDs', async () => {
    const result = await filters.getFilteredLibraryItems(library.id, user, null, null, 'media.metadata.title', false, true, [], 10, 0)
    expect(result.count).to.equal(2)
    expect(result.libraryItems.map((li) => li.id)).to.have.members([items[0].id, items[2].id])
    const collapsed = result.libraryItems.find((li) => li.id === items[0].id).collapsedSeries
    expect(collapsed).to.include({ id: series.id, sequence: '1', numBooks: 2 })
    expect(collapsed.libraryItemIds).to.have.members([items[0].id, items[1].id])
  })

  it('applies progress and tag permissions without changing explicit access rules', async () => {
    await Database.mediaProgressModel.create({ userId: user.id, mediaItemId: firstBook.id, mediaItemType: 'book', isFinished: false, currentTime: 2, hideFromContinueListening: false })
    const progress = await filters.getFilteredLibraryItems(library.id, user, 'progress', 'in-progress', 'progress', true, false, [], 10, 0, true)
    expect(progress.libraryItems.map((li) => li.id)).to.deep.equal([items[0].id])
    user.permissions = { accessExplicitContent: false, accessAllTags: false, itemTagsSelected: ['Story'] }
    const restricted = await filters.getFilteredLibraryItems(library.id, user, null, null, 'addedAt', false, false, [], 10, 0)
    expect(restricted.count).to.equal(1)
    expect(restricted.libraryItems[0].id).to.equal(items[0].id)
  })

  it('selects the next unfinished series entry and excludes started series from discovery', async () => {
    await Database.mediaProgressModel.create({ userId: user.id, mediaItemId: firstBook.id, mediaItemType: 'book', isFinished: true, currentTime: 10 })
    const continued = await filters.getContinueSeriesLibraryItems(library, user, [], 10, 0)
    expect(continued.libraryItems.map((li) => li.id)).to.deep.equal([items[1].id])
    expect(continued.libraryItems[0].series).to.include({ id: series.id, sequence: '2' })
    const discover = await filters.getDiscoverLibraryItems(library.id, user, [], 10)
    expect(discover.count).to.equal(1)
    expect(discover.libraryItems.map((li) => li.id)).to.deep.equal([items[2].id])
    user.extraData = { seriesHideFromContinueListening: [series.id] }
    expect((await filters.getContinueSeriesLibraryItems(library, user, [], 10, 0)).libraryItems).to.deep.equal([])
  })

  it('expands collection members and series queries with their sequence metadata', async () => {
    expect((await filters.getLibraryItemsForCollection({ books: [items[1].id] })).map((li) => li.id)).to.deep.equal([items[1].id])
    const seriesItems = await filters.getLibraryItemsForSeries(series, user)
    expect(seriesItems.map((li) => li.id)).to.deep.equal([items[0].id, items[1].id])
    expect(seriesItems[0].series.sequence).to.equal('1')
  })

  it('preserves search groups and raw SQLite statistics', async () => {
    const result = await filters.search(user, library, 'Story', 10, 0)
    expect(result.book).to.have.length(3)
    expect(result.authors[0]).to.include({ name: 'Story Author', numBooks: 1 })
    expect(result.series[0].books).to.have.length(2)
    expect(result.narrators).to.deep.equal([{ name: 'Story Reader', numBooks: 1 }])
    expect(result.tags).to.deep.equal([{ name: 'Story', numItems: 1 }])
    expect(result.genres).to.deep.equal([{ name: 'Story', numItems: 1 }])
    expect(await filters.getGenresWithCount(library.id)).to.deep.equal([{ genre: 'Story', count: 1 }])
    expect(await filters.getBookLibraryStats(library.id)).to.deep.equal({ totalSize: 60, totalDuration: 60, numAudioFiles: 0, totalItems: 3 })
    expect(await filters.getLongestBooks(library.id, 1)).to.deep.equal([{ id: items[1].id, title: 'Story Second', duration: 30 }])
  })
})
