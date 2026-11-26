const { expect } = require('chai')
const sinon = require('sinon')

const SessionController = require('../../../server/controllers/SessionController')
const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')
const ShareManager = require('../../../server/managers/ShareManager')

describe('SessionController - getOpenSessions', () => {
  const userA = { id: 'aaaaaaaa-0000-0000-0000-000000000001', username: 'userA' }
  const userB = { id: 'bbbbbbbb-0000-0000-0000-000000000002', username: 'userB' }

  const makeSession = (userId) => ({
    userId,
    toJSON() {
      return { userId }
    }
  })

  let sessionA
  let sessionB
  let controller
  let fakeRes

  let originalShareSessions

  beforeEach(() => {
    sessionA = makeSession(userA.id)
    sessionB = makeSession(userB.id)

    controller = new SessionController()
    controller.playbackSessionManager = {
      sessions: [sessionA, sessionB]
    }

    sinon.stub(Database.userModel, 'getMinifiedUserObjects').resolves([userA, userB])
    originalShareSessions = ShareManager.openSharePlaybackSessions
    ShareManager.openSharePlaybackSessions = []
    sinon.stub(Logger, 'warn')

    fakeRes = { json: sinon.spy(), sendStatus: sinon.spy() }
  })

  afterEach(() => {
    ShareManager.openSharePlaybackSessions = originalShareSessions
    sinon.restore()
  })

  it('returns all open sessions when no user filter is provided', async () => {
    const req = {
      user: { isAdminOrUp: true },
      query: {}
    }

    await controller.getOpenSessions.call(controller, req, fakeRes)

    expect(fakeRes.json.calledOnce).to.be.true
    const payload = fakeRes.json.firstCall.args[0]
    expect(payload.sessions).to.have.lengthOf(2)
  })

  it('filters open sessions by userId when a valid user query param is provided', async () => {
    const req = {
      user: { isAdminOrUp: true },
      query: { user: userA.id }
    }

    await controller.getOpenSessions.call(controller, req, fakeRes)

    expect(fakeRes.json.calledOnce).to.be.true
    const payload = fakeRes.json.firstCall.args[0]
    expect(payload.sessions).to.have.lengthOf(1)
    expect(payload.sessions[0].userId).to.equal(userA.id)
  })

  it('ignores an invalid user query param and returns all sessions', async () => {
    const req = {
      user: { isAdminOrUp: true },
      query: { user: 'not-a-uuid' }
    }

    await controller.getOpenSessions.call(controller, req, fakeRes)

    expect(Logger.warn.calledOnce).to.be.true
    const payload = fakeRes.json.firstCall.args[0]
    expect(payload.sessions).to.have.lengthOf(2)
  })

  it('rejects non-admin users', async () => {
    sinon.stub(Logger, 'error')
    const req = {
      user: { isAdminOrUp: false, username: 'regular' },
      query: {}
    }

    await controller.getOpenSessions.call(controller, req, fakeRes)

    expect(fakeRes.sendStatus.calledWith(404)).to.be.true
    expect(fakeRes.json.called).to.be.false
  })
})
