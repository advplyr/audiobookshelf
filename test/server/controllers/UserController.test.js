const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const ApiRouter = require('../../../server/routers/ApiRouter')
const MeController = require('../../../server/controllers/MeController')
const UserController = require('../../../server/controllers/UserController')
const ApiCacheManager = require('../../../server/managers/ApiCacheManager')
const Auth = require('../../../server/Auth')
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
})

describe('UserController - getListeningSessions', () => {
  /** @type {ApiRouter} */
  let apiRouter
  let user
  let device
  let sessionIds

  // Minutes after the base time for each session, in insertion order.
  // Sessions 2 and 3 share an updatedAt and fall either side of the page boundary at 5 per page
  const minutes = [3, 10, 7, 7, 1, 11, 0, 5, 9, 2, 8, 4]
  // Newest first, with the tie in insertion order
  const expectedOrder = [5, 1, 8, 10, 2, 3, 7, 11, 0, 9, 4, 6]

  const toSqliteDate = (ms) => new Date(ms).toISOString().replace('T', ' ').replace('Z', ' +00:00')

  const createUser = (username) =>
    Database.userModel.create({
      username,
      pash: 'hash',
      token: 'token',
      type: 'user',
      isActive: true,
      permissions: {},
      bookmarks: [],
      extraData: {}
    })

  const createSession = async (id, userId, deviceId, updatedAt) => {
    const values = { userId, deviceId, displayTitle: 'Test Session', timeListening: 60, extraData: {} }
    if (id) values.id = id
    const session = await Database.playbackSessionModel.create(values)
    await Database.sequelize.query('UPDATE playbackSessions SET updatedAt = ? WHERE id = ?', { replacements: [toSqliteDate(updatedAt), session.id] })
    return session.id
  }

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    apiRouter = new ApiRouter({
      auth: new Auth(),
      apiCacheManager: new ApiCacheManager()
    })

    user = await createUser('listener')
    const otherUser = await createUser('other')
    device = await Database.deviceModel.create({ deviceId: 'test-device', clientName: 'Abs Web', userId: user.id, extraData: {} })

    // The tied session with the larger id is inserted first, so ordering by id would swap them
    const ids = { 2: 'ffffffff-ffff-4fff-bfff-ffffffffffff', 3: '00000000-0000-4000-8000-000000000000' }
    const baseTime = Date.UTC(2026, 0, 1)
    sessionIds = []
    for (let i = 0; i < minutes.length; i++) {
      sessionIds.push(await createSession(ids[i], user.id, device.id, baseTime + minutes[i] * 60000))
    }
    // Newer than every session of the user above and must not be returned
    await createSession(undefined, otherUser.id, null, baseTime + 60 * 60000)
  })

  afterEach(async () => {
    sinon.restore()

    // Clear all tables
    await Database.sequelize.sync({ force: true })
  })

  const getPayload = async (controller, query) => {
    const fakeReq = { query, user, reqUser: user, params: { id: user.id } }
    const fakeRes = { json: sinon.spy() }
    await controller.getListeningSessions.bind(apiRouter)(fakeReq, fakeRes)
    expect(fakeRes.json.calledOnce).to.be.true
    return fakeRes.json.firstCall.args[0]
  }

  it('returns pages 0 and 1 sorted by updatedAt with ties in insertion order', async () => {
    const expectedIds = expectedOrder.map((index) => sessionIds[index])
    const spy = sinon.spy(Database.playbackSessionModel, 'getOldPlaybackSession')

    const page0 = await getPayload(UserController, { page: '0', itemsPerPage: '5' })
    expect(page0.total).to.equal(12)
    expect(page0.numPages).to.equal(3)
    expect(page0.page).to.equal(0)
    expect(page0.itemsPerPage).to.equal(5)
    expect(page0.sessions.map((s) => s.id)).to.deep.equal(expectedIds.slice(0, 5))
    expect(page0.sessions[0].user).to.deep.equal({ id: user.id, username: 'listener' })
    expect(page0.sessions[0].deviceInfo.id).to.equal(device.id)
    expect(spy.callCount).to.equal(5)
    spy.resetHistory()

    const page1 = await getPayload(UserController, { page: '1', itemsPerPage: '5' })
    expect(page1.total).to.equal(12)
    expect(page1.sessions.map((s) => s.id)).to.deep.equal(expectedIds.slice(5, 10))
    expect(spy.callCount).to.equal(5)
    spy.resetHistory()

    const mePage1 = await getPayload(MeController, { page: '1', itemsPerPage: '5' })
    expect(mePage1.total).to.equal(12)
    expect(mePage1.numPages).to.equal(3)
    expect(mePage1.sessions.map((s) => s.id)).to.deep.equal(expectedIds.slice(5, 10))
    expect(spy.callCount).to.equal(5)
  })

  it('maps only the requested page to playback sessions', async () => {
    const spy = sinon.spy(Database.playbackSessionModel, 'getOldPlaybackSession')

    await getPayload(UserController, { page: '0', itemsPerPage: '5' })
    expect(spy.callCount).to.equal(5)

    spy.resetHistory()
    await getPayload(MeController, { page: '2', itemsPerPage: '5' })
    expect(spy.callCount).to.equal(2)
  })

  it('returns the same JSON as slicing the full sorted session list for valid params', async () => {
    // Valid params only: page >= 0 and itemsPerPage >= 1, including a page past the end and a page size above the total
    const queries = [{}, { page: '0', itemsPerPage: '5' }, { page: '1', itemsPerPage: '5' }, { page: '2', itemsPerPage: '5' }, { page: '3', itemsPerPage: '5' }, { page: '0', itemsPerPage: '100' }, { page: '1', itemsPerPage: '100' }]

    const allSessions = await apiRouter.getUserListeningSessionsHelper(user.id)
    const spy = sinon.spy(Database.playbackSessionModel, 'getOldPlaybackSession')
    for (const query of queries) {
      const itemsPerPage = Number(query.itemsPerPage) || 10
      const page = Number(query.page) || 0
      const start = page * itemsPerPage
      const expected = {
        total: allSessions.length,
        numPages: Math.ceil(allSessions.length / itemsPerPage),
        page,
        itemsPerPage,
        sessions: allSessions.slice(start, start + itemsPerPage)
      }
      const expectedWithUser = { ...expected, sessions: expected.sessions.map((session) => ({ ...session, user: { id: user.id, username: 'listener' } })) }

      spy.resetHistory()
      expect(JSON.stringify(await getPayload(MeController, query)), JSON.stringify(query)).to.equal(JSON.stringify(expected))
      expect(spy.callCount, JSON.stringify(query)).to.equal(expected.sessions.length)

      spy.resetHistory()
      expect(JSON.stringify(await getPayload(UserController, query)), JSON.stringify(query)).to.equal(JSON.stringify(expectedWithUser))
      expect(spy.callCount, JSON.stringify(query)).to.equal(expected.sessions.length)
    }
  })
})
