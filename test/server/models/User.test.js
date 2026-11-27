const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')

describe('User cache', () => {
  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'debug')
  })

  afterEach(async () => {
    sinon.restore()
    Database.userModel.clearCache()
    await Database.sequelize.sync({ force: true })
  })

  it('reads users from the database again after clearCache', async () => {
    const created = await Database.userModel.create({ id: 'u1', username: 'root', type: 'root', isActive: true, bookmarks: [] })
    const cached = await Database.userModel.getUserById(created.id)
    expect(cached.bookmarks).to.deep.equal([])

    // The database file is replaced, e.g. by applying a backup
    const restored = [{ libraryItemId: 'li1', time: 5, title: 'good bit' }]
    await Database.userModel.update({ bookmarks: restored }, { where: { id: created.id } })
    expect((await Database.userModel.getUserById(created.id)).bookmarks).to.deep.equal([])

    Database.userModel.clearCache()

    const user = await Database.userModel.getUserById(created.id)
    expect(user.bookmarks).to.deep.equal(restored)
  })
})
