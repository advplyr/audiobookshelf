const { expect } = require('chai')
const { Sequelize } = require('sequelize')

const Database = require('../../../server/Database')

describe('User bookmarks cleanup', () => {
  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
  })

  afterEach(async () => {
    await Database.sequelize.close()
  })

  async function createUser(username, bookmarks) {
    return Database.userModel.create({
      username,
      type: 'user',
      bookmarks,
      permissions: {},
      extraData: {}
    })
  }

  it('removes bookmarks for deleted library items for every user and preserves other bookmarks', async () => {
    const bookmarks = [
      { libraryItemId: 'deleted-item', time: 10, title: 'Deleted' },
      { libraryItemId: 'kept-item', time: 20, title: 'Kept' }
    ]
    const user1 = await createUser('user-1', bookmarks)
    const user2 = await createUser('user-2', bookmarks)

    const removedCount = await Database.userModel.removeBookmarksForLibraryItems(['deleted-item'])

    expect(removedCount).to.equal(2)
    expect((await Database.userModel.findByPk(user1.id)).bookmarks).to.deep.equal([bookmarks[1]])
    expect((await Database.userModel.findByPk(user2.id)).bookmarks).to.deep.equal([bookmarks[1]])
  })

  it('updates a cached user when removing bookmarks', async () => {
    const user = await createUser('cached-user', [{ libraryItemId: 'deleted-item', time: 10, title: 'Deleted' }])
    const cachedUser = await Database.userModel.getUserById(user.id)

    await Database.userModel.removeBookmarksForLibraryItems(['deleted-item'])

    expect(cachedUser.bookmarks).to.deep.equal([])
  })

  it('removes orphaned bookmarks while preserving bookmarks for existing library items', async () => {
    const library = await Database.libraryModel.create({ name: 'Library', mediaType: 'book' })
    const folder = await Database.libraryFolderModel.create({ path: '/library', libraryId: library.id })
    const book = await Database.bookModel.create({ title: 'Book', audioFiles: [], tags: [], narrators: [], genres: [], chapters: [] })
    const libraryItem = await Database.libraryItemModel.create({
      libraryFiles: [],
      mediaId: book.id,
      mediaType: 'book',
      libraryId: library.id,
      libraryFolderId: folder.id
    })
    const validBookmark = { libraryItemId: libraryItem.id, time: 20, title: 'Kept' }
    const orphanedBookmark = { libraryItemId: 'missing-item', time: 10, title: 'Removed' }
    const user = await createUser('user', [orphanedBookmark, validBookmark])

    const removedCount = await Database.userModel.removeOrphanedBookmarks()

    expect(removedCount).to.equal(1)
    expect((await Database.userModel.findByPk(user.id)).bookmarks).to.deep.equal([validBookmark])
  })

  it('does not overwrite malformed bookmark values', async () => {
    const userWithNullBookmarks = await createUser('null-bookmarks', null)
    const userWithObjectBookmarks = await createUser('object-bookmarks', { libraryItemId: 'item' })

    const removedCount = await Database.userModel.removeOrphanedBookmarks()

    expect(removedCount).to.equal(0)
    expect((await Database.userModel.findByPk(userWithNullBookmarks.id)).bookmarks).to.equal(null)
    expect((await Database.userModel.findByPk(userWithObjectBookmarks.id)).bookmarks).to.deep.equal({ libraryItemId: 'item' })
  })
})
