const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')

describe('User', () => {
  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    sinon.stub(Logger, 'info')
  })

  afterEach(async () => {
    sinon.restore()

    // Clear all tables
    await Database.sequelize.sync({ force: true })
  })

  describe('createUpdateMediaProgressFromPayload', () => {
    let user
    let book
    let libraryItem

    beforeEach(async () => {
      const library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
      const libraryFolder = await Database.libraryFolderModel.create({ path: '/test', libraryId: library.id })
      book = await Database.bookModel.create({ title: 'Test Book', audioFiles: [], tags: [], narrators: [], genres: [], chapters: [] })
      libraryItem = await Database.libraryItemModel.create({ libraryFiles: [], mediaId: book.id, mediaType: 'book', libraryId: library.id, libraryFolderId: libraryFolder.id })

      await Database.userModel.create({ username: 'testuser', type: 'user', isActive: true })
      user = await Database.userModel.findOne({ where: { username: 'testuser' }, include: Database.mediaProgressModel })
    })

    it('should create a single media progress when concurrent updates create progress for the same item', async () => {
      const results = await Promise.all([user.createUpdateMediaProgressFromPayload({ libraryItemId: libraryItem.id, currentTime: 100, duration: 3600 }), user.createUpdateMediaProgressFromPayload({ libraryItemId: libraryItem.id, currentTime: 200, duration: 3600 }), user.createUpdateMediaProgressFromPayload({ libraryItemId: libraryItem.id, currentTime: 300, duration: 3600 })])

      const mediaProgresses = await Database.mediaProgressModel.findAll({ where: { userId: user.id, mediaItemId: book.id } })
      expect(mediaProgresses).to.have.length(1)
      expect(mediaProgresses[0].currentTime).to.equal(300)
      expect(results.map((r) => r.mediaProgress.id)).to.deep.equal([mediaProgresses[0].id, mediaProgresses[0].id, mediaProgresses[0].id])

      expect(user.mediaProgresses).to.have.length(1)
      expect(user.getMediaProgress(book.id).currentTime).to.equal(300)
    })

    it('should keep processing queued updates for the same item after an update fails', async () => {
      const applyStub = sinon.stub(user, 'applyMediaProgressPayload').callThrough()
      applyStub.onFirstCall().rejects(new Error('db error'))

      const [failedUpdate, update] = await Promise.allSettled([user.createUpdateMediaProgressFromPayload({ libraryItemId: libraryItem.id, currentTime: 100, duration: 3600 }), user.createUpdateMediaProgressFromPayload({ libraryItemId: libraryItem.id, currentTime: 200, duration: 3600 })])

      expect(failedUpdate.status).to.equal('rejected')
      expect(update.status).to.equal('fulfilled')
      expect(update.value.mediaProgress.currentTime).to.equal(200)
    })
  })
})
