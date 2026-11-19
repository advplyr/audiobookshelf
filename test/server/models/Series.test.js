const { expect } = require('chai')
const { Sequelize } = require('sequelize')

const Database = require('../../../server/Database')

describe('Series', () => {
  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
  })

  afterEach(async () => {
    await Database.sequelize.sync({ force: true })
  })

  it('findOrCreateByNameAndLibrary finds a series when SQL lower() disagrees with toLowerCase()', async () => {
    const library = await Database.libraryModel.create({ name: 'Books', mediaType: 'book' })

    const first = await Database.seriesModel.findOrCreateByNameAndLibrary('Über Serie', library.id)
    const second = await Database.seriesModel.findOrCreateByNameAndLibrary('Über Serie', library.id)

    expect(second.id).to.equal(first.id)
  })
})
