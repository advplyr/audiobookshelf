const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')
const CollectionController = require('../../../server/controllers/CollectionController')

describe('CollectionController.addBook', () => {
  /** @type {import('../../../server/models/Collection')} */
  let collection
  /** @type {import('../../../server/models/LibraryItem')} */
  let libraryItem

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'debug')
    sinon.stub(Logger, 'warn')
    sinon.stub(Logger, 'error')

    const library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
    const libraryFolder = await Database.libraryFolderModel.create({ path: '/test-lib', libraryId: library.id })
    const book = await Database.bookModel.create({ title: 'Test Book', audioFiles: [], tags: [], narrators: [], genres: [], chapters: [] })
    libraryItem = await Database.libraryItemModel.create({
      path: '/test-lib/book',
      isFile: false,
      libraryFiles: [],
      mediaId: book.id,
      mediaType: 'book',
      libraryId: library.id,
      libraryFolderId: libraryFolder.id
    })
    collection = await Database.collectionModel.create({ name: 'Test Collection', libraryId: library.id })
    await Database.collectionBookModel.create({ collectionId: collection.id, bookId: book.id, order: 1 })
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.sync({ force: true })
  })

  it('does not throw when the collectionBook link already exists', async () => {
    sinon.stub(collection, 'getCollectionBooks').resolves([])

    const res = {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code
        return this
      },
      send(body) {
        this.body = body
        return this
      },
      json(body) {
        this.body = body
        return this
      }
    }

    await CollectionController.addBook({ body: { id: libraryItem.id }, collection, user: { id: 'user-id' } }, res)

    expect(res.statusCode).to.equal(400)
    expect(res.body).to.equal('Book already in collection')
    const links = await Database.collectionBookModel.findAll({ where: { collectionId: collection.id, bookId: libraryItem.mediaId } })
    expect(links).to.have.lengthOf(1)
  })
})
