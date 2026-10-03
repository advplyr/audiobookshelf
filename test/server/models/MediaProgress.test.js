const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')

describe('MediaProgress', () => {
  let mediaProgress

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'debug')

    const user = await Database.userModel.create({ username: 'user', pash: 'hash', token: 'token', type: 'user', isActive: true, permissions: {}, bookmarks: [], extraData: {} })
    const book = await Database.bookModel.create({ title: 'Test Book', audioFiles: [], tags: [], narrators: [], genres: [], chapters: [] })
    mediaProgress = await Database.mediaProgressModel.create({
      userId: user.id,
      mediaItemId: book.id,
      mediaItemType: 'book',
      duration: 1000,
      currentTime: 100,
      extraData: { progress: 0.1 }
    })
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.close()
  })

  describe('applyProgressUpdate', () => {
    it('should update progress from currentTime when no progress is sent', async () => {
      await mediaProgress.applyProgressUpdate({ currentTime: 700 })

      expect(mediaProgress.getOldMediaProgress().progress).to.equal(0.7)
    })

    it('should update progress from currentTime and duration when no progress is sent', async () => {
      await mediaProgress.applyProgressUpdate({ currentTime: 700, duration: 2000 })

      expect(mediaProgress.getOldMediaProgress().progress).to.equal(0.35)
    })

    it('should keep using the progress sent by the client', async () => {
      await mediaProgress.applyProgressUpdate({ currentTime: 700, progress: 0.5 })

      expect(mediaProgress.getOldMediaProgress().progress).to.equal(0.5)
    })

    it('should use the progress sent by the client when isFinished is false and unchanged', async () => {
      await mediaProgress.applyProgressUpdate({ currentTime: 700, duration: 1000, progress: 0.7, isFinished: false })

      expect(mediaProgress.getOldMediaProgress().progress).to.equal(0.7)
      expect(mediaProgress.isFinished).to.equal(false)
    })

    it('should still reset a finished item when isFinished is set to false', async () => {
      await mediaProgress.update({ isFinished: true, finishedAt: new Date(), currentTime: 1000, extraData: { progress: 1 } })

      await mediaProgress.applyProgressUpdate({ isFinished: false })

      expect(mediaProgress.isFinished).to.equal(false)
      expect(mediaProgress.currentTime).to.equal(0)
      expect(mediaProgress.getOldMediaProgress().progress).to.equal(0)
    })

    it('should fix a stale stored progress when currentTime is already up to date', async () => {
      mediaProgress.currentTime = 700
      await mediaProgress.save()

      await mediaProgress.applyProgressUpdate({ currentTime: 700, duration: 1000, progress: 0.7 })

      expect(mediaProgress.getOldMediaProgress().progress).to.equal(0.7)
    })
  })
})
