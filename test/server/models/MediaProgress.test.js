const { expect } = require('chai')
const { Sequelize } = require('sequelize')

const Database = require('../../../server/Database')

describe('MediaProgress', () => {
  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
    await Database.sequelize.sync({ force: true })
  })

  afterEach(async () => {
    await Database.sequelize.close()
  })

  it('marks progress finished using coherent wall-clock currentTime and duration values', async () => {
    const user = await Database.userModel.create({
      username: 'user1',
      pash: 'hashed_password_1',
      type: 'user',
      isActive: true
    })

    const progress = await Database.mediaProgressModel.create({
      userId: user.id,
      mediaItemId: '00000000-0000-0000-0000-000000000001',
      mediaItemType: 'book',
      duration: 10,
      currentTime: 0,
      isFinished: false,
      extraData: {}
    })

    await progress.applyProgressUpdate({
      currentTime: 9.5,
      duration: 10,
      markAsFinishedTimeRemaining: 1
    })

    expect(progress.isFinished).to.equal(true)
    expect(progress.progress).to.equal(0.95)
  })
})
