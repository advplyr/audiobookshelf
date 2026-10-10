const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')
const Database = require('../../../server/Database')
const fsExtra = require('../../../server/libs/fsExtra')
const adminStats = require('../../../server/utils/queries/adminStats')

describe('admin statistics queries', () => {
  let previousSequelize
  let previousSettings
  let addedItem
  beforeEach(async () => {
    previousSequelize = Database.sequelize
    previousSettings = global.ServerSettings
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
    sinon.stub(fsExtra, 'pathExists').resolves(true)
    const library = await Database.libraryModel.create({ name: 'Library', mediaType: 'book' })
    const oldBook = await Database.bookModel.create({ title: 'Old', duration: 10, audioFiles: [{ ino: '1' }, { ino: '2' }], createdAt: new Date('2019-06-01') })
    const addedBook = await Database.bookModel.create({ title: 'Added', duration: 20.6, coverPath: '/cover.jpg', audioFiles: [{ ino: '3' }], createdAt: new Date('2020-06-01') })
    await Database.libraryItemModel.create({ libraryId: library.id, mediaType: 'book', mediaId: oldBook.id, size: 100, libraryFiles: [], createdAt: new Date('2019-06-01') })
    addedItem = await Database.libraryItemModel.create({ libraryId: library.id, mediaType: 'book', mediaId: addedBook.id, size: 200, libraryFiles: [], createdAt: new Date('2020-06-01') })
    const podcast = await Database.podcastModel.create({ title: 'Podcast' })
    await Database.libraryItemModel.create({ libraryId: library.id, mediaType: 'podcast', mediaId: podcast.id, size: 50, libraryFiles: [] })
    await Database.podcastEpisodeModel.create({ podcastId: podcast.id, title: 'Episode' })
    await Database.authorModel.create({ name: 'Old', libraryId: library.id, createdAt: new Date('2019-06-01') })
    await Database.authorModel.create({ name: 'Alice', libraryId: library.id, createdAt: new Date('2020-06-01') })
    await Database.authorModel.create({ name: 'Future', libraryId: library.id, createdAt: new Date('2021-01-01') })
    // Sequelize interprets the date-only annual bounds in the server's local timezone.
    const start = new Date(2020, 0, 1).valueOf()
    const end = new Date(2021, 0, 1).valueOf()
    for (const [createdAt, timeListening] of [[start - 1000, 100], [start, 60], [end - 1000, 30], [end, 100]]) {
      await Database.playbackSessionModel.create({ createdAt: new Date(createdAt), timeListening, mediaMetadata: { authors: [{ name: 'Alice' }], narrators: ['Reader'], genres: ['Fantasy', 'audiobook', 'Audio Book', ''] } })
    }
  })
  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.close()
    Database.sequelize = previousSequelize
    global.ServerSettings = previousSettings
  })

  it('keeps annual query boundaries and aggregates covers, listening metadata and totals', async () => {
    expect(await adminStats.getListeningSessionsForYear(2020)).to.have.length(2)
    expect(await adminStats.getNumAuthorsAddedForYear(2020)).to.equal(1)
    const stats = await adminStats.getStatsForYear(2020)
    expect(stats).to.include({ numListeningSessions: 2, numBooksAdded: 1, numAuthorsAdded: 1, totalBooksAddedSize: 200, totalBooksAddedDuration: 21, totalBooksSize: 300, totalBooksDuration: 30.6, totalListeningTime: 90, numBooks: 2 })
    expect(stats.booksAddedWithCovers).to.deep.equal([addedItem.id])
    expect(stats.topAuthors).to.deep.equal([{ name: 'Alice', time: 90 }])
    expect(stats.topNarrators).to.deep.equal([{ name: 'Reader', time: 90 }])
    expect(stats.topGenres).to.deep.equal([{ genre: 'Fantasy', time: 90 }])
  })

  it('counts sizes by media type and audio files across books and podcast episodes', async () => {
    expect(await adminStats.getTotalSize()).to.deep.equal({ books: { totalSize: 300, numItems: 2 }, podcasts: { totalSize: 50, numItems: 1 }, total: { totalSize: 350, numItems: 3 } })
    expect(await adminStats.getNumAudioFiles()).to.deep.equal({ numBookAudioFiles: 3, numPodcastAudioFiles: 1, numAudioFiles: 4 })
  })

  it('keeps zero defaults when the relevant tables are empty', async () => {
    await Database.libraryItemModel.destroy({ where: {} })
    await Database.bookModel.destroy({ where: {} })
    await Database.podcastEpisodeModel.destroy({ where: {} })
    expect(await adminStats.getTotalSize()).to.deep.equal({ books: { totalSize: 0, numItems: 0 }, podcasts: { totalSize: 0, numItems: 0 }, total: { totalSize: 0, numItems: 0 } })
    expect(await adminStats.getNumAudioFiles()).to.deep.equal({ numBookAudioFiles: 0, numPodcastAudioFiles: 0, numAudioFiles: 0 })
    const stats = await adminStats.getStatsForYear(2022)
    expect(stats.totalBooksSize).to.equal(0)
    expect(stats.topAuthors).to.deep.equal([])
  })
})
