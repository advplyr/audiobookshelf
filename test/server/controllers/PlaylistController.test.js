const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const PlaylistController = require('../../../server/controllers/PlaylistController')
const SocketAuthority = require('../../../server/SocketAuthority')
const Logger = require('../../../server/Logger')

describe('PlaylistController.update', () => {
  let playlist

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
    sinon.stub(SocketAuthority, 'clientEmitter')
    sinon.stub(Logger, 'debug')

    const library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
    const user = await Database.userModel.create({
      username: 'u',
      pash: 'hash',
      token: 'token',
      type: 'user',
      isActive: true,
      bookmarks: [],
      extraData: {}
    })
    playlist = await Database.playlistModel.create({
      name: 'My Playlist',
      description: 'delete me',
      userId: user.id,
      libraryId: library.id
    })
    // Only builds the response; the fix under test is the save before it.
    sinon.stub(playlist, 'getMediaItemsExpandedWithLibraryItem').resolves([])
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.sync({ force: true })
  })

  const makeRes = () => ({ json: sinon.spy(), status: sinon.stub().returnsThis(), send: sinon.spy() })

  it('clears the description when null is sent (#4824)', async () => {
    await PlaylistController.update({ body: { description: null }, playlist }, makeRes())
    await playlist.reload()
    expect(playlist.description).to.equal(null)
  })

  it('clears the description when an empty string is sent', async () => {
    await PlaylistController.update({ body: { description: '' }, playlist }, makeRes())
    await playlist.reload()
    expect(playlist.description).to.equal(null)
  })

  it('leaves the description unchanged when it is absent from the body', async () => {
    await PlaylistController.update({ body: { name: 'Renamed' }, playlist }, makeRes())
    await playlist.reload()
    expect(playlist.description).to.equal('delete me')
    expect(playlist.name).to.equal('Renamed')
  })
})
