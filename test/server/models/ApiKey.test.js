const { expect } = require('chai')
const sinon = require('sinon')
const { Sequelize } = require('sequelize')
const jwt = require('jsonwebtoken')
const Database = require('../../../server/Database')
const ApiKey = require('../../../server/models/ApiKey')
const Logger = require('../../../server/Logger')

describe('ApiKey', () => {
  let previousSequelize
  let previousSettings

  beforeEach(async () => {
    previousSequelize = Database.sequelize
    previousSettings = global.ServerSettings
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.close()
    Database.sequelize = previousSequelize
    global.ServerSettings = previousSettings
  })

  it('validates permission values while retaining legacy extra boolean keys', () => {
    sinon.stub(Logger, 'warn')
    const requested = { download: false, update: 'invalid', librariesAccessible: ['library'], itemTagsSelected: [1], extra: true, ignored: undefined }
    const permissions = ApiKey.mergePermissionsWithDefault(requested)
    expect(permissions).to.include({ download: false, update: true, extra: true })
    expect(permissions.librariesAccessible).to.equal(requested.librariesAccessible)
    expect(permissions.itemTagsSelected).to.deep.equal([])
    expect(permissions).not.to.have.property('ignored')
    expect(ApiKey.mergePermissionsWithDefault(null)).to.deep.equal(ApiKey.getDefaultPermissions())
    expect(() => ApiKey.mergePermissionsWithDefault(Symbol('invalid'))).to.throw(TypeError)
  })

  it('generates JWTs with optional expiry and preserves failure results', async () => {
    const token = await ApiKey.generateApiKey('test-placeholder', 'key', 'Name', 60)
    const payload = jwt.verify(token, 'test-placeholder')
    expect(payload).to.include({ keyId: 'key', name: 'Name', type: 'api' })
    expect(payload.exp - payload.iat).to.equal(60)
    const nonExpiring = await ApiKey.generateApiKey('test-placeholder', 'key', 'Name', 0)
    expect(jwt.verify(nonExpiring, 'test-placeholder')).not.to.have.property('exp')
    sinon.stub(Logger, 'error')
    expect(await ApiKey.generateApiKey('', 'key', 'Name')).to.equal(null)
  })

  it('invalidates cached instances when detached instances update or save', async () => {
    const created = await ApiKey.create({ name: 'Initial' })
    const cached = await ApiKey.getById(created.id)
    expect(await ApiKey.getById(created.id)).to.equal(cached)
    expect(cached.fromCache).to.equal(true)
    const detached = await ApiKey.findByPk(created.id)
    await detached.update({ name: 'Updated' })
    const updated = await ApiKey.getById(created.id)
    expect(updated).not.to.equal(cached)
    expect(updated.name).to.equal('Updated')
    detached.name = 'Saved'
    await detached.save()
    expect((await ApiKey.getById(created.id)).name).to.equal('Saved')
    await detached.destroy()
    expect(await ApiKey.getById(created.id)).to.equal(null)
    expect(await ApiKey.getById('')).to.equal(null)
  })

  it('deactivates expired keys while retaining live and non-expiring keys', async () => {
    const expired = await ApiKey.create({ name: 'Expired', isActive: true, expiresAt: new Date(Date.now() - 60000) })
    const live = await ApiKey.create({ name: 'Live', isActive: true, expiresAt: new Date(Date.now() + 60000) })
    const nonExpiring = await ApiKey.create({ name: 'Non-expiring', isActive: true })
    expect(await ApiKey.deactivateExpiredApiKeys()).to.equal(1)
    expect((await expired.reload()).isActive).to.equal(false)
    expect((await live.reload()).isActive).to.equal(true)
    expect((await nonExpiring.reload()).isActive).to.equal(true)
  })
})
