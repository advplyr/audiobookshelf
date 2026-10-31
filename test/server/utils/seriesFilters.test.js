const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')
const Database = require('../../../server/Database')
const filters = require('../../../server/utils/queries/seriesFilters')

describe('series filters', () => {
  let previousSequelize
  let previousSettings
  let library
  let user
  let series
  let secondSeries
  let firstBook
  let secondBook
  beforeEach(async () => {
    previousSequelize = Database.sequelize
    previousSettings = global.ServerSettings
    global.ServerSettings = { sortingIgnorePrefix: false }
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
    library = await Database.libraryModel.create({ name: 'Library', mediaType: 'book', settings: { hideSingleBookSeries: false } })
    user = await Database.userModel.create({ username: 'reader', isActive: true, permissions: { accessExplicitContent: true, accessAllTags: true } })
    series = await Database.seriesModel.create({ name: 'Series A', libraryId: library.id })
    secondSeries = await Database.seriesModel.create({ name: 'Series B', libraryId: library.id })
    firstBook = await Database.bookModel.create({ title: 'First', audioFiles: [], explicit: false, duration: 10, tags: ['Favorite'], genres: ['Fantasy'], narrators: ['Reader'] })
    secondBook = await Database.bookModel.create({ title: 'Second', audioFiles: [], explicit: true, duration: 20, tags: ['Other'], genres: ['History'], narrators: ['Other'] })
    for (const book of [firstBook, secondBook]) {
      await Database.libraryItemModel.create({ libraryId: library.id, mediaId: book.id, mediaType: 'book', libraryFiles: [] })
    }
    await Database.bookSeriesModel.create({ seriesId: series.id, bookId: secondBook.id, sequence: '10' })
    await Database.bookSeriesModel.create({ seriesId: series.id, bookId: firstBook.id, sequence: '2' })
    await Database.bookSeriesModel.create({ seriesId: secondSeries.id, bookId: secondBook.id, sequence: '1' })
  })
  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.close()
    Database.sequelize = previousSequelize
    global.ServerSettings = previousSettings
  })

  it('sorts series and their books and preserves duration and pagination output', async () => {
    const result = await filters.getFilteredSeries(library, user, '', 'totalDuration', true, [], 1, 0)
    expect(result.count).to.equal(2)
    expect(result.series).to.have.length(1)
    expect(result.series[0]).to.include({ id: series.id, totalDuration: 30 })
    expect(result.series[0].books.map((item) => item.media.metadata.title)).to.deep.equal(['First', 'Second'])
    library.settings = { hideSingleBookSeries: true }
    expect((await filters.getFilteredSeries(library, user, '', 'name', false, [], 10, 0)).count).to.equal(1)
  })

  it('filters by metadata and user permissions while retaining visible book order', async () => {
    const encoded = Buffer.from('Favorite').toString('base64')
    const result = await filters.getFilteredSeries(library, user, `tags.${encoded}`, 'name', false, [], 10, 0)
    expect(result.series.map((s) => s.id)).to.deep.equal([series.id])
    user.permissions = { accessExplicitContent: false, accessAllTags: false, itemTagsSelected: ['Favorite'] }
    const restricted = await filters.getFilteredSeries(library, user, '', 'name', false, [], 10, 0)
    expect(restricted.count).to.equal(1)
    expect(restricted.series[0].books.map((item) => item.media.metadata.title)).to.deep.equal(['First'])
  })

  it('filters completed series using the requesting user progress', async () => {
    for (const book of [firstBook, secondBook]) {
      await Database.mediaProgressModel.create({ userId: user.id, mediaItemId: book.id, mediaItemType: 'book', isFinished: true })
    }
    const encoded = Buffer.from('finished').toString('base64')
    expect((await filters.getFilteredSeries(library, user, `progress.${encoded}`, 'name', false, [], 10, 0)).count).to.equal(2)
    expect(filters.decode('%invalid')).to.equal(null)
  })
})
