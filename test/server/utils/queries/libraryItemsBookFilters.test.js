const { expect } = require('chai')
const { Sequelize } = require('sequelize')

const Database = require('../../../../server/Database')
const libraryItemsBookFilters = require('../../../../server/utils/queries/libraryItemsBookFilters')

describe('libraryItemsBookFilters.search', () => {
  let library
  let libraryFolder

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    library = await Database.libraryModel.create({ name: 'Search Test Library', mediaType: 'book' })
    libraryFolder = await Database.libraryFolderModel.create({ path: '/search-test', libraryId: library.id })
  })

  afterEach(async () => {
    await Database.sequelize.sync({ force: true })
  })

  async function addBooks(titles) {
    for (const title of titles) {
      const book = await Database.bookModel.create({ title, audioFiles: [], tags: [], narrators: [], genres: [], chapters: [] })
      await Database.libraryItemModel.create({ libraryFiles: [], mediaId: book.id, mediaType: 'book', libraryId: library.id, libraryFolderId: libraryFolder.id })
    }
  }

  it('returns the exact two-letter title first when live search is limited to three results', async () => {
    await addBooks(['With It 1', 'With It 2', 'With It 3', 'It'])

    const results = await libraryItemsBookFilters.search(null, library, 'It', 3, 0)
    const titles = results.book.map((result) => result.libraryItem.media.metadata.title)

    expect(titles[0]).to.equal('It')
  })

  it('matches an exact title without matching case', async () => {
    await addBooks(['The Hobbit Companion', 'The Hobbit'])

    const results = await libraryItemsBookFilters.search(null, library, 'the hobbit', 3, 0)
    const titles = results.book.map((result) => result.libraryItem.media.metadata.title)

    expect(titles[0]).to.equal('The Hobbit')
  })

  it('includes the exact title first when full-page search is limited to twelve results', async () => {
    const genericTitles = Array.from({ length: 12 }, (_, index) => `With It ${index + 1}`)
    await addBooks([...genericTitles, 'It'])

    const results = await libraryItemsBookFilters.search(null, library, 'It', 12, 0)
    const titles = results.book.map((result) => result.libraryItem.media.metadata.title)

    expect(titles).to.include('It')
    expect(titles[0]).to.equal('It')
  })

  it('returns substring matches when there is no exact title', async () => {
    await addBooks(['A Little Life', 'It Ends with Us'])

    const results = await libraryItemsBookFilters.search(null, library, 'It', 3, 0)
    const titles = results.book.map((result) => result.libraryItem.media.metadata.title)

    expect(titles).to.have.members(['A Little Life', 'It Ends with Us'])
  })

  it('ranks a title containing a percent sign as a literal exact match', async () => {
    await addBooks(['100 Percent Me', '100% Me'])

    const results = await libraryItemsBookFilters.search(null, library, '100% Me', 3, 0)
    const titles = results.book.map((result) => result.libraryItem.media.metadata.title)

    expect(titles[0]).to.equal('100% Me')
  })

  it('ranks a title containing an underscore as a literal exact match', async () => {
    await addBooks(['ACB', 'A_B'])

    const results = await libraryItemsBookFilters.search(null, library, 'A_B', 3, 0)
    const titles = results.book.map((result) => result.libraryItem.media.metadata.title)

    expect(titles[0]).to.equal('A_B')
  })
})
