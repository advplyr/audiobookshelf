const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')

/**
 * Unit tests for MediaProgress.relinkFromMissingItems - the safety net that moves listening
 * progress from a missing/orphaned book to a newly created book item that identity-matches it,
 * used when the scanner could not adopt the missing item and made a new one instead.
 */
describe('MediaProgress.relinkFromMissingItems', () => {
  let library
  let libraryFolder

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'debug')
    sinon.stub(Logger, 'error')

    library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
    libraryFolder = await Database.libraryFolderModel.create({ path: '/lib', libraryId: library.id })
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.close()
  })

  const af = (size) => ({ index: 1, ino: `${size}`, metadata: { size }, duration: 100 })

  async function createUser(username) {
    return Database.userModel.create({
      username,
      pash: 'hash',
      token: 'token',
      type: 'user',
      isActive: true,
      permissions: {},
      bookmarks: [],
      extraData: {}
    })
  }

  async function createBookItem({ title, asin = null, duration = 100, audioFiles = [af(1000)], authors = [], isMissing = false, withItem = true }) {
    const book = await Database.bookModel.create({
      title,
      asin,
      duration,
      audioFiles,
      tags: [],
      narrators: [],
      genres: [],
      chapters: []
    })
    let item = null
    if (withItem) {
      item = await Database.libraryItemModel.create({
        path: `/lib/${title}`,
        relPath: title,
        mediaId: book.id,
        mediaType: 'book',
        libraryId: library.id,
        libraryFolderId: libraryFolder.id,
        isMissing,
        libraryFiles: []
      })
    }
    for (const name of authors) {
      const author = await Database.authorModel.create({ name, libraryId: library.id })
      await Database.bookAuthorModel.create({ bookId: book.id, authorId: author.id })
    }
    return { book, item }
  }

  function createProgress(userId, book, overrides = {}) {
    return Database.mediaProgressModel.create({
      userId,
      mediaItemId: book.id,
      mediaItemType: 'book',
      duration: book.duration,
      currentTime: 0,
      isFinished: true,
      finishedAt: new Date('2024-02-01T00:00:00Z'),
      extraData: { libraryItemId: 'stale-id' },
      ...overrides
    })
  }

  const relink = (newItemId) => Database.libraryItemModel.getExpandedById(newItemId).then((expanded) => Database.mediaProgressModel.relinkFromMissingItems(expanded))

  it('relinks finished progress from a missing item matched by file fingerprint', async () => {
    const user = await createUser('reader')
    const { book: oldBook } = await createBookItem({ title: 'Raw Tag Title', audioFiles: [af(111), af(222)], isMissing: true })
    const progress = await createProgress(user.id, oldBook)

    const { book: newBook, item: newItem } = await createBookItem({ title: 'Curated Title', audioFiles: [af(222), af(111)] })
    await relink(newItem.id)

    await progress.reload()
    expect(progress.mediaItemId).to.equal(newBook.id)
    expect(progress.extraData.libraryItemId).to.equal(newItem.id)
    expect(progress.isFinished).to.be.true
    expect(progress.currentTime).to.equal(0)
    expect(new Date(progress.finishedAt).toISOString()).to.equal('2024-02-01T00:00:00.000Z')
    expect(Logger.error.called).to.be.false
  })

  it('relinks progress from a missing item matched by ASIN', async () => {
    const user = await createUser('reader')
    const { book: oldBook } = await createBookItem({ title: 'Old', asin: 'B0ASINMATCH', audioFiles: [af(9)], isMissing: true })
    const progress = await createProgress(user.id, oldBook)

    const { book: newBook, item: newItem } = await createBookItem({ title: 'New', asin: 'b0asinmatch', audioFiles: [af(1234)] })
    await relink(newItem.id)

    await progress.reload()
    expect(progress.mediaItemId).to.equal(newBook.id)
  })

  it('relinks progress from a missing item matched by title + authors', async () => {
    const user = await createUser('reader')
    const { book: oldBook } = await createBookItem({ title: 'Neuromancer', audioFiles: [af(9)], authors: ['William Gibson'], isMissing: true })
    const progress = await createProgress(user.id, oldBook)

    const { item: newItem } = await createBookItem({ title: 'neuromancer', audioFiles: [af(4444)], authors: ['William Gibson'] })
    await relink(newItem.id)

    await progress.reload()
    expect(progress.extraData.libraryItemId).to.equal(newItem.id)
  })

  it('relinks progress from an orphaned book with no library item at all', async () => {
    const user = await createUser('reader')
    const { book: oldBook } = await createBookItem({ title: 'Orphan', audioFiles: [af(777)], withItem: false })
    const progress = await createProgress(user.id, oldBook)

    const { book: newBook, item: newItem } = await createBookItem({ title: 'Rehomed', audioFiles: [af(777)] })
    await relink(newItem.id)

    await progress.reload()
    expect(progress.mediaItemId).to.equal(newBook.id)
  })

  it('does not move a row for a user who already has progress on the new book', async () => {
    const userA = await createUser('a')
    const userB = await createUser('b')
    const { book: oldBook } = await createBookItem({ title: 'Old', audioFiles: [af(50)], isMissing: true })
    const aOld = await createProgress(userA.id, oldBook)
    const bOld = await createProgress(userB.id, oldBook)

    const { book: newBook, item: newItem } = await createBookItem({ title: 'New', audioFiles: [af(50)] })
    const aNew = await createProgress(userA.id, newBook, { isFinished: false, currentTime: 30, finishedAt: null })

    await relink(newItem.id)

    await aOld.reload()
    await bOld.reload()
    await aNew.reload()
    // user A keeps their pre-existing new-book row untouched, old row not moved
    expect(aOld.mediaItemId).to.equal(oldBook.id)
    expect(aNew.isFinished).to.be.false
    expect(aNew.currentTime).to.equal(30)
    // user B (no new-book row) gets relinked
    expect(bOld.mediaItemId).to.equal(newBook.id)
  })

  it('relinks nothing when two missing/orphaned books match (ambiguous)', async () => {
    const user = await createUser('reader')
    const { book: bookOne } = await createBookItem({ title: 'One', audioFiles: [af(500)], isMissing: true })
    const { book: bookTwo } = await createBookItem({ title: 'Two', audioFiles: [af(500)], isMissing: true })
    const p1 = await createProgress(user.id, bookOne)
    const p2 = await createProgress(user.id, bookTwo)

    const { item: newItem } = await createBookItem({ title: 'Three', audioFiles: [af(500)] })
    await relink(newItem.id)

    await p1.reload()
    await p2.reload()
    expect(p1.mediaItemId).to.equal(bookOne.id)
    expect(p2.mediaItemId).to.equal(bookTwo.id)
    expect(Logger.debug.called).to.be.true
    expect(Logger.error.called).to.be.false
  })

  it('does not relink when the missing item ASIN disagrees with the new book', async () => {
    const user = await createUser('reader')
    const { book: oldBook } = await createBookItem({ title: 'Same', asin: 'B000000001', audioFiles: [af(50)], isMissing: true })
    const progress = await createProgress(user.id, oldBook)

    const { item: newItem } = await createBookItem({ title: 'Same', asin: 'B000000002', audioFiles: [af(50)] })
    await relink(newItem.id)

    await progress.reload()
    expect(progress.mediaItemId).to.equal(oldBook.id)
  })

  it('is a no-op when there are no missing or orphaned books', async () => {
    const user = await createUser('reader')
    const { item: newItem } = await createBookItem({ title: 'Lonely', audioFiles: [af(1)] })
    // progress on the new book itself should be left alone
    const progress = await createProgress(user.id, (await Database.bookModel.findOne({ where: { title: 'Lonely' } })))

    await relink(newItem.id)

    await progress.reload()
    expect(Logger.error.called).to.be.false
  })

  it('ignores a missing item in a different library', async () => {
    const user = await createUser('reader')
    const otherLibrary = await Database.libraryModel.create({ name: 'Other', mediaType: 'book' })
    const otherFolder = await Database.libraryFolderModel.create({ path: '/other', libraryId: otherLibrary.id })
    const otherBook = await Database.bookModel.create({ title: 'Elsewhere', duration: 100, audioFiles: [af(321)], tags: [], narrators: [], genres: [], chapters: [] })
    await Database.libraryItemModel.create({ path: '/other/Elsewhere', relPath: 'Elsewhere', mediaId: otherBook.id, mediaType: 'book', libraryId: otherLibrary.id, libraryFolderId: otherFolder.id, isMissing: true, libraryFiles: [] })
    const progress = await createProgress(user.id, otherBook)

    const { item: newItem } = await createBookItem({ title: 'Elsewhere', audioFiles: [af(321)] })
    await relink(newItem.id)

    await progress.reload()
    expect(progress.mediaItemId).to.equal(otherBook.id)
  })
})
