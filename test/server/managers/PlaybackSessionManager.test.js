const { expect } = require('chai')
const sinon = require('sinon')
const PlaybackSessionManager = require('../../../server/managers/PlaybackSessionManager')

describe('PlaybackSessionManager', () => {
  let manager

  beforeEach(() => {
    global.MetadataPath = '/tmp/test-metadata'
    manager = new PlaybackSessionManager()
  })

  describe('syncSession input validation', () => {
    it('should return false when timeListened is negative', async () => {
      const user = {}
      const session = { libraryItemId: 'item-1', id: 'session-1' }
      const syncData = { currentTime: 100, timeListened: -50 }

      const result = await manager.syncSession(user, session, syncData)
      expect(result).to.be.false
    })

    it('should return false when timeListened is NaN', async () => {
      const user = {}
      const session = { libraryItemId: 'item-1', id: 'session-1' }
      const syncData = { currentTime: 100, timeListened: NaN }

      const result = await manager.syncSession(user, session, syncData)
      expect(result).to.be.false
    })

    it('should return false when timeListened exceeds 30 seconds', async () => {
      const user = {}
      const session = { libraryItemId: 'item-1', id: 'session-1' }
      const syncData = { currentTime: 100, timeListened: 99999 }

      const result = await manager.syncSession(user, session, syncData)
      expect(result).to.be.false
    })
  })

  describe('syncLocalSession input validation', () => {
    it('should reject when timeListening is negative', async () => {
      const user = {}
      const sessionJson = { id: 'session-1', libraryItemId: 'item-1', timeListening: -100 }
      const deviceInfo = {}

      const result = await manager.syncLocalSession(user, sessionJson, deviceInfo)
      expect(result.success).to.be.false
    })

    it('should reject when timeListening is NaN', async () => {
      const user = {}
      const sessionJson = { id: 'session-1', libraryItemId: 'item-1', timeListening: NaN }
      const deviceInfo = {}

      const result = await manager.syncLocalSession(user, sessionJson, deviceInfo)
      expect(result.success).to.be.false
    })

    it('should reject when timeListening exceeds duration', async () => {
      const user = {}
      const sessionJson = { id: 'session-1', libraryItemId: 'item-1', timeListening: 99999, duration: 3600 }
      const deviceInfo = {}

      const result = await manager.syncLocalSession(user, sessionJson, deviceInfo)
      expect(result.success).to.be.false
    })
  })
})