const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')
const LibraryController = require('../../../server/controllers/LibraryController')

describe('Collection.getOldCollectionsJsonExpanded', () => {
  let library

  async function createBook(title, { tags = [], explicit = false } = {}) {
    const book = await Database.bookModel.create({ title, audioFiles: [], tags, narrators: [], genres: [], chapters: [], explicit })
    await Database.libraryItemModel.create({
      libraryId: library.id,
      libraryFolderId: library.libraryFolders[0].id,
      mediaId: book.id,
      mediaType: 'book',
      path: `/books/${title}`,
      relPath: title,
      isFile: false,
      libraryFiles: [],
      size: 0
    })
    return book
  }

  async function createCollection(name, books) {
    const collection = await Database.collectionModel.create({ name, libraryId: library.id })
    for (const [order, book] of books.entries()) {
      await Database.collectionBookModel.create({ collectionId: collection.id, bookId: book.id, order: order + 1 })
    }
    return collection
  }

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'debug')
    sinon.stub(Logger, 'warn')
    sinon.stub(Logger, 'error')

    library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
    library.libraryFolders = [await Database.libraryFolderModel.create({ path: '/books', libraryId: library.id })]
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.sync({ force: true })
  })

  it('hides books the user is not allowed to access', async () => {
    const open = await createBook('Open')
    const tagged = await createBook('Tagged', { tags: ['secret'] })
    const explicit = await createBook('Explicit', { explicit: true })
    await createCollection('Mixed', [open, tagged, explicit])

    const user = {
      canAccessExplicitContent: false,
      checkCanAccessLibraryItemWithTags: (tags) => !tags.includes('secret')
    }
    const result = await Database.collectionModel.getOldCollectionsJsonExpanded(user, library.id)

    expect(result).to.have.lengthOf(1)
    expect(result[0].books.map((b) => b.media.metadata.title)).to.deep.equal(['Open'])
  })

  it('omits collections whose books are all hidden from the user', async () => {
    const open = await createBook('Open')
    const tagged = await createBook('Tagged', { tags: ['secret'] })
    await createCollection('Visible', [open])
    await createCollection('Hidden', [tagged])
    await createCollection('Empty', [])

    const user = {
      canAccessExplicitContent: true,
      checkCanAccessLibraryItemWithTags: (tags) => !tags.includes('secret')
    }
    const result = await Database.collectionModel.getOldCollectionsJsonExpanded(user, library.id)

    expect(result.map((c) => c.name)).to.deep.equal(['Visible', 'Empty'])
  })

  describe('getOldCollectionsJsonExpandedPage', () => {
    const user = {
      canAccessExplicitContent: true,
      checkCanAccessLibraryItemWithTags: (tags) => !tags.includes('secret')
    }

    beforeEach(async () => {
      for (let i = 1; i <= 5; i++) {
        const book = await createBook(`Book ${i}`)
        const collection = await createCollection(`Collection ${i}`, [book])
        // Keep createdAt strictly increasing so the order is deterministic
        await collection.update({ createdAt: new Date(Date.UTC(2026, 0, i)) }, { silent: true })
      }
      const hiddenBook = await createBook('Hidden', { tags: ['secret'] })
      await createCollection('Hidden', [hiddenBook])
    })

    it('returns the requested page and counts only collections the user can see', async () => {
      const first = await Database.collectionModel.getOldCollectionsJsonExpandedPage(user, library.id, [], 2, 0)
      expect(first.total).to.equal(5)
      expect(first.collections.map((c) => c.name)).to.deep.equal(['Collection 1', 'Collection 2'])

      const second = await Database.collectionModel.getOldCollectionsJsonExpandedPage(user, library.id, [], 2, 1)
      expect(second.collections.map((c) => c.name)).to.deep.equal(['Collection 3', 'Collection 4'])

      const last = await Database.collectionModel.getOldCollectionsJsonExpandedPage(user, library.id, [], 2, 2)
      expect(last.total).to.equal(5)
      expect(last.collections.map((c) => c.name)).to.deep.equal(['Collection 5'])
    })

    it('returns every collection when no limit is given', async () => {
      const all = await Database.collectionModel.getOldCollectionsJsonExpandedPage(user, library.id, [], 0, 0)
      expect(all.total).to.equal(5)
      expect(all.collections).to.have.lengthOf(5)
    })

    it('is paginated by LibraryController.getCollectionsForLibrary using the query string values', async () => {
      const call = async (query) => {
        const res = { json: sinon.spy() }
        await LibraryController.getCollectionsForLibrary({ query, library, user }, res)
        return res.json.firstCall.args[0]
      }

      const second = await call({ limit: '2', page: '1' })
      expect(second.total).to.equal(5)
      expect(second.results.map((c) => c.name)).to.deep.equal(['Collection 3', 'Collection 4'])

      const last = await call({ limit: '2', page: '2' })
      expect(last.results.map((c) => c.name)).to.deep.equal(['Collection 5'])

      const all = await call({})
      expect(all.results).to.have.lengthOf(5)
    })

    it('only loads the books of the collections on the requested page', async () => {
      const findAll = sinon.spy(Database.collectionModel, 'findAll')
      const result = await Database.collectionModel.getOldCollectionsJsonExpandedPage(user, library.id, [], 2, 1)
      expect(result.collections.map((c) => c.name)).to.deep.equal(['Collection 3', 'Collection 4'])
      // permission scan + expansion of the page
      expect(findAll.callCount).to.equal(2)
      expect(findAll.secondCall.args[0].where.id).to.have.lengthOf(2)
    })
  })
})
