const chai = require('chai')
const { expect } = chai
const { Sequelize } = require('sequelize')

const Database = require('../../../../server/Database')
const { isFileSearchQuery, getFileMatchIds } = require('../../../../server/utils/queries/searchFileHelpers')

describe('searchFileHelpers', () => {
  describe('isFileSearchQuery', () => {
    it('returns true for queries ending with a supported audio extension', () => {
      expect(isFileSearchQuery('lalalalala.mp3')).to.equal(true)
      expect(isFileSearchQuery('album.m4b')).to.equal(true)
      expect(isFileSearchQuery('track.flac')).to.equal(true)
    })

    it('returns true for queries ending with a supported ebook extension', () => {
      expect(isFileSearchQuery('dune.epub')).to.equal(true)
      expect(isFileSearchQuery('comic.cbz')).to.equal(true)
    })

    it('returns true for uppercase extensions', () => {
      expect(isFileSearchQuery('lalalalala.MP3')).to.equal(true)
      expect(isFileSearchQuery('Dune.EPUB')).to.equal(true)
    })

    it('returns true for a bare extension', () => {
      expect(isFileSearchQuery('.mp3')).to.equal(true)
    })

    it('trims leading and trailing whitespace', () => {
      expect(isFileSearchQuery('  lalalalala.mp3  ')).to.equal(true)
    })

    it('handles unicode in the query', () => {
      expect(isFileSearchQuery('café.flac')).to.equal(true)
    })

    it('returns false for queries without a known extension', () => {
      expect(isFileSearchQuery('dune')).to.equal(false)
      expect(isFileSearchQuery('hotel.california')).to.equal(false)
      expect(isFileSearchQuery('mp3')).to.equal(false)
      expect(isFileSearchQuery('file.xyz')).to.equal(false)
    })

    it('returns false for empty and non-string input', () => {
      expect(isFileSearchQuery('')).to.equal(false)
      expect(isFileSearchQuery(null)).to.equal(false)
      expect(isFileSearchQuery(undefined)).to.equal(false)
      expect(isFileSearchQuery(42)).to.equal(false)
    })
  })

  describe('getFileMatchIds', () => {
    let library
    let folder
    let itemWithFile
    let itemFolderOnly
    let itemOtherFile
    let itemInvalidJson

    async function createBookItem(path, libraryFiles) {
      const book = await Database.bookModel.create({ title: 'Test Book', audioFiles: [], tags: [], narrators: [], genres: [], chapters: [] })
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
      await Database.buildModels()
      await Database.sequelize.sync({ force: true })

      library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
      folder = await Database.libraryFolderModel.create({ path: '/test', libraryId: library.id })

      itemWithFile = await createBookItem('/data/books/artist/album', [{ metadata: { path: '/data/books/artist/album/lalalalala.mp3', filename: 'lalalalala.mp3', ext: '.mp3' } }])
      itemFolderOnly = await createBookItem('/data/books/folderonly', [])
      itemOtherFile = await createBookItem('/data/books/other', [{ metadata: { path: '/data/books/other/x.flac', filename: 'x.flac', ext: '.flac' } }])
      itemInvalidJson = await createBookItem('/data/books/broken', [])
      await Database.sequelize.query(`UPDATE libraryItems SET libraryFiles = 'not json' WHERE id = '${itemInvalidJson.id}'`)
    })

    it('matches by file name', async () => {
      const textSearchQuery = await Database.createTextSearchQuery('lalalalala.mp3')
      const ids = await getFileMatchIds(library.id, textSearchQuery)
      expect(ids).to.deep.equal([itemWithFile.id])
    })

    it('matches case-insensitively', async () => {
      const textSearchQuery = await Database.createTextSearchQuery('LALALALALA.MP3')
      const ids = await getFileMatchIds(library.id, textSearchQuery)
      expect(ids).to.deep.equal([itemWithFile.id])
    })

    it('matches by full pathname', async () => {
      const textSearchQuery = await Database.createTextSearchQuery('artist/album/lalalalala.mp3')
      const ids = await getFileMatchIds(library.id, textSearchQuery)
      expect(ids).to.deep.equal([itemWithFile.id])
    })

    it('matches by item folder path when no file path matches', async () => {
      const textSearchQuery = await Database.createTextSearchQuery('folderonly')
      const ids = await getFileMatchIds(library.id, textSearchQuery)
      expect(ids).to.deep.equal([itemFolderOnly.id])
    })

    it('returns no ids when nothing matches', async () => {
      const textSearchQuery = await Database.createTextSearchQuery('nomatch.mp3')
      const ids = await getFileMatchIds(library.id, textSearchQuery)
      expect(ids).to.deep.equal([])
    })

    it('ignores items with invalid libraryFiles JSON without throwing', async () => {
      const textSearchQuery = await Database.createTextSearchQuery('lalalalala.mp3')
      const ids = await getFileMatchIds(library.id, textSearchQuery)
      expect(ids).to.not.include(itemInvalidJson.id)
      expect(ids).to.include(itemWithFile.id)
    })

    it('only matches items in the given library', async () => {
      const otherLibrary = await Database.libraryModel.create({ name: 'Other Library', mediaType: 'book' })
      const textSearchQuery = await Database.createTextSearchQuery('lalalalala.mp3')
      const ids = await getFileMatchIds(otherLibrary.id, textSearchQuery)
      expect(ids).to.deep.equal([])
    })
  })
})
