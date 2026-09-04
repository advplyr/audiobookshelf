const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')
const libraryItemsBookFilters = require('../../../server/utils/queries/libraryItemsBookFilters')

describe('libraryItemsBookFilters.getFilteredLibraryItems progress filter', () => {
  let library
  let user
  let notStartedBookId
  let audioInProgressBookId
  let ebookInProgressBookId
  let finishedBookId

  beforeEach(async () => {
    global.ServerSettings = {}
    sinon.stub(Logger, 'debug')
    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'warn')
    sinon.stub(Logger, 'error')

    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
    user = await Database.userModel.create({
      username: 'tester',
      pash: 'hash',
      token: 'token',
      type: 'user',
      isActive: true,
      permissions: {},
      bookmarks: [],
      extraData: {}
    })

    const makeBook = async (title, progress) => {
      const book = await Database.bookModel.create({
        title,
        explicit: false,
        audioFiles: [],
        tags: [],
        narrators: [],
        genres: [],
        chapters: []
      })
      const libraryItem = await Database.libraryItemModel.create({
        path: `/test-lib/${title}`,
        isFile: false,
        libraryFiles: [],
        mediaId: book.id,
        mediaType: 'book',
        libraryId: library.id
      })
      if (progress) {
        await Database.mediaProgressModel.create({
          userId: user.id,
          mediaItemId: book.id,
          mediaItemType: 'book',
          ...progress
        })
      }
      return { bookId: book.id, libraryItemId: libraryItem.id }
    }

    const notStarted = await makeBook('Not Started Book')
    const audioInProgress = await makeBook('Audio In Progress Book', {
      currentTime: 120,
      isFinished: false,
      ebookProgress: 0
    })
    const ebookInProgress = await makeBook('Ebook In Progress Book', {
      currentTime: 0,
      isFinished: false,
      ebookProgress: 0.35,
      ebookLocation: 'location123'
    })
    const finished = await makeBook('Finished Book', {
      currentTime: 0,
      isFinished: true,
      ebookProgress: 0
    })
    notStartedBookId = notStarted.libraryItemId
    audioInProgressBookId = audioInProgress.libraryItemId
    ebookInProgressBookId = ebookInProgress.libraryItemId
    finishedBookId = finished.libraryItemId
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.sync({ force: true })
  })

  async function getFilteredIds(filterValue) {
    const { libraryItems, count } = await libraryItemsBookFilters.getFilteredLibraryItems(
      library.id,
      user,
      'progress',
      filterValue,
      'addedAt',
      false,
      false,
      [],
      null,
      null
    )
    return {
      count,
      ids: libraryItems.map((li) => li.id)
    }
  }

  it('not-started excludes ebooks with reading progress (issue #5525)', async () => {
    const { libraryItems, count } = await libraryItemsBookFilters.getFilteredLibraryItems(
      library.id,
      user,
      'progress',
      'not-started',
      'addedAt',
      false,
      false,
      [],
      null,
      null
    )
    const titles = libraryItems.map((li) => li.media.title).sort()
    expect(count).to.equal(1)
    expect(titles).to.deep.equal(['Not Started Book'])
  })

  it('not-finished returns in-progress and not-started books', async () => {
    const { count } = await getFilteredIds('not-finished')
    expect(count).to.equal(3)
  })

  it('in-progress includes both audio and ebook progress', async () => {
    const { count, ids } = await getFilteredIds('in-progress')
    const { libraryItems } = await libraryItemsBookFilters.getFilteredLibraryItems(
      library.id,
      user,
      'progress',
      'in-progress',
      'addedAt',
      false,
      false,
      [],
      null,
      null
    )
    const titles = libraryItems.map((li) => li.media.title).sort()
    expect(count).to.equal(2)
    expect(ids).to.have.members([audioInProgressBookId, ebookInProgressBookId])
    expect(titles).to.deep.equal(['Audio In Progress Book', 'Ebook In Progress Book'])
  })

  it('finished returns only finished books', async () => {
    const { count, ids } = await getFilteredIds('finished')
    expect(count).to.equal(1)
    expect(ids).to.deep.equal([finishedBookId])
  })
})
