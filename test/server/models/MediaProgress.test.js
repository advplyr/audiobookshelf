const { expect } = require('chai')
const sinon = require('sinon')

const { Sequelize } = require('sequelize')
const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')

describe('MediaProgress', () => {
  let mediaProgress

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    const user = await Database.userModel.create({ username: 'testuser', type: 'root' })
    const library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
    const libraryFolder = await Database.libraryFolderModel.create({ path: '/test', libraryId: library.id })
    const book = await Database.bookModel.create({ title: 'Test Book', audioFiles: [], tags: [], narrators: [], genres: [], chapters: [] })
    const libraryItem = await Database.libraryItemModel.create({ libraryFiles: [], mediaId: book.id, mediaType: 'book', libraryId: library.id, libraryFolderId: libraryFolder.id })

    mediaProgress = await Database.mediaProgressModel.create({
      mediaItemId: book.id,
      mediaItemType: 'book',
      userId: user.id,
      duration: 36000,
      currentTime: 1234.5,
      extraData: { libraryItemId: libraryItem.id, progress: 0.034 }
    })

    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'error')
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.sync({ force: true })
  })

  describe('getOldMediaProgress', () => {
    it('includes playbackRate from extraData when set', () => {
      mediaProgress.extraData = { ...mediaProgress.extraData, playbackRate: 1.5 }
      const result = mediaProgress.getOldMediaProgress()
      expect(result.playbackRate).to.equal(1.5)
    })

    it('returns null when playbackRate not in extraData', () => {
      const result = mediaProgress.getOldMediaProgress()
      expect(result.playbackRate).to.be.null
    })

    it('returns null when extraData is null', () => {
      mediaProgress.extraData = null
      const result = mediaProgress.getOldMediaProgress()
      expect(result.playbackRate).to.be.null
    })

    it('preserves existing extraData fields', () => {
      mediaProgress.extraData = { libraryItemId: 'li_test', progress: 0.5, playbackRate: 2.0 }
      const result = mediaProgress.getOldMediaProgress()
      expect(result.playbackRate).to.equal(2.0)
      expect(result.progress).to.equal(0.5)
      expect(result.libraryItemId).to.equal('li_test')
    })
  })

  describe('applyProgressUpdate', () => {
    it('stores playbackRate in extraData', async () => {
      await mediaProgress.applyProgressUpdate({ playbackRate: 1.5 })
      expect(mediaProgress.extraData.playbackRate).to.equal(1.5)
    })

    it('updates existing playbackRate', async () => {
      mediaProgress.extraData = { ...mediaProgress.extraData, playbackRate: 1.5 }
      await mediaProgress.applyProgressUpdate({ playbackRate: 2.0 })
      expect(mediaProgress.extraData.playbackRate).to.equal(2.0)
    })

    it('does not touch playbackRate when not in payload', async () => {
      mediaProgress.extraData = { ...mediaProgress.extraData, playbackRate: 1.5 }
      await mediaProgress.applyProgressUpdate({ currentTime: 5000 })
      expect(mediaProgress.extraData.playbackRate).to.equal(1.5)
    })

    it('preserves other extraData fields when setting playbackRate', async () => {
      const originalLibraryItemId = mediaProgress.extraData.libraryItemId
      const originalProgress = mediaProgress.extraData.progress
      await mediaProgress.applyProgressUpdate({ playbackRate: 1.75 })
      expect(mediaProgress.extraData.libraryItemId).to.equal(originalLibraryItemId)
      expect(mediaProgress.extraData.progress).to.equal(originalProgress)
      expect(mediaProgress.extraData.playbackRate).to.equal(1.75)
    })

    it('initializes extraData if null', async () => {
      mediaProgress.extraData = null
      await mediaProgress.applyProgressUpdate({ playbackRate: 1.25 })
      expect(mediaProgress.extraData).to.be.an('object')
      expect(mediaProgress.extraData.playbackRate).to.equal(1.25)
    })
  })
})
