const { expect } = require('chai')
const sinon = require('sinon')

const LibraryItemController = require('../../../server/controllers/LibraryItemController')
const Logger = require('../../../server/Logger')

describe('LibraryItemController - canStream enforcement', () => {
  beforeEach(() => {
    sinon.stub(Logger, 'warn')
    sinon.stub(Logger, 'error')
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('startPlaybackSession', () => {
    it('should return 403 when user cannot stream', () => {
      const req = {
        user: { canStream: false, username: 'testuser' },
        libraryItem: { hasAudioTracks: true, id: 'li_test' }
      }
      const res = { sendStatus: sinon.spy() }

      LibraryItemController.startPlaybackSession.call({}, req, res)

      expect(res.sendStatus.calledWith(403)).to.be.true
      expect(Logger.warn.calledOnce).to.be.true
      expect(Logger.warn.firstCall.args[0]).to.include('testuser')
    })

    it('should not block when user can stream', () => {
      const startSessionRequest = sinon.spy()
      const req = {
        user: { canStream: true },
        libraryItem: { hasAudioTracks: true, id: 'li_test' }
      }
      const res = { sendStatus: sinon.spy() }

      LibraryItemController.startPlaybackSession.call(
        { playbackSessionManager: { startSessionRequest } },
        req,
        res
      )

      expect(res.sendStatus.called).to.be.false
      expect(startSessionRequest.calledOnce).to.be.true
    })

    it('should return 404 when item has no audio tracks', () => {
      const req = {
        user: { canStream: true },
        libraryItem: { hasAudioTracks: false, id: 'li_test' }
      }
      const res = { sendStatus: sinon.spy() }

      LibraryItemController.startPlaybackSession.call({}, req, res)

      expect(res.sendStatus.calledWith(404)).to.be.true
    })
  })

  describe('startEpisodePlaybackSession', () => {
    it('should return 403 when user cannot stream', () => {
      const req = {
        user: { canStream: false, username: 'testuser' },
        libraryItem: { isPodcast: true, id: 'li_test' },
        params: { episodeId: 'ep_1' }
      }
      const res = { sendStatus: sinon.spy() }

      LibraryItemController.startEpisodePlaybackSession.call({}, req, res)

      expect(res.sendStatus.calledWith(403)).to.be.true
      expect(Logger.warn.calledOnce).to.be.true
    })

    it('should not block when user can stream', () => {
      const startSessionRequest = sinon.spy()
      const req = {
        user: { canStream: true },
        libraryItem: {
          isPodcast: true,
          id: 'li_test',
          media: { podcastEpisodes: [{ id: 'ep_1' }] }
        },
        params: { episodeId: 'ep_1' }
      }
      const res = { sendStatus: sinon.spy() }

      LibraryItemController.startEpisodePlaybackSession.call(
        { playbackSessionManager: { startSessionRequest } },
        req,
        res
      )

      expect(res.sendStatus.called).to.be.false
      expect(startSessionRequest.calledOnce).to.be.true
    })
  })
})
