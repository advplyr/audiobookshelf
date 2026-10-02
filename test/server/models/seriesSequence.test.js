const { expect } = require('chai')
const { Sequelize } = require('sequelize')

const Database = require('../../../server/Database')
const bookFilters = require('../../../server/utils/queries/libraryItemsBookFilters')

describe('Series sequence', () => {
  let library
  let folder
  let series
  let user
  let previousServerSettings

  beforeEach(async () => {
    previousServerSettings = global.ServerSettings
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.slice(1)}` : '')
    await Database.buildModels()
    library = await Database.libraryModel.create({ name: 'Books', mediaType: 'book', settings: { onlyShowLaterBooksInContinueSeries: false } })
    folder = await Database.libraryFolderModel.create({ libraryId: library.id, path: '/books' })
    series = await Database.seriesModel.create({ name: 'Test Series', libraryId: library.id })
    user = await Database.userModel.create({ username: 'reader', type: 'admin', isActive: true, permissions: { accessExplicitContent: true, accessAllTags: true }, extraData: {} })
  })

  afterEach(async () => {
    await Database.sequelize.close()
    global.ServerSettings = previousServerSettings
  })

  async function createBook(sequence, addToSeries = true) {
    const book = await Database.bookModel.create({ title: 'Series Book', audioFiles: [], tags: [], genres: [], narrators: [], chapters: [] })
    await Database.libraryItemModel.create({ mediaId: book.id, mediaType: 'book', libraryId: library.id, libraryFolderId: folder.id, title: book.title, libraryFiles: [] })
    if (addToSeries) {
      // Write legacy values directly, without going through the request normalization.
      await Database.bookSeriesModel.create({ bookId: book.id, seriesId: series.id, sequence })
    }
    book.series = await book.getSeries()
    return book
  }

  describe('editing series', () => {
    for (const sequence of ['', ' \t\r\n ', null, undefined]) {
      it(`stores ${JSON.stringify(sequence)} as NULL when adding a book to a series`, async () => {
        const book = await createBook(null, false)
        const result = await book.updateSeriesFromRequest([{ name: series.name, sequence }], library.id)
        const saved = await Database.bookSeriesModel.findOne({ where: { bookId: book.id, seriesId: series.id } })
        expect(result.hasUpdates).to.equal(true)
        expect(saved.sequence).to.equal(null)
      })
    }

    for (const sequence of ['', ' \t\n ']) {
      it(`clears an existing sequence with ${JSON.stringify(sequence)}`, async () => {
        const book = await createBook('2')
        await book.updateSeriesFromRequest([{ name: series.name, sequence }], library.id)
        const saved = await Database.bookSeriesModel.findOne({ where: { bookId: book.id, seriesId: series.id } })
        expect(saved.sequence).to.equal(null)
      })
    }

    for (const sequence of ['0', '1.5', '10']) {
      it(`preserves the valid sequence ${sequence}`, async () => {
        const book = await createBook(null, false)
        await book.updateSeriesFromRequest([{ name: series.name, sequence }], library.id)
        const saved = await Database.bookSeriesModel.findOne({ where: { bookId: book.id, seriesId: series.id } })
        expect(saved.sequence).to.equal(sequence)
      })
    }

    it('does not report an update when an unnumbered book is saved with a blank sequence again', async () => {
      const book = await createBook(null)
      const result = await book.updateSeriesFromRequest([{ name: series.name, sequence: '' }], library.id)
      expect(result.hasUpdates).to.equal(false)
    })
  })

  describe('sorting existing data', () => {
    let numberedIds
    let unnumberedIds

    beforeEach(async () => {
      unnumberedIds = []
      for (const sequence of ['', '   ', '\t\r\n', null]) {
        unnumberedIds.push((await createBook(sequence)).id)
      }
      numberedIds = []
      for (const sequence of ['10', '2', '1.5', '1', '0']) {
        numberedIds.unshift((await createBook(sequence)).id)
      }
    })

    function expectAscending(ids) {
      expect(ids.slice(0, numberedIds.length)).to.deep.equal(numberedIds)
      expect(ids.slice(numberedIds.length)).to.have.members(unnumberedIds)
    }

    function getFiltered(sortBy = 'sequence', sortDesc = false, limit = 20, offset = 0) {
      return bookFilters.getFilteredLibraryItems(library.id, user, 'series', series.id, sortBy, sortDesc, false, [], limit, offset)
    }

    it('places legacy blanks after numbered books in expanded series', async () => {
      const expanded = await Database.seriesModel.getExpandedById(series.id)
      expectAscending(expanded.books.map((book) => book.id))
    })

    it('places legacy blanks last when filtering library items by series', async () => {
      const { libraryItems, count } = await getFiltered()
      expect(count).to.equal(9)
      expectAscending(libraryItems.map((item) => item.media.id))
    })

    it('preserves the reverse order, including NULLS FIRST, for descending sequence sorting', async () => {
      const { libraryItems } = await getFiltered('sequence', true)
      const ids = libraryItems.map((item) => item.media.id)
      expect(ids.slice(0, unnumberedIds.length)).to.have.members(unnumberedIds)
      expect(ids.slice(unnumberedIds.length)).to.deep.equal([...numberedIds].reverse())
    })

    it('applies the sequence order before pagination', async () => {
      const { libraryItems, count } = await getFiltered('sequence', false, 2, 2)
      expect(count).to.equal(9)
      expect(libraryItems.map((item) => item.media.id)).to.deep.equal(numberedIds.slice(2, 4))
    })

    it('uses the same sequence order as a secondary sort', async () => {
      const { libraryItems } = await getFiltered('media.metadata.title')
      expectAscending(libraryItems.map((item) => item.media.id))
    })

    it('uses the first numbered book to represent a collapsed series', async () => {
      const { libraryItems } = await bookFilters.getFilteredLibraryItems(library.id, user, null, null, 'media.metadata.title', false, true, [], 20, 0)
      expect(libraryItems.map((item) => item.media.id)).to.deep.equal([numberedIds[0]])
    })

    it('suggests the next numbered book before unnumbered books in Continue Series', async () => {
      await Database.mediaProgressModel.create({ userId: user.id, mediaItemId: numberedIds[0], mediaItemType: 'book', isFinished: true, currentTime: 100 })
      const { libraryItems } = await bookFilters.getContinueSeriesLibraryItems(library, user, [], 20, 0)
      expect(libraryItems.map((item) => item.media.id)).to.deep.equal([numberedIds[1]])
    })

    it('uses the first numbered book for an unstarted series in Discover', async () => {
      const { libraryItems } = await bookFilters.getDiscoverLibraryItems(library.id, user, [], 20)
      expect(libraryItems.map((item) => item.media.id)).to.deep.equal([numberedIds[0]])
    })

    it('keeps a series containing only unnumbered books visible', async () => {
      await Database.bookModel.destroy({ where: { id: numberedIds } })
      const expanded = await Database.seriesModel.getExpandedById(series.id)
      expect(expanded.books.map((book) => book.id)).to.have.members(unnumberedIds)
      const { libraryItems } = await bookFilters.getDiscoverLibraryItems(library.id, user, [], 20)
      expect(libraryItems).to.have.length(1)
      expect(unnumberedIds).to.include(libraryItems[0].media.id)
    })
  })
})
