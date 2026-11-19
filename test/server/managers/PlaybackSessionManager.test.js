const { expect } = require('chai')
const sinon = require('sinon')

const Logger = require('../../../server/Logger')
const PlaybackSessionManager = require('../../../server/managers/PlaybackSessionManager')

describe('PlaybackSessionManager', () => {
  let originalMetadataPath
  /** @type {PlaybackSessionManager} */
  let playbackSessionManager
  let res
  let dbLockedError

  beforeEach(() => {
    originalMetadataPath = global.MetadataPath
    global.MetadataPath = '/metadata'
    playbackSessionManager = new PlaybackSessionManager()

    res = {
      sendStatus: sinon.spy(),
      status: sinon.stub().returnsThis(),
      send: sinon.spy(),
      json: sinon.spy()
    }
    dbLockedError = new Error('SQLITE_BUSY: database is locked')
    dbLockedError.name = 'SequelizeTimeoutError'

    sinon.stub(Logger, 'error')
    sinon.stub(Logger, 'info')
  })

  afterEach(() => {
    sinon.restore()
    global.MetadataPath = originalMetadataPath
  })

  // A rejected promise in these request handlers is unhandled and shuts down the server
  describe('when saving progress to the db fails', () => {
    const user = { id: 'user1' }
    const session = { id: 'session1' }

    it('syncSessionRequest should respond with 500', async () => {
      sinon.stub(playbackSessionManager, 'syncSession').rejects(dbLockedError)

      await playbackSessionManager.syncSessionRequest(user, session, { currentTime: 10 }, res)

      expect(res.sendStatus.calledOnceWith(500)).to.be.true
      expect(Logger.error.calledOnce).to.be.true
    })

    it('closeSessionRequest should respond with 500', async () => {
      sinon.stub(playbackSessionManager, 'closeSession').rejects(dbLockedError)

      await playbackSessionManager.closeSessionRequest(user, session, { currentTime: 10 }, res)

      expect(res.sendStatus.calledOnceWith(500)).to.be.true
      expect(Logger.error.calledOnce).to.be.true
    })

    it('syncLocalSessionRequest should respond with 500', async () => {
      sinon.stub(playbackSessionManager, 'getDeviceInfo').resolves({})
      sinon.stub(playbackSessionManager, 'syncLocalSession').rejects(dbLockedError)

      await playbackSessionManager.syncLocalSessionRequest({ user, body: { id: 'local1', displayTitle: 'Book' } }, res)

      expect(res.status.calledOnceWith(500)).to.be.true
      expect(res.send.calledOnce).to.be.true
    })

    it('syncLocalSessionsRequest should report the failed session and sync the rest', async () => {
      sinon.stub(playbackSessionManager, 'getDeviceInfo').resolves({})
      const syncLocalSession = sinon.stub(playbackSessionManager, 'syncLocalSession')
      syncLocalSession.onFirstCall().rejects(dbLockedError)
      syncLocalSession.onSecondCall().resolves({ id: 'local2', success: true, progressSynced: true })

      await playbackSessionManager.syncLocalSessionsRequest({ user, body: { sessions: [{ id: 'local1' }, { id: 'local2' }] } }, res)

      expect(res.json.calledOnce).to.be.true
      expect(res.json.firstCall.args[0]).to.deep.equal({
        results: [
          { id: 'local1', success: false, error: 'Failed to sync session' },
          { id: 'local2', success: true, progressSynced: true }
        ]
      })
    })
  })
})
