const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')
const deletedMediaProgress = require('../../../server/utils/deletedMediaProgress')
const userStats = require('../../../server/utils/queries/userStats')

describe('deletedMediaProgress (opt-in keep deleted media progress)', () => {
  let library, folder, user, book, author

  const createBook = async (overrides = {}) => {
    const b = await Database.bookModel.create({ title: 'Dune', asin: 'B002V1OF70', duration: 3600, audioFiles: [], tags: [], narrators: [], genres: [], chapters: [], ...overrides })
    await Database.libraryItemModel.create({ libraryFiles: [], mediaId: b.id, mediaType: 'book', libraryId: library.id, libraryFolderId: folder.id })
    await Database.bookAuthorModel.create({ bookId: b.id, authorId: author.id })
    return b
  }

  const finish = (mediaItemId, extra = {}) =>
    Database.mediaProgressModel.create({ userId: user.id, mediaItemId, mediaItemType: 'book', duration: 3600, currentTime: 3600, isFinished: true, finishedAt: new Date(), extraData: { progress: 1 }, ...extra })

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
    Database.serverSettings = { keepDeletedMediaProgress: false }

    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'debug')
    sinon.stub(Logger, 'warn')
    sinon.stub(Logger, 'error')

    library = await Database.libraryModel.create({ name: 'Lib', mediaType: 'book' })
    folder = await Database.libraryFolderModel.create({ path: '/test', libraryId: library.id })
    author = await Database.authorModel.create({ name: 'Frank Herbert', libraryId: library.id })
    user = await Database.userModel.create({ username: 'tester', type: 'user', isActive: true, permissions: {}, extraData: {} })
    book = await createBook()
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.sync({ force: true })
  })

  it('does nothing when the setting is disabled (default)', async () => {
    await finish(book.id)
    expect(await deletedMediaProgress.archive([book.id])).to.equal(0)
    expect(await Database.deletedMediaProgressModel.count()).to.equal(0)
  })

  it('archives finished progress with book metadata when enabled', async () => {
    Database.serverSettings.keepDeletedMediaProgress = true
    await finish(book.id)

    expect(await deletedMediaProgress.archive([book.id])).to.equal(1)
    const rows = await Database.deletedMediaProgressModel.findAll()
    expect(rows).to.have.length(1)
    expect(rows[0]).to.include({ title: 'Dune', authorName: 'Frank Herbert', asin: 'B002V1OF70', isFinished: true, mediaItemType: 'book', libraryId: library.id })
  })

  it('does not archive items with no progress', async () => {
    Database.serverSettings.keepDeletedMediaProgress = true
    await Database.mediaProgressModel.create({ userId: user.id, mediaItemId: book.id, mediaItemType: 'book', duration: 3600, currentTime: 0, isFinished: false, extraData: {} })
    expect(await deletedMediaProgress.archive([book.id])).to.equal(0)
  })

  it('counts deleted finished books in year stats', async () => {
    Database.serverSettings.keepDeletedMediaProgress = true
    const year = new Date().getFullYear()
    await finish(book.id)
    await deletedMediaProgress.archive([book.id])
    await Database.mediaProgressModel.destroy({ where: { mediaItemId: book.id } })
    await Database.bookModel.destroy({ where: { id: book.id } })

    const stats = await userStats.getStatsForYear(user.id, year)
    expect(stats.numBooksFinished).to.equal(1)

    // Not counted once the setting is turned off again
    Database.serverSettings.keepDeletedMediaProgress = false
    expect((await userStats.getStatsForYear(user.id, year)).numBooksFinished).to.equal(0)
  })

  it('restores progress when the same book is re-added (matched by ASIN)', async () => {
    Database.serverSettings.keepDeletedMediaProgress = true
    await finish(book.id)
    await deletedMediaProgress.archive([book.id])
    await Database.mediaProgressModel.destroy({ where: { mediaItemId: book.id } })

    const reAdded = await createBook({ title: 'Dune (Unabridged)', duration: 3650 })
    expect(await deletedMediaProgress.restoreForBook(reAdded, 'Frank Herbert', 'li-1')).to.equal(1)

    const restored = await Database.mediaProgressModel.findOne({ where: { mediaItemId: reAdded.id } })
    expect(restored.isFinished).to.equal(true)
    expect(restored.userId).to.equal(user.id)
    expect(restored.extraData.libraryItemId).to.equal('li-1')
    expect(await Database.deletedMediaProgressModel.count()).to.equal(0)
  })

  it('restores by title + author + duration when there is no ASIN/ISBN', async () => {
    Database.serverSettings.keepDeletedMediaProgress = true
    const noId = await createBook({ title: 'Some Book!', asin: null, duration: 1000 })
    await finish(noId.id, { duration: 1000, currentTime: 1000 })
    await deletedMediaProgress.archive([noId.id])
    await Database.mediaProgressModel.destroy({ where: { mediaItemId: noId.id } })

    const different = await createBook({ title: 'Some Book', asin: null, duration: 9000 })
    expect(await deletedMediaProgress.restoreForBook(different, 'Frank Herbert', 'li')).to.equal(0) // duration too different

    const same = await createBook({ title: 'some book', asin: null, duration: 1010 })
    expect(await deletedMediaProgress.restoreForBook(same, 'Frank Herbert', 'li')).to.equal(1)
    const wrongAuthor = await createBook({ title: 'Some Book', asin: null, duration: 1000 })
    expect(await deletedMediaProgress.restoreForBook(wrongAuthor, 'Someone Else', 'li')).to.equal(0)
  })

  it('does not restore when the setting is disabled', async () => {
    Database.serverSettings.keepDeletedMediaProgress = true
    await finish(book.id)
    await deletedMediaProgress.archive([book.id])
    Database.serverSettings.keepDeletedMediaProgress = false
    expect(await deletedMediaProgress.restoreForBook(await createBook(), 'Frank Herbert', 'li')).to.equal(0)
  })

  it('archives and restores podcast episodes (matched by guid)', async () => {
    Database.serverSettings.keepDeletedMediaProgress = true
    const podLib = await Database.libraryModel.create({ name: 'Pods', mediaType: 'podcast' })
    const podFolder = await Database.libraryFolderModel.create({ path: '/pods', libraryId: podLib.id })
    const podcast = await Database.podcastModel.create({ title: 'My Podcast', tags: [], genres: [] })
    await Database.libraryItemModel.create({ libraryFiles: [], mediaId: podcast.id, mediaType: 'podcast', libraryId: podLib.id, libraryFolderId: podFolder.id })
    const episode = await Database.podcastEpisodeModel.create({ title: 'Ep 1', podcastId: podcast.id, audioFile: { duration: 600 }, chapters: [], extraData: { guid: 'abc-123' } })
    await Database.mediaProgressModel.create({ userId: user.id, mediaItemId: episode.id, mediaItemType: 'podcastEpisode', podcastId: podcast.id, duration: 600, currentTime: 600, isFinished: true, finishedAt: new Date(), extraData: {} })

    expect(await deletedMediaProgress.archive([episode.id])).to.equal(1)
    await Database.mediaProgressModel.destroy({ where: { mediaItemId: episode.id } })
    await episode.destroy()

    const redownloaded = await Database.podcastEpisodeModel.create({ title: 'Ep 1 (re-encoded)', podcastId: podcast.id, audioFile: { duration: 601 }, chapters: [], extraData: { guid: 'abc-123' } })
    expect(await deletedMediaProgress.restoreForPodcastEpisode(redownloaded, 'My Podcast', 'li')).to.equal(1)
    const restored = await Database.mediaProgressModel.findOne({ where: { mediaItemId: redownloaded.id } })
    expect(restored.isFinished).to.equal(true)
    expect(restored.mediaItemType).to.equal('podcastEpisode')
  })
})
