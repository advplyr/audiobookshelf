const { expect } = require('chai')
const sinon = require('sinon')
const { Sequelize } = require('sequelize')
const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')

describe('MediaProgress', () => {
  let previousSequelize
  let previousSettings

  beforeEach(async () => {
    previousSequelize = Database.sequelize
    previousSettings = global.ServerSettings
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
    sinon.stub(Logger, 'info')
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.close()
    Database.sequelize = previousSequelize
    global.ServerSettings = previousSettings
  })

  it('preserves strict completion thresholds and resets hidden progress on playback', async () => {
    const progress = await Database.mediaProgressModel.create({ duration: 100, currentTime: 0, isFinished: false, hideFromContinueListening: true })
    await progress.applyProgressUpdate({ currentTime: 90 })
    expect(progress.isFinished).to.equal(false)
    expect(progress.hideFromContinueListening).to.equal(false)
    await progress.applyProgressUpdate({ currentTime: 91 })
    expect(progress.isFinished).to.equal(true)
    expect(progress.finishedAt).to.be.instanceOf(Date)
    expect(progress.getOldMediaProgress().progress).to.equal(1)
    await progress.applyProgressUpdate({ currentTime: 10, hideFromContinueListening: true })
    expect(progress.isFinished).to.equal(false)
    expect(progress.finishedAt).to.equal(null)
    expect(progress.hideFromContinueListening).to.equal(true)
  })

  it('marks and unmarks explicit completion while preserving payload mutation', async () => {
    const progress = await Database.mediaProgressModel.create({ duration: 0, currentTime: 5, isFinished: false })
    const finishedAt = '2020-09-13T12:26:40.000Z'
    const finished = { isFinished: true, finishedAt }
    await progress.applyProgressUpdate(finished)
    expect(finished).not.to.have.property('finishedAt')
    expect(progress.getOldMediaProgress().finishedAt).to.equal(new Date(finishedAt).valueOf())
    const reset = { isFinished: false, finishedAt, currentTime: 8 }
    await progress.applyProgressUpdate(reset)
    expect(reset).not.to.have.property('finishedAt')
    expect(reset).not.to.have.property('currentTime')
    expect(progress.currentTime).to.equal(0)
    expect(progress.extraData.progress).to.equal(0)
  })

  it('uses percentage thresholds and preserves synchronized update timestamps', async () => {
    const progress = await Database.mediaProgressModel.create({ duration: 100, currentTime: 0, isFinished: false })
    await progress.applyProgressUpdate({ currentTime: 80, progress: 2, markAsFinishedPercentComplete: 80 })
    expect(progress.isFinished).to.equal(false)
    expect(progress.extraData.progress).to.equal(1)
    await progress.applyProgressUpdate({ currentTime: 81, markAsFinishedPercentComplete: 80, lastUpdate: 1600000000000 })
    expect(progress.isFinished).to.equal(true)
    expect(progress.updatedAt.valueOf()).to.equal(1600000000000)
    expect(progress.getOldMediaProgress().lastUpdate).to.equal(1600000000000)
  })

  it('runs per-instance removal hooks during bulk deletion and updates cached users', async () => {
    const user = await Database.userModel.create({ username: 'test' })
    const progress = await Database.mediaProgressModel.create({ userId: user.id, duration: 100, currentTime: 0 })
    const cached = await Database.userModel.getUserById(user.id)
    expect(cached.mediaProgresses).to.have.length(1)
    const removed = sinon.spy(Database.userModel, 'mediaProgressRemoved')
    expect(await Database.mediaProgressModel.removeById(progress.id)).to.equal(1)
    expect(removed.calledOnce).to.equal(true)
    expect(cached.mediaProgresses).to.have.length(0)
  })

  it('expands polymorphic media and preserves missing duration defaults', async () => {
    const book = await Database.bookModel.create({ title: 'Book' })
    const progress = await Database.mediaProgressModel.create({ mediaItemId: book.id, mediaItemType: 'book' })
    expect(progress.progress).to.equal(0)
    expect((await progress.getMediaItem()).id).to.equal(book.id)
    const saved = await Database.mediaProgressModel.findByPk(progress.id, { include: Database.bookModel })
    expect(saved.mediaItem.id).to.equal(book.id)
    expect(saved).not.to.have.property('book')
    expect(saved.getOldMediaProgress()).to.include({ progress: 0, isFinished: false, libraryItemId: null })
  })
})
