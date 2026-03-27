const { expect } = require('chai')
const { Sequelize } = require('sequelize')

const Database = require('../../../../server/Database')
const libraryItemsBookFilters = require('../../../../server/utils/queries/libraryItemsBookFilters')

describe('libraryItemsBookFilters.search', () => {
  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    Database.supportsUnaccent = false
    await Database.buildModels()
  })

  afterEach(async () => {
    await Database.sequelize.close()
  })

  it('matches titles when the query omits commas', async () => {
    const library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
    const libraryFolder = await Database.libraryFolderModel.create({ path: '/test', libraryId: library.id })
    const book = await Database.bookModel.create({
      title: 'And Now, Back to You',
      audioFiles: [],
      tags: [],
      narrators: [],
      genres: [],
      chapters: []
    })
    await Database.libraryItemModel.create({
      libraryFiles: [],
      mediaId: book.id,
      mediaType: 'book',
      libraryId: library.id,
      libraryFolderId: libraryFolder.id
    })

    const results = await libraryItemsBookFilters.search(null, library, 'And Now Back to You', 10, 0)

    expect(results.book).to.have.length(1)
    expect(results.book[0].libraryItem.media.metadata.title).to.equal('And Now, Back to You')
  })
})
