const { expect } = require('chai')
const { Sequelize } = require('sequelize')

const Database = require('../../../../server/Database')
const libraryItemsBookFilters = require('../../../../server/utils/queries/libraryItemsBookFilters')

describe('libraryItemsBookFilters.getFilteredLibraryItems', () => {
  let library
  let libraryFolder

  /**
   * @param {string} title
   * @param {{ audioFileCount?: number, ebookFile?: object|null, libraryFiles?: object[] }} [options]
   */
  async function createBookItem(title, { audioFileCount = 0, ebookFile = null, libraryFiles = [] } = {}) {
    const book = await Database.bookModel.create({
      title,
      audioFiles: Array.from({ length: audioFileCount }, (_, i) => ({ index: i + 1, ino: `${title}-${i}` })),
      ebookFile,
      tags: [],
      narrators: [],
      genres: [],
      chapters: []
    })
    await Database.libraryItemModel.create({
      path: `/test-lib/${title}`,
      isFile: false,
      libraryFiles,
      mediaId: book.id,
      mediaType: 'book',
      libraryId: library.id,
      libraryFolderId: libraryFolder.id
    })
    return book.id
  }

  /**
   * @param {string} filterGroup
   * @param {string} filterValue
   * @param {boolean} [collapseSeries]
   * @returns {Promise<string[]>} sorted titles
   */
  async function filterTitles(filterGroup, filterValue, collapseSeries = false) {
    const { libraryItems } = await libraryItemsBookFilters.getFilteredLibraryItems(library.id, null, filterGroup, filterValue, 'media.metadata.title', false, collapseSeries, [], null, null)
    return libraryItems.map((li) => li.media.title).sort()
  }

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
    libraryFolder = await Database.libraryFolderModel.create({ path: '/test-lib', libraryId: library.id })

    const ebookLibraryFile = { ino: 'ebook', isSupplementary: false, metadata: { filename: 'book.epub', ext: '.epub' } }
    const supplementaryLibraryFile = { ino: 'supp', isSupplementary: true, metadata: { filename: 'extra.pdf', ext: '.pdf' } }

    await createBookItem('Audio Only', { audioFileCount: 1 })
    await createBookItem('Audio Multi', { audioFileCount: 3 })
    await createBookItem('Ebook Only', { ebookFile: { ino: 'ebook', ebookFormat: 'epub' }, libraryFiles: [ebookLibraryFile] })
    await createBookItem('Audio And Ebook', { audioFileCount: 2, ebookFile: { ino: 'ebook', ebookFormat: 'epub' }, libraryFiles: [ebookLibraryFile] })
    await createBookItem('Audio And Supplementary', { audioFileCount: 1, libraryFiles: [supplementaryLibraryFile] })
    await createBookItem('Nothing')
  })

  afterEach(async () => {
    await Database.sequelize.close()
  })

  describe('tracks filter', () => {
    it('returns only items with at least one audio file for "any"', async () => {
      expect(await filterTitles('tracks', 'any')).to.deep.equal(['Audio And Ebook', 'Audio And Supplementary', 'Audio Multi', 'Audio Only'])
    })

    it('still returns items without audio files for "none"', async () => {
      expect(await filterTitles('tracks', 'none')).to.deep.equal(['Ebook Only', 'Nothing'])
    })

    it('still returns single-track items for "single"', async () => {
      expect(await filterTitles('tracks', 'single')).to.deep.equal(['Audio And Supplementary', 'Audio Only'])
    })
  })

  describe('ebooks filter', () => {
    it('returns items with a primary or supplementary ebook for "any-ebook"', async () => {
      expect(await filterTitles('ebooks', 'any-ebook')).to.deep.equal(['Audio And Ebook', 'Audio And Supplementary', 'Ebook Only'])
    })

    it('collapses matching items of the same series for "any-ebook"', async () => {
      const series = await Database.seriesModel.create({ name: 'Test Series', nameIgnorePrefix: 'Test Series', libraryId: library.id })
      const books = await Database.bookModel.findAll({ where: { title: ['Ebook Only', 'Audio And Ebook'] } })
      for (const [index, book] of books.entries()) {
        await Database.bookSeriesModel.create({ bookId: book.id, seriesId: series.id, sequence: `${index + 1}` })
      }

      const titles = await filterTitles('ebooks', 'any-ebook', true)
      expect(titles).to.have.length(2)
      expect(titles).to.include('Audio And Supplementary')
    })

    it('still returns only primary ebooks for "ebook"', async () => {
      expect(await filterTitles('ebooks', 'ebook')).to.deep.equal(['Audio And Ebook', 'Ebook Only'])
    })
  })
})
