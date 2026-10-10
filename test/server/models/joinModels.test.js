const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const Database = require('../../../server/Database')

describe('folder and join models', () => {
  let previousSequelize
  let previousSettings

  beforeEach(async () => {
    previousSequelize = Database.sequelize
    previousSettings = global.ServerSettings
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
  })

  afterEach(async () => {
    await Database.sequelize.close()
    Database.sequelize = previousSequelize
    global.ServerSettings = previousSettings
  })

  it('reads folders in the legacy shape and deletes them with their library', async () => {
    const library = await Database.libraryModel.create({ name: 'Books', mediaType: 'book' })
    const folder = await Database.libraryFolderModel.create({ path: '/books', libraryId: library.id })
    const saved = await Database.libraryFolderModel.findByPk(folder.id)
    expect(saved.toOldJSON()).to.deep.equal({ id: folder.id, fullPath: '/books', libraryId: library.id, addedAt: folder.createdAt.valueOf() })
    expect(saved.createdAt).to.be.instanceOf(Date)
    await library.destroy()
    expect(await Database.libraryFolderModel.count()).to.equal(0)
  })

  it('persists series sequences and removes only matching links', async () => {
    const first = await Database.bookModel.create({ title: 'First' })
    const second = await Database.bookModel.create({ title: 'Second' })
    const series = await Database.seriesModel.create({ name: 'Series' })
    const otherSeries = await Database.seriesModel.create({ name: 'Other' })
    const link = await Database.bookSeriesModel.create({ bookId: first.id, seriesId: series.id, sequence: '1.5' })
    await Database.bookSeriesModel.create({ bookId: second.id, seriesId: series.id })
    await Database.bookSeriesModel.create({ bookId: first.id, seriesId: otherSeries.id })
    expect((await Database.bookSeriesModel.findByPk(link.id)).sequence).to.equal('1.5')
    expect(await Database.bookSeriesModel.removeByIds(series.id, first.id)).to.equal(1)
    expect(await Database.bookSeriesModel.count()).to.equal(2)
    await second.destroy()
    expect(await Database.bookSeriesModel.count()).to.equal(1)
    await otherSeries.destroy()
    expect(await Database.bookSeriesModel.count()).to.equal(0)
  })

  it('preserves collection ordering and cascading join deletion', async () => {
    const book = await Database.bookModel.create({ title: 'Book' })
    const collection = await Database.collectionModel.create({ name: 'Collection' })
    const link = await Database.collectionBookModel.create({ bookId: book.id, collectionId: collection.id, order: 3 })
    expect((await Database.collectionBookModel.findByPk(link.id)).order).to.equal(3)
    expect(Database.collectionBookModel.rawAttributes).not.to.have.property('updatedAt')
    await collection.destroy()
    expect(await Database.collectionBookModel.count()).to.equal(0)
  })
})
