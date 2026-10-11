const { expect } = require('chai')
const { Sequelize } = require('sequelize')

const Database = require('../../../server/Database')

describe('User - canStream permission', () => {
  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
  })

  afterEach(async () => {
    await Database.sequelize.sync({ force: true })
  })

  describe('getDefaultPermissionsForUserType', () => {
    it('should default stream to true for all user types', () => {
      for (const type of ['root', 'admin', 'user', 'guest']) {
        const permissions = Database.userModel.getDefaultPermissionsForUserType(type)
        expect(permissions.stream).to.equal(true, `stream should default to true for type "${type}"`)
      }
    })
  })

  describe('canStream getter', () => {
    it('should return true when stream permission is true and user is active', async () => {
      const user = await Database.userModel.create({
        username: 'testuser',
        pash: 'hashed',
        type: 'user',
        isActive: true,
        permissions: { stream: true, download: true }
      })
      expect(user.canStream).to.be.true
    })

    it('should return false when stream permission is explicitly false', async () => {
      const user = await Database.userModel.create({
        username: 'testuser',
        pash: 'hashed',
        type: 'user',
        isActive: true,
        permissions: { stream: false, download: true }
      })
      expect(user.canStream).to.be.false
    })

    it('should return true when stream permission is missing (migration safety)', async () => {
      const user = await Database.userModel.create({
        username: 'testuser',
        pash: 'hashed',
        type: 'user',
        isActive: true,
        permissions: { download: true }
      })
      expect(user.canStream).to.be.true
    })

    it('should return false when user is inactive even with stream permission', async () => {
      const user = await Database.userModel.create({
        username: 'testuser',
        pash: 'hashed',
        type: 'user',
        isActive: false,
        permissions: { stream: true }
      })
      expect(user.canStream).to.be.false
    })
  })

  describe('permissionMapping', () => {
    it('should map canStream to stream', () => {
      expect(Database.userModel.permissionMapping.canStream).to.equal('stream')
    })
  })
})
