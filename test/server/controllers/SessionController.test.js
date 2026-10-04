const { expect } = require('chai')
const sinon = require('sinon')

const SessionController = require('../../../server/controllers/SessionController')
const Logger = require('../../../server/Logger')

describe('SessionController - openSessionMiddleware', () => {
  let playbackSessionManagerStub

  beforeEach(() => {
    sinon.stub(Logger, 'error')
    playbackSessionManagerStub = { getSession: sinon.stub() }
  })

  afterEach(() => {
    sinon.restore()
  })

  it('returns 404 when the session is not found', () => {
    playbackSessionManagerStub.getSession.returns(null)

    const boundMiddleware = SessionController.openSessionMiddleware.bind({ playbackSessionManager: playbackSessionManagerStub })
    const req = { params: { id: 'missing-session-id' }, user: { id: 'user-1', isAdminOrUp: false } }
    const res = { sendStatus: sinon.spy() }
    const next = sinon.spy()

    boundMiddleware(req, res, next)

    expect(res.sendStatus.calledWith(404)).to.be.true
    expect(next.called).to.be.false
  })

  it('calls next when the session belongs to the requesting user', () => {
    const fakeSession = { id: 'session-1', userId: 'user-1' }
    playbackSessionManagerStub.getSession.returns(fakeSession)

    const boundMiddleware = SessionController.openSessionMiddleware.bind({ playbackSessionManager: playbackSessionManagerStub })
    const req = { params: { id: 'session-1' }, user: { id: 'user-1', isAdminOrUp: false } }
    const res = { sendStatus: sinon.spy() }
    const next = sinon.spy()

    boundMiddleware(req, res, next)

    expect(next.calledOnce).to.be.true
    expect(req.playbackSession).to.equal(fakeSession)
  })

  it('returns 403 when a non-admin user requests a session belonging to another user', () => {
    const fakeSession = { id: 'session-2', userId: 'user-2' }
    playbackSessionManagerStub.getSession.returns(fakeSession)

    const boundMiddleware = SessionController.openSessionMiddleware.bind({ playbackSessionManager: playbackSessionManagerStub })
    const req = { params: { id: 'session-2' }, user: { id: 'user-1', isAdminOrUp: false } }
    const res = { sendStatus: sinon.spy() }
    const next = sinon.spy()

    boundMiddleware(req, res, next)

    expect(res.sendStatus.calledWith(403)).to.be.true
    expect(next.called).to.be.false
  })

  it('calls next when an admin requests a session belonging to another user', () => {
    const fakeSession = { id: 'session-3', userId: 'user-2' }
    playbackSessionManagerStub.getSession.returns(fakeSession)

    const boundMiddleware = SessionController.openSessionMiddleware.bind({ playbackSessionManager: playbackSessionManagerStub })
    const req = { params: { id: 'session-3' }, user: { id: 'admin-1', isAdminOrUp: true } }
    const res = { sendStatus: sinon.spy() }
    const next = sinon.spy()

    boundMiddleware(req, res, next)

    expect(next.calledOnce).to.be.true
    expect(req.playbackSession).to.equal(fakeSession)
  })
})
