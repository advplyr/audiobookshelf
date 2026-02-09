const { expect } = require('chai')
const { Sequelize } = require('sequelize')

const Database = require('../../../../server/Database')
const libraryItemsBookFilters = require('../../../../server/utils/queries/libraryItemsBookFilters')
const libraryFilters = require('../../../../server/utils/queries/libraryFilters')
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

    const libraryItem = await Database.libraryItemModel.create({
      libraryFiles: [],
      mediaId: book.id,
      mediaType: 'book',
      libraryId: library.id,
      libraryFolderId: libraryFolder.id,
      isPlaceholder
    })

    return { book, libraryItem }
  }

  const createSeriesWithBook = async ({ seriesName, title, isPlaceholder }) => {
    const series = await Database.seriesModel.create({
      name: seriesName,
      libraryId: library.id
    })
    const { book, libraryItem } = await createBookWithItem({ title, isPlaceholder })
    await Database.bookSeriesModel.create({
      seriesId: series.id,
      bookId: book.id,
      sequence: '1'
    })
    return { series, book, libraryItem }
  }

  const createAuthorWithBook = async ({ authorName, title, isPlaceholder }) => {
    const author = await Database.authorModel.create({
      name: authorName,
      libraryId: library.id
    })
    const { book, libraryItem } = await createBookWithItem({ title, isPlaceholder })
    await Database.bookAuthorModel.create({
      authorId: author.id,
      bookId: book.id
    })
    return { author, book, libraryItem }
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

  it('includes placeholders when fetching items for a series', async () => {
    const real = await createSeriesWithBook({ seriesName: 'Series A', title: 'Real Book', isPlaceholder: false })
    await createBookWithItem({ title: 'Standalone Book', isPlaceholder: false })
    await createSeriesWithBook({ seriesName: 'Series A', title: 'Placeholder Book', isPlaceholder: true })

    const items = await libraryItemsBookFilters.getLibraryItemsForSeries(real.series, user)

    expect(items).to.have.length(2)
    const titles = items.map((item) => item.media.title).sort()
    expect(titles).to.deep.equal(['Placeholder Book', 'Real Book'])
  })

  it('includes placeholders when fetching items for an author', async () => {
    const real = await createAuthorWithBook({ authorName: 'Author A', title: 'Real Book', isPlaceholder: false })
    await createBookWithItem({ title: 'Standalone Book', isPlaceholder: false })
    await createAuthorWithBook({ authorName: 'Author A', title: 'Placeholder Book', isPlaceholder: true })

    const { libraryItems, count } = await libraryFilters.getLibraryItemsForAuthor(real.author, user, 20, 0)

    expect(count).to.equal(2)
    const titles = libraryItems.map((item) => item.media.title).sort()
    expect(titles).to.deep.equal(['Placeholder Book', 'Real Book'])
  })
})
