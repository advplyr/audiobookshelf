const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const SocketAuthority = require('../../../server/SocketAuthority')
const UserController = require('../../../server/controllers/UserController')
const Logger = require('../../../server/Logger')

describe('UserController - delete', () => {
  beforeEach(() => {
    sinon.stub(Logger, 'error')
  })

  afterEach(() => {
    sinon.restore()
  })

  it('rejects deleting the root user by UUID', async () => {
    const rootUser = { id: 'root-uuid', isRoot: true, username: 'root' }
    const adminUser = { id: 'admin-uuid', isRoot: false, username: 'admin' }
    const fakeRes = { sendStatus: sinon.spy(), json: sinon.spy() }

    await UserController.delete({ user: adminUser, reqUser: rootUser, params: { id: rootUser.id } }, fakeRes)

    expect(fakeRes.sendStatus.calledWith(403)).to.be.true
    expect(fakeRes.json.called).to.be.false
  })

  describe('with a database', () => {
    let adminUser
    let targetUser
    let library
    let fakeRes

    beforeEach(async () => {
      global.ServerSettings = {}
      Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
      Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
      await Database.buildModels()

      const userData = { pash: 'hash', type: 'user', isActive: true, permissions: {}, bookmarks: [], extraData: {} }
      adminUser = await Database.userModel.create({ ...userData, username: 'admin', token: 'token-admin', type: 'admin' })
      targetUser = await Database.userModel.create({ ...userData, username: 'target', token: 'token-target' })
      library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })

      await Database.playlistModel.create({ libraryId: library.id, userId: targetUser.id, name: 'Playlist 1' })
      await Database.playlistModel.create({ libraryId: library.id, userId: targetUser.id, name: 'Playlist 2' })
      await Database.playbackSessionModel.create({ userId: targetUser.id, displayTitle: 'Session 1' })
      await Database.playbackSessionModel.create({ userId: targetUser.id, displayTitle: 'Session 2' })

      fakeRes = { sendStatus: sinon.spy(), json: sinon.spy(), status: sinon.stub().returnsThis(), send: sinon.spy() }
      sinon.stub(Logger, 'info')
      sinon.stub(SocketAuthority, 'adminEmitter')
    })

    afterEach(async () => {
      await Database.sequelize.sync({ force: true })
    })

    it('removes the user, their playlists and detaches playback sessions in one transaction', async () => {
      sinon.spy(targetUser, 'destroy')
      sinon.spy(Database.playbackSessionModel, 'update')

      await UserController.delete({ user: adminUser, reqUser: targetUser, params: { id: targetUser.id } }, fakeRes)

      sinon.assert.calledWithMatch(targetUser.destroy, { transaction: sinon.match.object })
      sinon.assert.calledWithMatch(Database.playbackSessionModel.update, {}, { transaction: sinon.match.object })
      expect(fakeRes.json.calledWith({ success: true })).to.be.true
      expect(SocketAuthority.adminEmitter.calledOnceWith('user_removed')).to.be.true
      expect(await Database.userModel.findByPk(targetUser.id)).to.be.null
      expect(await Database.playlistModel.count({ where: { userId: targetUser.id } })).to.equal(0)
      expect(await Database.playbackSessionModel.count()).to.equal(2)
      expect(await Database.playbackSessionModel.count({ where: { userId: null } })).to.equal(2)
    })

    it('rolls back playlists and playback sessions when removing the user fails', async () => {
      sinon.stub(targetUser, 'destroy').rejects(new Error('simulated failure'))

      await UserController.delete({ user: adminUser, reqUser: targetUser, params: { id: targetUser.id } }, fakeRes)

      sinon.assert.calledWithMatch(targetUser.destroy, { transaction: sinon.match.object })
      expect(fakeRes.status.calledWith(500)).to.be.true
      expect(fakeRes.json.called).to.be.false
      expect(SocketAuthority.adminEmitter.called).to.be.false
      expect(await Database.userModel.findByPk(targetUser.id)).to.not.be.null
      expect(await Database.playlistModel.count({ where: { userId: targetUser.id } })).to.equal(2)
      expect(await Database.playbackSessionModel.count({ where: { userId: targetUser.id } })).to.equal(2)
    })
  })
})
