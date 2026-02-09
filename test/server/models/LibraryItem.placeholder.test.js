const { expect } = require('chai')
const { Sequelize } = require('sequelize')

const Database = require('../../../server/Database')

describe('LibraryItem placeholder serialization', () => {
  beforeEach(async () => {
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    global.ServerSettings = { sortingPrefixes: [] }
    await Database.buildModels()
  })

  afterEach(async () => {
    await Database.sequelize.sync({ force: true })
  })

  it('includes isPlaceholder in minified and expanded JSON', async () => {
    const library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
    const libraryFolder = await Database.libraryFolderModel.create({ path: '/test', libraryId: library.id })

    const book = await Database.bookModel.create({
      title: 'Placeholder Book',
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
      isPlaceholder: true
    })

    const expanded = await Database.libraryItemModel.getExpandedById(libraryItem.id)

    const minifiedJson = expanded.toOldJSONMinified()
    const expandedJson = expanded.toOldJSONExpanded()

    expect(minifiedJson).to.have.property('isPlaceholder', true)
    expect(expandedJson).to.have.property('isPlaceholder', true)
  })
})
