const { expect } = require('chai')
const sinon = require('sinon')

const PlaybackSessionManager = require('../../../server/managers/PlaybackSessionManager')
const Database = require('../../../server/Database')
const SocketAuthority = require('../../../server/SocketAuthority')
const Logger = require('../../../server/Logger')

// The manager builds its streams path from this at construction time.
global.MetadataPath = global.MetadataPath || '/tmp/abs-test-metadata'

describe('PlaybackSessionManager', () => {
  describe('syncSession duration priority', () => {
    let manager
    let user
    let session

    const REAL_DURATION = 3600

    beforeEach(() => {
      manager = new PlaybackSessionManager()

      sinon.stub(Database, 'libraryItemModel').value({
        getExpandedById: sinon.stub().resolves({ id: 'li-1', libraryId: 'lib-1' })
      })
      sinon.stub(Database, 'libraryModel').value({
        findByPk: sinon.stub().resolves({
          librarySettings: { markAsFinishedTimeRemaining: 10, markAsFinishedPercentComplete: null }
        })
      })
      sinon.stub(SocketAuthority, 'clientEmitter').callsFake(() => {})
      sinon.stub(SocketAuthority, 'adminEmitter').callsFake(() => {})
      sinon.stub(Logger, 'debug').callsFake(() => {})
      sinon.stub(Logger, 'error').callsFake(() => {})
      sinon.stub(manager, 'saveSession').resolves()

      user = { id: 'u-1', createUpdateMediaProgressFromPayload: sinon.stub().resolves({}) }
      session = {
        id: 's-1',
        libraryItemId: 'li-1',
        episodeId: null,
        deviceDescription: 'test device',
        duration: REAL_DURATION,
        currentTime: 0,
        progress: 0,
        timeListening: 0,
        addListeningTime: sinon.spy()
      }
    })

    afterEach(() => {
      sinon.restore()
    })

    it('uses the session duration and ignores a shorter one sent by the client', async () => {
      // The payload from #5471: a client reporting duration == currentTime would
      // otherwise leave zero time remaining and trip the mark-as-finished check,
      // even though the item is an hour long and barely started.
      await manager.syncSession(user, session, { currentTime: 10, duration: 10, timeListened: 10 })

      const payload = user.createUpdateMediaProgressFromPayload.firstCall.args[0]
      expect(payload.duration).to.equal(REAL_DURATION)
    })

    it('falls back to the client duration when the session has none', async () => {
      // Keeps items that are no longer in the library syncing sensibly.
      session.duration = 0

      await manager.syncSession(user, session, { currentTime: 10, duration: 250, timeListened: 10 })

      const payload = user.createUpdateMediaProgressFromPayload.firstCall.args[0]
      expect(payload.duration).to.equal(250)
    })

    it('reports zero when neither side knows the duration', async () => {
      session.duration = 0

      await manager.syncSession(user, session, { currentTime: 10, timeListened: 10 })

      const payload = user.createUpdateMediaProgressFromPayload.firstCall.args[0]
      expect(payload.duration).to.equal(0)
    })
  })
})
