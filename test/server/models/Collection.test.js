const { expect } = require('chai')
const { Sequelize } = require('sequelize')

const Database = require('../../../server/Database')

describe('Collection', () => {
  /** @type {string} */
  let libraryId
  /** @type {string} */
  let collectionId

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    const library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
    libraryId = library.id
    const libraryFolder = await Database.libraryFolderModel.create({ path: '/test', libraryId: library.id })

    // Build a book with heavy media: many audio files + chapters
    const audioFiles = []
    const chapters = []
    for (let i = 0; i < 30; i++) {
      audioFiles.push({
        index: i + 1,
        ino: `ino-${i}`,
        duration: 600,
        exclude: false,
        mimeType: 'audio/mpeg',
        metadata: { filename: `track-${i}.mp3`, ext: '.mp3', path: `/test/book/track-${i}.mp3`, relPath: `track-${i}.mp3`, size: 12345678 }
      })
      chapters.push({ id: i, start: i * 600, end: (i + 1) * 600, title: `Chapter ${i + 1}` })
    }

    const book = await Database.bookModel.create({ title: 'Heavy Book', audioFiles, tags: [], narrators: [], genres: [], chapters })

    // libraryItem carries a large libraryFiles array (dropped by the minified form)
    const libraryFiles = []
    for (let i = 0; i < 30; i++) {
      libraryFiles.push({
        ino: `lf-${i}`,
        metadata: { filename: `track-${i}.mp3`, ext: '.mp3', path: `/test/book/track-${i}.mp3`, relPath: `track-${i}.mp3`, size: 12345678, mtimeMs: 0, ctimeMs: 0, birthtimeMs: 0 }
      })
    }
    await Database.libraryItemModel.create({ libraryFiles, mediaId: book.id, mediaType: 'book', libraryId: library.id, libraryFolderId: libraryFolder.id })

    const collection = await Database.collectionModel.create({ name: 'Test Collection', libraryId: library.id })
    collectionId = collection.id
    await Database.collectionBookModel.create({ collectionId: collection.id, bookId: book.id, order: 1 })
  })

  afterEach(async () => {
    await Database.sequelize.close()
  })

  describe('getOldCollectionsJsonExpanded', () => {
    it('returns fully expanded book objects when minified is not requested', async () => {
      const collections = await Database.collectionModel.getOldCollectionsJsonExpanded(null, libraryId, [], false)
      expect(collections).to.have.lengthOf(1)
      const book = collections[0].books[0]

      // Library item keeps the full libraryFiles array
      expect(book).to.have.property('libraryFiles')
      expect(book.libraryFiles).to.be.an('array').with.lengthOf(30)

      // Media keeps the heavy arrays
      expect(book.media).to.have.property('audioFiles').that.is.an('array').with.lengthOf(30)
      expect(book.media).to.have.property('chapters').that.is.an('array').with.lengthOf(30)
      expect(book.media).to.have.property('tracks').that.is.an('array').with.lengthOf(30)
    })

    it('returns minified book objects that omit libraryFiles and heavy media when minified is requested', async () => {
      const collections = await Database.collectionModel.getOldCollectionsJsonExpanded(null, libraryId, [], true)
      expect(collections).to.have.lengthOf(1)
      const book = collections[0].books[0]

      // Library item drops libraryFiles in favor of a numFiles count
      expect(book).to.not.have.property('libraryFiles')
      expect(book).to.have.property('numFiles', 30)

      // Media drops the heavy arrays in favor of counts
      expect(book.media).to.not.have.property('audioFiles')
      expect(book.media).to.not.have.property('chapters')
      expect(book.media).to.not.have.property('tracks')
      expect(book.media).to.have.property('numAudioFiles', 30)
      expect(book.media).to.have.property('numChapters', 30)
      expect(book.media).to.have.property('numTracks', 30)

      // Essential display fields survive minification
      expect(book.media).to.have.property('coverPath')
      expect(book.media).to.have.property('duration')
      expect(book.media.metadata).to.have.property('title', 'Heavy Book')
    })

    it('produces a materially smaller payload when minified', async () => {
      const expanded = await Database.collectionModel.getOldCollectionsJsonExpanded(null, libraryId, [], false)
      const minified = await Database.collectionModel.getOldCollectionsJsonExpanded(null, libraryId, [], true)

      const expandedSize = JSON.stringify(expanded).length
      const minifiedSize = JSON.stringify(minified).length

      expect(minifiedSize).to.be.lessThan(expandedSize * 0.5)
    })
  })
})
