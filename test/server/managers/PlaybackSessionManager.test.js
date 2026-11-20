const { expect } = require('chai')
const sinon = require('sinon')
const { Sequelize } = require('sequelize')

const Database = require('../../../server/Database')
const PlaybackSessionManager = require('../../../server/managers/PlaybackSessionManager')

describe('PlaybackSessionManager.getDeviceInfo', () => {
  /** @type {PlaybackSessionManager} */
  let playbackSessionManager
  let user1
  let user2
  let previousMetadataPath

  beforeEach(async () => {
    global.ServerSettings = {}
    previousMetadataPath = global.MetadataPath
    global.MetadataPath = '/metadata'
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    user1 = await createUser('user1')
    user2 = await createUser('user2')

    playbackSessionManager = new PlaybackSessionManager()
  })

  afterEach(async () => {
    global.MetadataPath = previousMetadataPath
    await Database.sequelize.sync({ force: true })
  })

  function createUser(username) {
    return Database.userModel.create({
      username,
      pash: 'hash',
      token: `token-${username}`,
      type: 'user',
      isActive: true,
      permissions: Database.userModel.getDefaultPermissionsForUserType('user'),
      bookmarks: [],
      extraData: {}
    })
  }

  function makeReq(user, ip) {
    return {
      headers: {
        'user-agent': 'TestClient/1.0.0 CFNetwork/1490.0.4 Darwin/23.2.0',
        'x-real-ip': ip
      },
      user
    }
  }

  const clientDeviceInfoWithoutId = { clientName: 'Test Client', clientVersion: '1.0.0' }

  it('reuses one device row for repeated requests without a deviceId from the same user and client', async () => {
    const first = await playbackSessionManager.getDeviceInfo(makeReq(user1, '10.0.0.1'), { ...clientDeviceInfoWithoutId })
    const second = await playbackSessionManager.getDeviceInfo(makeReq(user1, '10.0.0.2'), { ...clientDeviceInfoWithoutId })
    const third = await playbackSessionManager.getDeviceInfo(makeReq(user1, '10.0.0.3'), { ...clientDeviceInfoWithoutId })

    expect(second.id).to.equal(first.id)
    expect(third.id).to.equal(first.id)
    expect(await Database.deviceModel.count()).to.equal(1)

    const device = await Database.deviceModel.findByPk(first.id)
    expect(device.userId).to.equal(user1.id)
    expect(device.ipAddress).to.equal('10.0.0.3')
  })

  it('keeps a separate device row per user for requests without a deviceId', async () => {
    const user1First = await playbackSessionManager.getDeviceInfo(makeReq(user1, '10.0.0.1'), { ...clientDeviceInfoWithoutId })
    const user2First = await playbackSessionManager.getDeviceInfo(makeReq(user2, '10.0.0.1'), { ...clientDeviceInfoWithoutId })
    const user1Second = await playbackSessionManager.getDeviceInfo(makeReq(user1, '10.0.0.1'), { ...clientDeviceInfoWithoutId })
    const user2Second = await playbackSessionManager.getDeviceInfo(makeReq(user2, '10.0.0.1'), { ...clientDeviceInfoWithoutId })

    expect(user2First.id).to.not.equal(user1First.id)
    expect(user1Second.id).to.equal(user1First.id)
    expect(user2Second.id).to.equal(user2First.id)
    expect(await Database.deviceModel.count()).to.equal(2)

    const user1Device = await Database.deviceModel.findByPk(user1First.id)
    const user2Device = await Database.deviceModel.findByPk(user2First.id)
    expect(user1Device.userId).to.equal(user1.id)
    expect(user2Device.userId).to.equal(user2.id)
  })

  it('keeps the deviceId sent by the client apart from the fallback device row', async () => {
    const clientDeviceInfoWithId = { ...clientDeviceInfoWithoutId, deviceId: 'client-device-1' }

    const withId = await playbackSessionManager.getDeviceInfo(makeReq(user1, '10.0.0.1'), { ...clientDeviceInfoWithId })
    const withIdAgain = await playbackSessionManager.getDeviceInfo(makeReq(user1, '10.0.0.2'), { ...clientDeviceInfoWithId })
    const withoutId = await playbackSessionManager.getDeviceInfo(makeReq(user1, '10.0.0.1'), { ...clientDeviceInfoWithoutId })
    const withoutIdAgain = await playbackSessionManager.getDeviceInfo(makeReq(user1, '10.0.0.2'), { ...clientDeviceInfoWithoutId })

    expect(withId.deviceId).to.equal('client-device-1')
    expect(withIdAgain.id).to.equal(withId.id)
    expect(withoutId.id).to.not.equal(withId.id)
    expect(withoutIdAgain.id).to.equal(withoutId.id)
    expect(await Database.deviceModel.count()).to.equal(2)

    const device = await Database.deviceModel.findByPk(withId.id)
    expect(device.deviceId).to.equal('client-device-1')
  })

  it('creates one device row for concurrent requests without a deviceId', async () => {
    const createSpy = sinon.spy(Database.deviceModel, 'createFromOld')
    try {
      const results = await Promise.all(Array.from({ length: 10 }, (_, i) => playbackSessionManager.getDeviceInfo(makeReq(user1, `10.0.0.${i + 1}`), { ...clientDeviceInfoWithoutId })))

      expect(createSpy.callCount).to.equal(1)
      expect(await Database.deviceModel.count()).to.equal(1)
      expect(new Set(results.map((r) => r.id)).size).to.equal(1)
      expect(playbackSessionManager.deviceLookupQueue.size).to.equal(0)
    } finally {
      createSpy.restore()
    }
  })

  it('recovers from a failed device create so the next request for the same key succeeds', async () => {
    const original = Database.deviceModel.createFromOld.bind(Database.deviceModel)
    const createStub = sinon.stub(Database.deviceModel, 'createFromOld')
    createStub.onFirstCall().rejects(new Error('create failed'))
    createStub.callsFake(original)
    try {
      let error = null
      try {
        await playbackSessionManager.getDeviceInfo(makeReq(user1, '10.0.0.1'), { ...clientDeviceInfoWithoutId })
      } catch (err) {
        error = err
      }
      expect(error).to.be.an('error')
      expect(error.message).to.equal('create failed')

      const second = await playbackSessionManager.getDeviceInfo(makeReq(user1, '10.0.0.2'), { ...clientDeviceInfoWithoutId })

      expect(second.id).to.be.a('string')
      expect(createStub.callCount).to.equal(2)
      expect(await Database.deviceModel.count()).to.equal(1)
      expect(playbackSessionManager.deviceLookupQueue.size).to.equal(0)
    } finally {
      createStub.restore()
    }
  })
})
