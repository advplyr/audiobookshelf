const { expect } = require('chai')
const { Sequelize } = require('sequelize')

const Database = require('../../../../server/Database')
const libraryItemFilters = require('../../../../server/utils/queries/libraryItemFilters')

describe('libraryItemFilters placeholders', () => {
  let library
  let libraryFolder

  beforeEach(async () => {
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    global.ServerSettings = { sortingPrefixes: [] }
    await Database.buildModels()

    library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
    libraryFolder = await Database.libraryFolderModel.create({ path: '/test', libraryId: library.id })
  })

  afterEach(async () => {
    await Database.sequelize.sync({ force: true })
  })

  const createBookWithItem = async ({ title, tags = [], genres = [], narrators = [], isPlaceholder = false }) => {
    const book = await Database.bookModel.create({
      title,
      audioFiles: [],
      tags,
      narrators,
      genres,
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

  it('excludes placeholders when filtering by tags', async () => {
    const realItem = await createBookWithItem({ title: 'Real Book', tags: ['real-tag'], isPlaceholder: false })
    await createBookWithItem({ title: 'Placeholder Book', tags: ['placeholder-tag'], isPlaceholder: true })

    const items = await libraryItemFilters.getAllLibraryItemsWithTags(['real-tag', 'placeholder-tag'])

    expect(items).to.have.length(1)
    expect(items[0].id).to.equal(realItem.libraryItem.id)
    expect(items[0].isPlaceholder).to.be.false
  })

  it('excludes placeholders when filtering by genres', async () => {
    const realItem = await createBookWithItem({ title: 'Real Book', genres: ['real-genre'], isPlaceholder: false })
    await createBookWithItem({ title: 'Placeholder Book', genres: ['placeholder-genre'], isPlaceholder: true })

    const items = await libraryItemFilters.getAllLibraryItemsWithGenres(['real-genre', 'placeholder-genre'])

    expect(items).to.have.length(1)
    expect(items[0].id).to.equal(realItem.libraryItem.id)
    expect(items[0].isPlaceholder).to.be.false
  })

  it('excludes placeholders when filtering by narrators', async () => {
    const realItem = await createBookWithItem({ title: 'Real Book', narrators: ['real-narrator'], isPlaceholder: false })
    await createBookWithItem({ title: 'Placeholder Book', narrators: ['placeholder-narrator'], isPlaceholder: true })

    const items = await libraryItemFilters.getAllLibraryItemsWithNarrators(['real-narrator', 'placeholder-narrator'])

    expect(items).to.have.length(1)
    expect(items[0].id).to.equal(realItem.libraryItem.id)
    expect(items[0].isPlaceholder).to.be.false
  })
})
