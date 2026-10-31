const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')
const Database = require('../../../server/Database')
const fsExtra = require('../../../server/libs/fsExtra')
const userStats = require('../../../server/utils/queries/userStats')

describe('user statistics queries', () => {
  let previousSequelize
  let previousSettings
  let user
  let firstItem
  let secondItem
  let secondBook
  beforeEach(async () => {
    previousSequelize = Database.sequelize
    previousSettings = global.ServerSettings
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
    sinon.stub(fsExtra, 'pathExists').resolves(true)
    user = await Database.userModel.create({ username: 'test' })
    const otherUser = await Database.userModel.create({ username: 'other' })
    const library = await Database.libraryModel.create({ name: 'Library', mediaType: 'book' })
    const firstBook = await Database.bookModel.create({ title: 'Book', coverPath: '/one.jpg' })
    secondBook = await Database.bookModel.create({ title: 'Book', coverPath: '/two.jpg' })
    firstItem = await Database.libraryItemModel.create({ libraryId: library.id, mediaId: firstBook.id, mediaType: 'book', libraryFiles: [] })
    secondItem = await Database.libraryItemModel.create({ libraryId: library.id, mediaId: secondBook.id, mediaType: 'book', libraryFiles: [] })
    const metadata = { authors: [{ name: 'Alice' }], narrators: ['Reader'], genres: ['Fantasy', 'audiobook', 'Audio Book'] }
    await Database.playbackSessionModel.create({ userId: user.id, mediaItemId: firstBook.id, mediaItemType: 'book', displayTitle: 'Book', timeListening: 20, createdAt: new Date(2020, 0, 15), mediaMetadata: metadata })
    await Database.playbackSessionModel.create({ userId: user.id, mediaItemId: secondBook.id, mediaItemType: 'book', displayTitle: 'Book', timeListening: 40, createdAt: new Date(2020, 4, 15), mediaMetadata: metadata })
    await Database.playbackSessionModel.create({ userId: user.id, mediaItemType: 'podcastEpisode', displayTitle: 'Podcast', timeListening: 10, createdAt: new Date(2020, 4, 20), mediaMetadata: { authors: [{ name: 'Excluded' }] } })
    for (const [owner, createdAt] of [[user, new Date(new Date(2020, 0, 1).valueOf() - 1000)], [user, new Date(2021, 0, 1)], [otherUser, new Date(2020, 4, 15)]]) {
      await Database.playbackSessionModel.create({ userId: owner.id, timeListening: 100, createdAt, mediaMetadata: metadata })
    }
    await Database.mediaProgressModel.create({ userId: user.id, mediaItemId: secondBook.id, mediaItemType: 'book', duration: 60, isFinished: true, finishedAt: new Date(2020, 6, 15) })
    await Database.mediaProgressModel.create({ userId: otherUser.id, mediaItemId: firstBook.id, mediaItemType: 'book', duration: 100, isFinished: true, finishedAt: new Date(2020, 6, 15) })
  })
  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.close()
    Database.sequelize = previousSequelize
    global.ServerSettings = previousSettings
  })

  it('scopes annual sessions and finished book progress to the requested user', async () => {
    const sessions = await userStats.getUserListeningSessionsForYear(user.id, 2020)
    expect(sessions).to.have.length(3)
    expect(sessions.filter((session) => session.mediaItem)).to.have.length(2)
    const progresses = await userStats.getBookMediaProgressFinishedForYear(user.id, 2020)
    expect(progresses).to.have.length(1)
    expect(progresses[0].mediaItem.id).to.equal(secondBook.id)
  })

  it('aggregates listening months, metadata and finished-book details without repeating covers', async () => {
    const stats = await userStats.getStatsForYear(user.id, 2020)
    expect(stats).to.include({ totalListeningSessions: 3, totalListeningTime: 70, totalBookListeningTime: 60, totalPodcastListeningTime: 10, numBooksFinished: 1, numBooksListened: 1 })
    expect(stats.topAuthors).to.deep.equal([{ name: 'Alice', time: 60 }])
    expect(stats.topGenres).to.deep.equal([{ genre: 'Fantasy', time: 60 }])
    expect(stats.mostListenedNarrator).to.deep.equal({ name: 'Reader', time: 60 })
    expect(stats.mostListenedMonth).to.deep.equal({ month: 4, time: 50 })
    expect(stats.longestAudiobookFinished).to.include({ id: secondBook.id, title: 'Book', duration: 60 })
    expect(stats.longestAudiobookFinished.finishedAt).to.be.instanceOf(Date)
    expect(stats.booksWithCovers).to.deep.equal([firstItem.id])
    expect(stats.finishedBooksWithCovers).to.deep.equal([secondItem.id])
  })

  it('keeps empty statistics and missing-cover defaults', async () => {
    const empty = await userStats.getStatsForYear(user.id, 2022)
    expect(empty).to.include({ totalListeningSessions: 0, totalListeningTime: 0, totalBookListeningTime: 0, totalPodcastListeningTime: 0, numBooksFinished: 0, numBooksListened: 0, longestAudiobookFinished: null, mostListenedMonth: null, mostListenedNarrator: null })
    expect(empty.topAuthors).to.deep.equal([])
    expect(empty.topGenres).to.deep.equal([])
    fsExtra.pathExists.resolves(false)
    const stats = await userStats.getStatsForYear(user.id, 2020)
    expect(stats.booksWithCovers).to.deep.equal([])
    expect(stats.finishedBooksWithCovers).to.deep.equal([])
  })
})
