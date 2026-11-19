const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
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
})

describe('UserController - findAll', () => {
  const hoursAfterStart = (hours) => new Date(Date.UTC(2026, 0, 1) + hours * 60 * 60 * 1000)

  let alice
  let bob
  let carol
  let dave
  let alicePhone

  async function createUser(username) {
    return Database.userModel.create({
      username,
      pash: 'hash',
      token: 'token',
      type: 'user',
      isActive: true,
      permissions: Database.userModel.getDefaultPermissionsForUserType('user'),
      bookmarks: [],
      extraData: {}
    })
  }

  async function createSession(id, userId, deviceId, createdAt, updatedAt) {
    await Database.playbackSessionModel.create(
      {
        id,
        userId,
        deviceId,
        mediaItemId: '00000000-0000-4000-8000-000000000000',
        mediaItemType: 'book',
        displayTitle: `Title ${id}`,
        createdAt,
        updatedAt
      },
      { silent: true }
    )
  }

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    alice = await createUser('alice')
    bob = await createUser('bob')
    carol = await createUser('carol')
    dave = await createUser('dave')

    alicePhone = await Database.deviceModel.create({ deviceId: 'alice-phone', clientName: 'Abs Android', userId: alice.id, extraData: {} })

    // Inserted in this order. Bob's two sessions at hour 5 tie on updatedAt,
    // the first inserted one has the larger id and the earlier createdAt
    await createSession('11111111-1111-4111-8111-111111111111', alice.id, null, hoursAfterStart(0), hoursAfterStart(1))
    await createSession('ffffffff-ffff-4fff-bfff-ffffffffffff', bob.id, null, hoursAfterStart(4), hoursAfterStart(5))
    await createSession('33333333-3333-4333-8333-333333333333', alice.id, alicePhone.id, hoursAfterStart(0.5), hoursAfterStart(3))
    await createSession('44444444-4444-4444-8444-444444444444', null, null, hoursAfterStart(9), hoursAfterStart(10))
    await createSession('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', bob.id, null, hoursAfterStart(4.5), hoursAfterStart(5))
    await createSession('66666666-6666-4666-8666-666666666666', alice.id, null, hoursAfterStart(2), hoursAfterStart(2))
    await createSession('77777777-7777-4777-8777-777777777777', dave.id, null, hoursAfterStart(1), hoursAfterStart(1))
    await createSession('88888888-8888-4888-8888-888888888888', bob.id, null, hoursAfterStart(1), hoursAfterStart(1))
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.sync({ force: true })
  })

  it('returns the latest session of each user, building one session per user', async () => {
    const getOldPlaybackSessionSpy = sinon.spy(Database.playbackSessionModel, 'getOldPlaybackSession')
    const req = { user: { isAdminOrUp: true, isRoot: true }, query: { include: 'latestSession' } }
    const res = { sendStatus: sinon.spy(), json: sinon.spy() }

    await UserController.findAll(req, res)

    expect(res.sendStatus.called).to.be.false
    const users = res.json.firstCall.args[0].users
    const latestSessionIdOf = (user) => users.find((u) => u.id === user.id).latestSession?.id ?? null

    expect(users).to.have.length(4)
    expect(latestSessionIdOf(alice)).to.equal('33333333-3333-4333-8333-333333333333')
    expect(latestSessionIdOf(bob)).to.equal('ffffffff-ffff-4fff-bfff-ffffffffffff')
    expect(latestSessionIdOf(carol)).to.be.null
    expect(latestSessionIdOf(dave)).to.equal('77777777-7777-4777-8777-777777777777')

    const aliceSession = users.find((u) => u.id === alice.id).latestSession.toJSON()
    expect(aliceSession.userId).to.equal(alice.id)
    expect(aliceSession.displayTitle).to.equal('Title 33333333-3333-4333-8333-333333333333')
    expect(aliceSession.startedAt).to.equal(hoursAfterStart(0.5).valueOf())
    expect(aliceSession.updatedAt).to.equal(hoursAfterStart(3).valueOf())
    expect(aliceSession.deviceInfo.id).to.equal(alicePhone.id)
    expect(aliceSession.deviceInfo.clientName).to.equal('Abs Android')

    // Only the 3 latest sessions are loaded, not all 7 user sessions
    expect(getOldPlaybackSessionSpy.callCount).to.equal(3)
  })
})
