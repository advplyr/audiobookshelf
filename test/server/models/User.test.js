const { expect } = require('chai')
const { Sequelize } = require('sequelize')

const Database = require('../../../server/Database')

describe('User model - createUpdateMediaProgressFromPayload', () => {
  let user
  let libraryItem

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    const library = await Database.libraryModel.create({ name: 'Book Library', mediaType: 'book' })
    const libraryFolder = await Database.libraryFolderModel.create({ path: '/books', libraryId: library.id })
    const book = await Database.bookModel.create({
      title: 'Test Book',
      duration: 4788.529,
      audioFiles: [],
      chapters: [],
      tags: [],
      narrators: [],
      genres: []
    })
    libraryItem = await Database.libraryItemModel.create({
      libraryFiles: [],
      mediaId: book.id,
      mediaType: 'book',
      libraryId: library.id,
      libraryFolderId: libraryFolder.id
    })

    user = await Database.userModel.create({ username: 'user', type: 'user' })
    user.mediaProgresses = []
  })

  afterEach(async () => {
    await Database.sequelize.close()
  })

  // Regression test: on local session sync the create path must keep the client's real
  // timestamp. Otherwise Sequelize stamps updatedAt = now, which makes the just-created
  // progress look newer than every remaining queued session and the sync guard skips them.
  it('preserves the client lastUpdate when creating a new media progress', async () => {
    const lastUpdate = 1787618968277 // real client timestamp, in the past

    const { mediaProgress } = await user.createUpdateMediaProgressFromPayload({
      libraryItemId: libraryItem.id,
      duration: 4788.529,
      currentTime: 1831,
      progress: 0.382,
      lastUpdate
    })

    expect(mediaProgress).to.exist
    expect(mediaProgress.updatedAt.valueOf()).to.equal(lastUpdate)
  })

  it('stamps the current time when lastUpdate is absent', async () => {
    const before = Date.now()
    const { mediaProgress } = await user.createUpdateMediaProgressFromPayload({
      libraryItemId: libraryItem.id,
      duration: 4788.529,
      currentTime: 1831,
      progress: 0.382
    })
    const after = Date.now()

    expect(mediaProgress.updatedAt.valueOf()).to.be.within(before, after)
  })
})
