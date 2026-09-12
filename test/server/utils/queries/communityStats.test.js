const { expect } = require('chai')
const { Sequelize } = require('sequelize')

const Database = require('../../../../server/Database')
const communityStats = require('../../../../server/utils/queries/communityStats')

describe('communityStats queries', () => {
  let library
  let requester
  let visibleUser
  let privateUser
  let allowedItem
  let hiddenItem

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.slice(1)}` : '')
    await Database.buildModels()
    await Database.sequelize.sync()

    library = await Database.libraryModel.create({ name: 'Community', mediaType: 'book' })
    const folder = await Database.libraryFolderModel.create({ path: '/community', libraryId: library.id })
    const createItem = async (title, tags) => {
      const book = await Database.bookModel.create({ title, tags, audioFiles: [], narrators: [], genres: [], chapters: [] })
      const item = await Database.libraryItemModel.create({ path: `/community/${title}`, isFile: false, libraryFiles: [], mediaId: book.id, mediaType: 'book', libraryId: library.id, libraryFolderId: folder.id })
      return { book, item }
    }
    const allowed = await createItem('Allowed', ['allowed'])
    const hidden = await createItem('Hidden', ['hidden'])
    allowedItem = allowed.item
    hiddenItem = hidden.item

    const createUser = (username, extraData = {}) => Database.userModel.create({ username, pash: 'hash', token: username, type: 'user', isActive: true, permissions: Database.userModel.getDefaultPermissionsForUserType('user'), bookmarks: [], extraData })
    visibleUser = await createUser('visible')
    privateUser = await createUser('private', { hideListeningActivity: true })
    requester = await createUser('requester')
    requester.permissions = { ...requester.permissions, accessAllTags: false, selectedTagsNotAccessible: false, itemTagsSelected: ['allowed'] }

    const session = (id, userId, item, book, timeListening, createdAt) => Database.playbackSessionModel.create({ id, userId, libraryId: library.id, mediaItemId: book.id, mediaItemType: 'book', displayTitle: book.title, timeListening, mediaMetadata: { authors: [{ name: 'Author' }] }, extraData: { libraryItemId: item.id }, createdAt, updatedAt: createdAt })
    await session('10000000-0000-4000-8000-000000000001', visibleUser.id, allowed.item, allowed.book, 120, new Date('2025-01-02'))
    await session('10000000-0000-4000-8000-000000000002', privateUser.id, allowed.item, allowed.book, 900, new Date('2025-01-03'))
    await session('10000000-0000-4000-8000-000000000003', visibleUser.id, hidden.item, hidden.book, 600, new Date('2025-01-04'))
  })

  afterEach(async () => {
    await Database.sequelize.close()
  })

  it('excludes opted-out users and inaccessible items from stats and activity', async () => {
    const stats = await communityStats.getLibraryStats(library.id, requester)
    expect(stats).to.deep.include({ totalListeningTime: 120, listenerCount: 1 })
    expect(stats.mostListenedBooks).to.have.length(1)
    expect(stats.mostListenedBooks[0]).to.include({ id: allowedItem.id, listenerCount: 1, timeListening: 120 })
    expect(stats.mostActiveListeners.map((listener) => listener.username)).to.deep.equal(['visible'])
    expect(stats.topAuthors).to.deep.equal([{ name: 'Author', timeListening: 120 }])

    const activity = await communityStats.getLibraryActivity(library.id, requester, 0, 20)
    expect(activity).to.include({ total: 1, numPages: 1, page: 0, itemsPerPage: 20 })
    expect(activity.events[0]).to.include({ username: 'visible', libraryItemId: allowedItem.id, itemTitle: 'Allowed', timeListening: 120 })
  })

  it('returns listener progress and finished counts without opted-out users', async () => {
    await Database.mediaProgressModel.create({ userId: visibleUser.id, mediaItemId: allowedItem.mediaId, mediaItemType: 'book', duration: 200, currentTime: 200, isFinished: true, finishedAt: new Date() })
    await Database.mediaProgressModel.create({ userId: privateUser.id, mediaItemId: allowedItem.mediaId, mediaItemType: 'book', duration: 200, currentTime: 100 })
    const item = await Database.libraryItemModel.getExpandedById(allowedItem.id)
    const result = await communityStats.getItemListeners(item)
    expect(result).to.deep.equal({ listenerCount: 1, finishedCount: 1, listeners: [{ userId: visibleUser.id, username: 'visible', percent: 100, finished: true }] })
  })
})
