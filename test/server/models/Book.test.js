const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')
const Database = require('../../../server/Database')
const SocketAuthority = require('../../../server/SocketAuthority')
const Logger = require('../../../server/Logger')

describe('Book model', () => {
  let previousSequelize
  let previousSettings
  let library
  let book
  beforeEach(async () => {
    previousSequelize = Database.sequelize
    previousSettings = global.ServerSettings
    global.ServerSettings = { sortingPrefixes: ['the'] }
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
    sinon.stub(SocketAuthority, 'emitter')
    sinon.stub(Logger, 'error')
    library = await Database.libraryModel.create({ name: 'Library', mediaType: 'book' })
    book = await Database.bookModel.create({ title: 'The Book', audioFiles: [], chapters: [], narrators: [], genres: [], tags: [] })
    book.authors = []
    book.series = []
  })
  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.close()
    Database.sequelize = previousSequelize
    global.ServerSettings = previousSettings
  })

  it('excludes disabled tracks, accumulates offsets and includes every file in total size', () => {
    book.audioFiles = [
      { ino: 'one', metadata: { filename: 'one.mp3', size: 100 }, duration: 10, mimeType: 'audio/mpeg' },
      { ino: 'disabled', metadata: { filename: 'disabled.mp3', size: 20 }, duration: 20, exclude: true, mimeType: 'audio/other' },
      { ino: 'two', metadata: { filename: 'two.mp3', size: 200 }, duration: 30, mimeType: 'audio/mpeg' }
    ]
    book.ebookFile = { ebookFormat: 'epub', metadata: { size: 50 } }
    expect(book.size).to.equal(370)
    expect(book.hasMediaFiles).to.equal(true)
    expect(book.hasAudioTracks).to.equal(true)
    expect(book.checkCanDirectPlay(['audio/mpeg'])).to.equal(true)
    expect(book.checkCanDirectPlay([])).to.equal(false)
    expect(book.checkCanDirectPlay(null)).to.equal(false)
    const tracks = book.getTracklist('item')
    expect(tracks.map((track) => track.startOffset)).to.deep.equal([0, 10])
    expect(tracks[1]).to.include({ title: 'two.mp3', contentUrl: '/api/items/item/file/two' })
    tracks[0].metadata.filename = 'changed'
    expect(book.audioFiles[0].metadata.filename).to.equal('one.mp3')
    const json = book.toOldJSONExpanded('item')
    expect(json.numTracks).to.equal(2)
    expect(json.numAudioFiles).to.equal(3)
    expect(json.ebookFormat).to.equal('epub')
  })

  it('sanitizes request metadata, preserves coercion and rejects invalid arrays', async () => {
    const payload = { metadata: { title: 'The Updated', publishedYear: 2020, description: '<p>Safe<script>bad()</script></p>', explicit: 1, abridged: true, narrators: ['Reader'], genres: ['Fiction'] }, tags: ['tag'] }
    expect(await book.updateFromRequest(payload)).to.equal(true)
    await book.reload()
    expect(book).to.include({ title: 'The Updated', titleIgnorePrefix: 'Updated', publishedYear: '2020', description: '<p>Safe</p>', explicit: true, abridged: true })
    expect(payload.metadata.publishedYear).to.equal('2020')
    expect(payload.metadata.description).to.equal('<p>Safe</p>')
    expect(book.narrators).to.deep.equal(['Reader'])
    expect(book.genres).to.deep.equal(['Fiction'])
    expect(book.tags).to.deep.equal(['tag'])
    expect(await book.updateFromRequest({ metadata: { narrators: [1], genres: [1], explicit: true }, tags: [1] })).to.equal(false)
    expect(await book.updateFromRequest(null)).to.equal(false)
  })

  it('updates author joins case-insensitively and emits the existing notifications', async () => {
    const added = await book.updateAuthorsFromRequest(['Alice Smith', 'Bob Jones'], library.id)
    expect(added.authorsAdded).to.have.length(2)
    expect(book.authorName).to.equal('Alice Smith, Bob Jones')
    expect(book.authorNameLF).to.equal('Smith, Alice, Jones, Bob')
    const alice = book.authors[0]
    const otherBook = await Database.bookModel.create({ title: 'Other' })
    await Database.bookAuthorModel.create({ bookId: otherBook.id, authorId: alice.id })
    const updated = await book.updateAuthorsFromRequest(['bob jones', 'Carol White'], library.id)
    expect(updated.authorsRemoved.map((author) => author.id)).to.deep.equal([alice.id])
    expect(updated.authorsAdded).to.have.length(1)
    expect(await Database.bookAuthorModel.getCountForAuthor(alice.id)).to.equal(1)
    expect(await Database.bookAuthorModel.count({ where: { bookId: book.id } })).to.equal(2)
    expect(SocketAuthority.emitter.calledWith('author_added')).to.equal(true)
    expect(SocketAuthority.emitter.calledWith('author_updated')).to.equal(true)
    expect(await book.updateAuthorsFromRequest(null, library.id)).to.equal(null)
  })

  it('updates series sequences and removes joins without deleting series', async () => {
    expect((await book.updateSeriesFromRequest([{ name: 'Series', sequence: '1' }, { name: 'Removed', sequence: '2' }], library.id)).seriesAdded).to.have.length(2)
    const removedId = book.series[1].id
    const result = await book.updateSeriesFromRequest([{ name: 'series', sequence: '3' }], library.id)
    expect(result.hasUpdates).to.equal(true)
    expect(result.seriesRemoved[0].id).to.equal(removedId)
    expect(book.seriesName).to.equal('Series #3')
    expect(book.series[0].bookSeries.sequence).to.equal('3')
    expect(await Database.bookSeriesModel.count({ where: { bookId: book.id } })).to.equal(1)
    expect(await Database.seriesModel.findByPk(removedId)).not.to.equal(null)
    const unchanged = await book.updateSeriesFromRequest([{ name: 'Series', sequence: '3' }], library.id)
    expect(unchanged.hasUpdates).to.equal(false)
    expect(await book.updateSeriesFromRequest([{ name: '' }], library.id)).to.equal(null)
    const json = book.toOldJSONExpanded('item')
    expect(json.metadata.series[0].sequence).to.equal('3')
    expect(json.metadata.titleIgnorePrefix).to.equal('Book, The')
  })

  it('preserves missing-association errors and chapter cloning', async () => {
    book.chapters = [{ id: 0, start: 0, end: 10, title: 'Chapter' }]
    const chapters = book.getChapters()
    chapters[0].title = 'Changed'
    expect(book.chapters[0].title).to.equal('Chapter')
    delete book.authors
    expect(book.authorName).to.equal('')
    expect(book.authorNameLF).to.equal('')
    expect(() => book.toOldJSON('item')).to.throw('authors are not loaded')
    expect(() => book.toOldJSONExpanded('')).to.throw('libraryItemId is not provided')
    try {
      await book.updateAuthorsFromRequest(['Alice'], library.id)
      expect.fail('Expected unloaded authors to fail')
    } catch (error) {
      expect(error.message).to.include('authors are not loaded')
    }
  })
})
