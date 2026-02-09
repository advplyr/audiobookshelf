const { expect } = require('chai')
const { Sequelize } = require('sequelize')

const Database = require('../../../../server/Database')
const libraryItemsBookFilters = require('../../../../server/utils/queries/libraryItemsBookFilters')
const User = require('../../../../server/models/User')

describe('libraryItemsBookFilters placeholders', () => {
  let library
  let libraryFolder
  let user

  beforeEach(async () => {
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
    libraryFolder = await Database.libraryFolderModel.create({ path: '/test', libraryId: library.id })
    user = await Database.userModel.create({
      username: 'Admin',
      type: 'admin',
      isActive: true,
      permissions: User.getDefaultPermissionsForUserType('admin'),
      bookmarks: [],
      extraData: { seriesHideFromContinueListening: [] }
    })
  })

  afterEach(async () => {
    await Database.sequelize.sync({ force: true })
  })

  const createBookWithItem = async ({ title, isPlaceholder }) => {
    const book = await Database.bookModel.create({
      title,
      audioFiles: [],
      tags: [],
      narrators: [],
      genres: [],
      chapters: []
    })

    return Database.libraryItemModel.create({
      libraryFiles: [],
      mediaId: book.id,
      mediaType: 'book',
      libraryId: library.id,
      libraryFolderId: libraryFolder.id,
      isPlaceholder
    })
  }

  it('excludes placeholders from general library list queries', async () => {
    await createBookWithItem({ title: 'Real Book', isPlaceholder: false })
    await createBookWithItem({ title: 'Placeholder Book', isPlaceholder: true })

    const { libraryItems, count } = await libraryItemsBookFilters.getFilteredLibraryItems(
      library.id,
      user,
      null,
      null,
      'addedAt',
      true,
      false,
      [],
      20,
      0
    )

    expect(count).to.equal(1)
    expect(libraryItems).to.have.length(1)
    expect(libraryItems[0].media.title).to.equal('Real Book')
  })

  it('excludes placeholders from search results', async () => {
    await createBookWithItem({ title: 'Real Book', isPlaceholder: false })
    await createBookWithItem({ title: 'Placeholder Book', isPlaceholder: true })

    const results = await libraryItemsBookFilters.search(user, library, 'Placeholder', 20, 0)

    expect(results.book).to.have.length(0)
  })
})
