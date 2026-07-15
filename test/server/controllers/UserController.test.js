const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const UserController = require('../../../server/controllers/UserController')
const Logger = require('../../../server/Logger')
const SocketAuthority = require('../../../server/SocketAuthority')

function createFakeRes() {
  return {
    sendStatus: sinon.spy(),
    status: sinon.stub().returnsThis(),
    send: sinon.spy(),
    json: sinon.spy()
  }
}

describe('UserController - delete root protection', () => {
  let rootUser
  let adminUser
  let regularUser

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'error')
    sinon.stub(SocketAuthority, 'adminEmitter')

    rootUser = await Database.userModel.create({
      username: 'root',
      pash: 'hashed_password_root',
      type: 'root',
      isActive: true
    })

    adminUser = await Database.userModel.create({
      username: 'admin',
      pash: 'hashed_password_admin',
      type: 'admin',
      isActive: true
    })

    regularUser = await Database.userModel.create({
      username: 'regular',
      pash: 'hashed_password_regular',
      type: 'user',
      isActive: true
    })
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.sync({ force: true })
  })

  it('should prevent admin from deleting root user by UUID (403)', async () => {
    const fakeReq = {
      user: adminUser,
      reqUser: rootUser,
      params: { id: rootUser.id }
    }
    const fakeRes = createFakeRes()

    await UserController.delete(fakeReq, fakeRes)

    expect(fakeRes.sendStatus.calledWith(403)).to.be.true
    expect(fakeRes.json.called).to.be.false

    const existingRoot = await Database.userModel.findByPk(rootUser.id)
    expect(existingRoot).to.not.be.null
    expect(existingRoot.type).to.equal('root')
  })

  it('should prevent root from deleting root user (400)', async () => {
    const fakeReq = {
      user: rootUser,
      reqUser: rootUser,
      params: { id: rootUser.id }
    }
    const fakeRes = createFakeRes()

    await UserController.delete(fakeReq, fakeRes)

    expect(fakeRes.sendStatus.calledWith(400)).to.be.true
    expect(fakeRes.json.called).to.be.false

    const existingRoot = await Database.userModel.findByPk(rootUser.id)
    expect(existingRoot).to.not.be.null
  })

  it('should not block deletion when URL param is literal "root" but target is a different user', async () => {
    const fakeReq = {
      user: adminUser,
      reqUser: regularUser,
      params: { id: 'root' }
    }
    const fakeRes = createFakeRes()

    await UserController.delete(fakeReq, fakeRes)

    expect(fakeRes.json.calledWith({ success: true })).to.be.true

    const deletedUser = await Database.userModel.findByPk(regularUser.id)
    expect(deletedUser).to.be.null
  })

  it('should allow admin to delete a regular user (200)', async () => {
    const fakeReq = {
      user: adminUser,
      reqUser: regularUser,
      params: { id: regularUser.id }
    }
    const fakeRes = createFakeRes()

    await UserController.delete(fakeReq, fakeRes)

    expect(fakeRes.json.calledWith({ success: true })).to.be.true
    expect(SocketAuthority.adminEmitter.calledWith('user_removed')).to.be.true

    const deletedUser = await Database.userModel.findByPk(regularUser.id)
    expect(deletedUser).to.be.null
  })

  it('should prevent admin from deleting self (400)', async () => {
    const fakeReq = {
      user: adminUser,
      reqUser: adminUser,
      params: { id: adminUser.id }
    }
    const fakeRes = createFakeRes()

    await UserController.delete(fakeReq, fakeRes)

    expect(fakeRes.sendStatus.calledWith(400)).to.be.true
    expect(fakeRes.json.called).to.be.false

    const existingAdmin = await Database.userModel.findByPk(adminUser.id)
    expect(existingAdmin).to.not.be.null
  })
})

describe('User model - beforeDestroy root protection', () => {
  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
  })

  afterEach(async () => {
    await Database.sequelize.sync({ force: true })
  })

  it('should reject direct destroy of root user', async () => {
    const rootUser = await Database.userModel.create({
      username: 'root',
      pash: 'hashed_password_root',
      type: 'root',
      isActive: true
    })

    try {
      await rootUser.destroy()
      expect.fail('Expected destroy to throw')
    } catch (error) {
      expect(error.message).to.equal('Root user cannot be deleted')
    }

    const existingRoot = await Database.userModel.findByPk(rootUser.id)
    expect(existingRoot).to.not.be.null
  })
})
