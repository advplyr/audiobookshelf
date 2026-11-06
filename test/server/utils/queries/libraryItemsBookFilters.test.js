const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../../server/Database')
const Logger = require('../../../../server/Logger')
const libraryFilters = require('../../../../server/utils/queries/libraryFilters')
const libraryItemsBookFilters = require('../../../../server/utils/queries/libraryItemsBookFilters')

describe('libraryItemsBookFilters duplicates filter', () => {
  let library
  let otherLibrary
  let adminUser
  let restrictedUser

  async function createBook(lib, folder, { title, titleIgnorePrefix, asin = null, isbn = null, tags = [] }) {
    const book = await Database.bookModel.create({
      title,
      titleIgnorePrefix: titleIgnorePrefix || title,
      asin,
      isbn,
      explicit: false,
      audioFiles: [],
      tags,
      narrators: [],
      genres: [],
      chapters: []
    })
    await Database.libraryItemModel.create({
      path: `${folder.path}/${title}-${book.id}`,
      isFile: false,
      libraryFiles: [],
      mediaId: book.id,
      mediaType: 'book',
      libraryId: lib.id,
      libraryFolderId: folder.id,
      title,
      titleIgnorePrefix: titleIgnorePrefix || title
    })
    return book
  }

  async function getTitles(user, filterValue, options = {}) {
    const { sortBy = 'media.metadata.title', sortDesc = false, collapseseries = false } = options
    const { libraryItems, count } = await libraryItemsBookFilters.getFilteredLibraryItems(library.id, user, 'duplicates', filterValue, sortBy, sortDesc, collapseseries, [], 50, 0)
    return { titles: libraryItems.map((li) => li.media.title), count, libraryItems }
  }

  beforeEach(async () => {
    global.ServerSettings = { sortingIgnorePrefix: true }
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    sinon.stub(Logger, 'debug')
    sinon.stub(Logger, 'info')

    library = await Database.libraryModel.create({ name: 'Books', mediaType: 'book' })
    const folder = await Database.libraryFolderModel.create({ path: '/books', libraryId: library.id })
    otherLibrary = await Database.libraryModel.create({ name: 'Other Books', mediaType: 'book' })
    const otherFolder = await Database.libraryFolderModel.create({ path: '/other', libraryId: otherLibrary.id })

    await createBook(library, folder, { title: 'The Hobbit', titleIgnorePrefix: 'Hobbit, The', asin: 'B0001', isbn: '111', tags: ['shared'] })
    await createBook(library, folder, { title: 'Hobbit, The', titleIgnorePrefix: 'Hobbit, The', asin: 'b0001', tags: ['hidden'] })
    await createBook(library, folder, { title: 'Dune', asin: 'B0002', isbn: '222', tags: ['shared'] })
    await createBook(library, folder, { title: 'dune', isbn: '333', tags: ['shared'] })
    await createBook(library, folder, { title: 'Unique Book', asin: '', isbn: '333', tags: ['shared'] })
    await createBook(library, folder, { title: 'Another Unique', asin: '', tags: ['shared'] })
    await createBook(otherLibrary, otherFolder, { title: 'Dune', asin: 'B0002', isbn: '222' })

    adminUser = await Database.userModel.create({
      username: 'admin',
      pash: 'hash',
      token: 'token',
      type: 'admin',
      isActive: true,
      permissions: Database.userModel.getDefaultPermissionsForUserType('admin'),
      bookmarks: [],
      extraData: {}
    })

    const permissions = Database.userModel.getDefaultPermissionsForUserType('user')
    permissions.accessAllTags = false
    permissions.itemTagsSelected = ['shared']
    permissions.selectedTagsNotAccessible = false
    restrictedUser = await Database.userModel.create({
      username: 'restricted',
      pash: 'hash',
      token: 'token2',
      type: 'user',
      isActive: true,
      permissions,
      bookmarks: [],
      extraData: {}
    })
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.sync({ force: true })
  })

  it('matches titles ignoring prefix and case within the library', async () => {
    const { titles, count } = await getTitles(adminUser, 'title')

    expect(count).to.equal(4)
    expect(titles).to.have.members(['The Hobbit', 'Hobbit, The', 'Dune', 'dune'])
  })

  it('matches ASIN case-insensitively, ignores empty values and other libraries', async () => {
    const { titles, count } = await getTitles(adminUser, 'asin')

    expect(count).to.equal(2)
    expect(titles).to.have.members(['The Hobbit', 'Hobbit, The'])
  })

  it('matches ISBN', async () => {
    const { titles, count } = await getTitles(adminUser, 'isbn')

    expect(count).to.equal(2)
    expect(titles).to.have.members(['dune', 'Unique Book'])
  })

  it('keeps duplicates adjacent when sorting by another field', async () => {
    const { libraryItems } = await getTitles(adminUser, 'title', { sortBy: 'addedAt', sortDesc: true })
    const keys = libraryItems.map((li) => li.media.titleIgnorePrefix.toLowerCase())

    expect(keys).to.deep.equal(['dune', 'dune', 'hobbit, the', 'hobbit, the'])
  })

  it('works with collapse series', async () => {
    const series = await Database.seriesModel.create({ name: 'Middle-earth', libraryId: library.id })
    const hobbits = await Database.bookModel.findAll({ where: { titleIgnorePrefix: 'Hobbit, The' } })
    for (const book of hobbits) {
      await Database.bookSeriesModel.create({ bookId: book.id, seriesId: series.id, sequence: '1' })
    }

    const { titles, count } = await getTitles(adminUser, 'title', { collapseseries: true })

    expect(count).to.equal(3)
    expect(titles).to.include.members(['Dune', 'dune'])
  })

  it('still flags a visible item when its duplicate is hidden from the user', async () => {
    const { titles, count } = await getTitles(restrictedUser, 'title')

    expect(count).to.equal(3)
    expect(titles).to.have.members(['The Hobbit', 'Dune', 'dune'])
  })

  it('returns all items for an unknown value', async () => {
    const { count } = await getTitles(adminUser, 'foo')

    expect(count).to.equal(6)
  })

  it('is reachable through the encoded filterBy value', async () => {
    const { libraryItems, count } = await libraryFilters.getFilteredLibraryItems(library.id, adminUser, {
      filterBy: `duplicates.${Buffer.from('asin').toString('base64')}`,
      sortBy: 'media.metadata.title',
      sortDesc: false,
      limit: 50,
      offset: 0,
      collapseseries: false,
      include: [],
      mediaType: 'book'
    })

    expect(count).to.equal(2)
    expect(libraryItems.map((li) => li.media.title)).to.have.members(['The Hobbit', 'Hobbit, The'])
  })
})
