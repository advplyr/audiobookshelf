const chai = require('chai')
const { expect } = chai
const { Sequelize } = require('sequelize')

const Database = require('../../../../server/Database')
const libraryItemsBookFilters = require('../../../../server/utils/queries/libraryItemsBookFilters')

describe('libraryItemsBookFilters search', () => {
  let library
  let folder
  let user

  async function createBookItem(title, path, libraryFiles, explicit = false) {
    const book = await Database.bookModel.create({ title, explicit, audioFiles: [], tags: [], narrators: [], genres: [], chapters: [] })
    return Database.libraryItemModel.create({
      mediaType: 'book',
      mediaId: book.id,
      libraryId: library.id,
      libraryFolderId: folder.id,
      path,
      libraryFiles
    })
  }

  beforeEach(async () => {
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    global.ServerSettings = { sortingPrefixes: [], titlePostfixExclusions: [] }
    await Database.buildModels()
    await Database.sequelize.sync({ force: true })

    library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
    folder = await Database.libraryFolderModel.create({ path: '/test', libraryId: library.id })
    user = { canAccessExplicitContent: true, permissions: { accessAllTags: true } }

    // Matches title and file for query "lalalalala.mp3"
    await createBookItem('Lalalalala Songbook', '/data/books/lala', [{ metadata: { path: '/data/books/lala/lalalalala.mp3', filename: 'lalalalala.mp3', ext: '.mp3' } }])
    // File-only match for query "track.mp3"
    await createBookItem('Silent Item', '/data/books/other', [{ metadata: { path: '/data/books/other/hidden-track.mp3', filename: 'hidden-track.mp3', ext: '.mp3' } }])
    // No files at all
    await createBookItem('No Files Book', '/data/books/nofiles', [])
    // Matches title and file for query "record.mp3" (dedup test)
    await createBookItem('record.mp3 Live Session', '/data/books/rec', [{ metadata: { path: '/data/books/rec/record.mp3', filename: 'record.mp3', ext: '.mp3' } }])
    // Explicit, file match for query "explicit.mp3"
    await createBookItem('Explicit Book', '/data/books/explicit', [{ metadata: { path: '/data/books/explicit/explicit.mp3', filename: 'explicit.mp3', ext: '.mp3' } }], true)
  })

  it('returns items matched only by file path in the book bucket', async () => {
    const results = await libraryItemsBookFilters.search(user, library, 'track.mp3', 12, 0)
    const titles = results.book.map((r) => r.libraryItem.media.metadata.title)
    expect(titles).to.deep.equal(['Silent Item'])
  })

  it('returns an item matching both title and file path exactly once', async () => {
    const results = await libraryItemsBookFilters.search(user, library, 'record.mp3', 12, 0)
    const titles = results.book.map((r) => r.libraryItem.media.metadata.title)
    expect(titles).to.deep.equal(['record.mp3 Live Session'])
  })

  it('does not change results for metadata-only queries', async () => {
    const results = await libraryItemsBookFilters.search(user, library, 'Book', 12, 0)
    const titles = results.book.map((r) => r.libraryItem.media.metadata.title).sort()
    // Title matches only: file-only matches (Silent Item) must not leak in
    expect(titles).to.deep.equal(['Explicit Book', 'Lalalalala Songbook', 'No Files Book'])
  })

  it('excludes file matches the user cannot access', async () => {
    const restrictedUser = { canAccessExplicitContent: false, permissions: { accessAllTags: true } }
    const results = await libraryItemsBookFilters.search(restrictedUser, library, 'explicit.mp3', 12, 0)
    expect(results.book).to.deep.equal([])
  })

  it('returns empty buckets when a file-shape query matches nothing', async () => {
    const results = await libraryItemsBookFilters.search(user, library, 'nomatch.mp3', 12, 0)
    expect(results.book).to.deep.equal([])
    expect(results.series).to.deep.equal([])
    expect(results.authors).to.deep.equal([])
  })

  it('returns all items with a matching extension for a bare extension query', async () => {
    const results = await libraryItemsBookFilters.search(user, library, '.mp3', 12, 0)
    // All items except "No Files Book" have an .mp3 file
    expect(results.book.length).to.equal(4)
  })
})
