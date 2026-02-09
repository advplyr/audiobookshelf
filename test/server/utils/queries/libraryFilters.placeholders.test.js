const { expect } = require('chai')
const { Sequelize } = require('sequelize')

const Database = require('../../../../server/Database')
const libraryFilters = require('../../../../server/utils/queries/libraryFilters')

describe('libraryFilters placeholders', () => {
  let library
  let libraryFolder

  beforeEach(async () => {
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    global.ServerSettings = { sortingPrefixes: [] }
    await Database.buildModels()
    Database.libraryFilterData = {}

    library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
    libraryFolder = await Database.libraryFolderModel.create({ path: '/test', libraryId: library.id })
  })

  afterEach(async () => {
    await Database.sequelize.sync({ force: true })
  })

  const createBookWithItem = async ({ title, tags, genres, narrators, publisher, publishedYear, language, isPlaceholder, isMissing }) => {
    const book = await Database.bookModel.create({
      title,
      audioFiles: [],
      tags,
      narrators,
      genres,
      publisher,
      publishedYear,
      language,
      chapters: []
    })

    await Database.libraryItemModel.create({
      libraryFiles: [],
      mediaId: book.id,
      mediaType: 'book',
      libraryId: library.id,
      libraryFolderId: libraryFolder.id,
      isPlaceholder,
      isMissing
    })
  }

  it('skips placeholder items when aggregating filter data', async () => {
    await createBookWithItem({
      title: 'Real Book',
      tags: ['real-tag'],
      genres: ['real-genre'],
      narrators: ['real-narrator'],
      publisher: 'Real Publisher',
      publishedYear: 2001,
      language: 'en',
      isPlaceholder: false,
      isMissing: false
    })
    await createBookWithItem({
      title: 'Placeholder Book',
      tags: ['placeholder-tag'],
      genres: ['placeholder-genre'],
      narrators: ['placeholder-narrator'],
      publisher: 'Placeholder Publisher',
      publishedYear: 1999,
      language: 'fr',
      isPlaceholder: true,
      isMissing: true
    })

    const data = await libraryFilters.getFilterData('book', library.id)

    expect(data.bookCount).to.equal(1)
    expect(data.numIssues).to.equal(0)
    expect(data.tags).to.include('real-tag')
    expect(data.tags).to.not.include('placeholder-tag')
    expect(data.genres).to.include('real-genre')
    expect(data.genres).to.not.include('placeholder-genre')
    expect(data.narrators).to.include('real-narrator')
    expect(data.narrators).to.not.include('placeholder-narrator')
    expect(data.publishers).to.include('Real Publisher')
    expect(data.publishers).to.not.include('Placeholder Publisher')
    expect(data.languages).to.include('en')
    expect(data.languages).to.not.include('fr')
  })
})
