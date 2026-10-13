const { expect } = require('chai')
const sinon = require('sinon')
const manager = require('../../../server/managers/ShareManager')
const Database = require('../../../server/Database')
const SocketAuthority = require('../../../server/SocketAuthority')

describe('ShareManager compatibility', () => {
  let shares, sessions, models
  beforeEach(() => { shares = manager.openMediaItemShares; sessions = manager.openSharePlaybackSessions; models = { mediaItemShare: { destroy: sinon.stub().resolves(1), findAll: sinon.stub().resolves([]) } }; manager.openMediaItemShares = []; manager.openSharePlaybackSessions = []; sinon.stub(Database, 'models').get(() => models) })
  afterEach(() => { sinon.restore(); manager.openMediaItemShares = shares; manager.openSharePlaybackSessions = sessions })
  it('removes private fields from lookup copies without altering stored data', () => {
    const data = { id: 'id', mediaItemId: 'book', slug: 'slug', pash: 'secret', userId: 'user', extraData: {} }
    manager.openMediaItemShares = [{ id: 'id', mediaItemShare: data }]
    expect(manager.findBySlug('slug')).to.deep.equal({ id: 'id', mediaItemId: 'book', slug: 'slug' })
    expect(manager.findByMediaItemId('missing')).to.equal(null)
    expect(data.pash).to.equal('secret')
  })
  it('clears timers and playback sessions before destroying and emitting', async () => {
    const clear = sinon.spy(), emitter = sinon.stub(SocketAuthority, 'adminEmitter')
    manager.openMediaItemShares = [{ id: 'id', mediaItemShare: { id: 'id', pash: 'secret' }, timeout: { clear } }]
    manager.openSharePlaybackSessions = [{ id: 'session', mediaItemShareId: 'id' }, { id: 'keep', mediaItemShareId: 'other' }]
    Database.models.mediaItemShare.destroy.callsFake(async () => {
      expect(clear.calledOnce).to.equal(true)
      expect(manager.openMediaItemShares).to.deep.equal([])
      expect(manager.openSharePlaybackSessions.map(s => s.id)).to.deep.equal(['keep'])
    })
    await manager.removeMediaItemShare('id')
    expect(emitter.firstCall.args).to.deep.equal(['share_closed', { id: 'id' }])
    await manager.removeMediaItemShare('missing')
    expect(emitter.calledOnce).to.equal(true)
  })
  it('schedules expiry and closes stale sessions at the exact cutoff', async () => {
    const clock = sinon.useFakeTimers(100000000), remove = sinon.stub(manager, 'removeMediaItemShare').resolves()
    manager.scheduleMediaItemShare({ id: 'id', expiresAt: new Date(Date.now() + 10), toJSON: () => ({ id: 'id' }) })
    await clock.tickAsync(10)
    expect(remove.calledOnceWithExactly('id')).to.equal(true)
    const cutoff = Date.now() - 86400000
    manager.openSharePlaybackSessions = [{ id: 'stale', updatedAt: cutoff - 1 }, { id: 'keep', updatedAt: cutoff }]
    manager.closeStaleOpenShareSessions()
    expect(manager.openSharePlaybackSessions.map(s => s.id)).to.deep.equal(['keep'])
  })
})
