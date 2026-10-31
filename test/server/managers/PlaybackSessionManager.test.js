const { expect } = require('chai')
const sinon = require('sinon')
const Manager = require('../../../server/managers/PlaybackSessionManager')
const Session = require('../../../server/objects/PlaybackSession')
const DeviceInfo = require('../../../server/objects/DeviceInfo')
const Database = require('../../../server/Database')
const SocketAuthority = require('../../../server/SocketAuthority')
const fs = require('../../../server/libs/fsExtra')

describe('PlaybackSessionManager compatibility', () => {
  let metadata, manager, item, user, library
  beforeEach(() => {
    metadata = global.MetadataPath; global.MetadataPath = '/temporary'; manager = new Manager()
    sinon.stub(SocketAuthority, 'adminEmitter'); sinon.stub(SocketAuthority, 'clientEmitter')
    item = { id: 'item', libraryId: 'library', title: 'Title', authorNamesFirstLast: 'Author', isPodcast: false, getTrackList: () => [{ contentUrl: '/track' }], media: { id: 'book', title: 'Title', coverPath: null, checkCanDirectPlay: () => true, oldMetadataToJSON: () => ({ title: 'Title', author: 'Author' }), getChapters: () => [], getPlaybackTitle: () => 'Title', getPlaybackAuthor: () => 'Author', getPlaybackDuration: () => 60 } }
    user = { id: 'user', username: 'User', getMediaProgress: sinon.stub().returns(null), createUpdateMediaProgressFromPayload: sinon.stub().resolves({}), toJSONForPublic: sinon.stub().returns({ id: 'user' }) }
    library = { librarySettings: { markAsFinishedPercentComplete: 0.95, markAsFinishedTimeRemaining: 10 } }
  })
  afterEach(() => { sinon.restore(); global.MetadataPath = metadata })
  const session = () => new Session({ id: 'session', userId: 'user', libraryItemId: 'item', duration: 60, currentTime: 0, updatedAt: 1, startedAt: 1 })
  const models = () => {
    sinon.stub(Database, 'libraryItemModel').get(() => ({ getExpandedById: sinon.stub().resolves(item) }))
    sinon.stub(Database, 'libraryModel').get(() => ({ findByPk: sinon.stub().resolves(library) }))
  }
  it('closes only same-device sessions before opening direct playback at prior progress', async () => {
    const device = new DeviceInfo({ id: 'device' }), previous = session()
    previous.deviceInfo = device; manager.sessions = [previous]
    const close = sinon.stub(manager, 'closeSession').callsFake(async () => { manager.sessions = [] })
    user.getMediaProgress.returns({ currentTime: '12.5', isFinished: false })
    const opened = await manager.startSession(user, device, item, null, { forceDirectPlay: true, mediaPlayer: 'test' })
    expect(close.calledOnceWithExactly(user, previous, null)).to.equal(true)
    expect(opened.currentTime).to.equal(12.5)
    expect(opened.audioTracks).to.deep.equal([{ contentUrl: '/track' }])
    expect(manager.getSession(opened.id)).to.equal(opened)
    expect(manager.getUserSession('user')).to.equal(opened)
    expect(manager.getStream(opened.id)).to.equal(null)
  })
  it('restarts finished media at zero', async () => {
    user.getMediaProgress.returns({ currentTime: 50, isFinished: true })
    const opened = await manager.startSession(user, new DeviceInfo(), item, null, { forceDirectPlay: true })
    expect(opened.currentTime).to.equal(0)
    expect(opened.mediaPlayer).to.equal('unknown')
  })
  it('returns false before mutating progress when media or library is missing', async () => {
    sinon.stub(Database, 'libraryItemModel').get(() => ({ getExpandedById: sinon.stub().resolves(null) }))
    const current = session()
    expect(await manager.syncSession(user, current, { currentTime: 20, timeListened: 2 })).to.equal(false)
    expect(current.currentTime).to.equal(0)
    expect(user.createUpdateMediaProgressFromPayload.called).to.equal(false)
  })
  it('syncs listening progress, emits progress data and starts persistence', async () => {
    models()
    const progress = { id: 'progress', getOldMediaProgress: () => ({ currentTime: 20 }) }
    user.createUpdateMediaProgressFromPayload.resolves({ mediaProgress: progress })
    const save = sinon.stub(manager, 'saveSession').resolves(), current = session()
    await manager.syncSession(user, current, { currentTime: 20, timeListened: 2, duration: 0 })
    expect(current.timeListening).to.equal(2)
    expect(current.progress).to.equal(1 / 3)
    expect(user.createUpdateMediaProgressFromPayload.firstCall.args[0]).to.include({ duration: 60, currentTime: 20 })
    expect(SocketAuthority.clientEmitter.firstCall.args[1]).to.equal('user_item_progress_updated')
    expect(save.calledOnceWithExactly(current)).to.equal(true)
  })
  it('preserves first-save timestamp even on failed persistence and uses update on retry', async () => {
    sinon.stub(Date, 'now').returns(42)
    const create = sinon.stub(Database, 'createPlaybackSession').rejects(new Error('failed')), update = sinon.stub(Database, 'updatePlaybackSession').resolves()
    const current = session()
    expect(manager.saveSession(current)).to.equal(undefined)
    current.timeListening = 1
    expect(await manager.saveSession(current).catch(e => e)).to.be.instanceOf(Error)
    expect(current.lastSave).to.equal(42)
    await manager.saveSession(current)
    expect(create.calledOnce).to.equal(true); expect(update.calledOnce).to.equal(true)
  })
  it('emits close events before removing the session and waits for stream closure', async () => {
    const current = session(), close = sinon.stub().resolves()
    current.stream = { close }; manager.sessions = [current]
    sinon.stub(manager, 'saveSession').resolves()
    user.toJSONForPublic.callsFake(sessions => { expect(sessions).to.deep.equal([current]); return {} })
    await manager.closeSession(user, current)
    expect(close.calledOnce).to.equal(true)
    expect(manager.sessions).to.deep.equal([])
    expect(SocketAuthority.clientEmitter.calledWithExactly('user', 'user_session_closed', 'session')).to.equal(true)
  })
  it('maps legacy local IDs consistently and keeps newer user progress untouched', async () => {
    models()
    sinon.stub(Database, 'getPlaybackSession').resolves(null)
    const create = sinon.stub(Database, 'createPlaybackSession').resolves()
    user.getMediaProgress.returns({ updatedAt: new Date(100), currentTime: 50 })
    const payload = { id: 'play_local_old', libraryItemId: 'item', libraryId: 'library', updatedAt: 20, currentTime: 10, timeListening: 1, mediaMetadata: { title: 'Stored' } }
    const first = await manager.syncLocalSession(user, { ...payload, mediaMetadata: { title: 'Stored' } }, new DeviceInfo())
    const second = await manager.syncLocalSession(user, { ...payload, mediaMetadata: { title: 'Stored' } }, new DeviceInfo())
    expect(first.id).to.equal(second.id)
    expect(first.progressSynced).to.equal(false)
    expect(user.createUpdateMediaProgressFromPayload.called).to.equal(false)
    expect(create.firstCall.args[0].mediaMetadata).to.deep.equal({ title: 'Stored', author: 'Author' })
  })
  it('returns explicit local sync errors for missing library', async () => {
    sinon.stub(Database, 'libraryItemModel').get(() => ({ getExpandedById: sinon.stub().resolves(item) }))
    sinon.stub(Database, 'libraryModel').get(() => ({ findByPk: sinon.stub().resolves(null) }))
    expect(await manager.syncLocalSession(user, { id: 'id', libraryItemId: 'item' }, new DeviceInfo())).to.deep.equal({ id: 'id', success: false, error: 'Library not found' })
  })
  it('cleans only orphan UUID stream folders', async () => {
    const orphan = '11111111-1111-4111-8111-111111111111', active = '22222222-2222-4222-8222-222222222222'
    manager.sessions = [{ id: active }]
    sinon.stub(fs, 'ensureDir').resolves(); sinon.stub(fs, 'readdir').resolves([orphan, active, 'other'])
    const remove = sinon.stub(fs, 'remove').resolves()
    await manager.removeOrphanStreams()
    expect(remove.calledOnce).to.equal(true)
    expect(remove.firstCall.args[0]).to.include(orphan)
  })
  it('reuses and persists updated device info through the existing device boundary', async () => {
    const existing = { update: sinon.stub().returns(true) }, update = sinon.stub().resolves()
    sinon.stub(Database, 'deviceModel').get(() => ({ getOldDeviceByDeviceId: sinon.stub().resolves(existing), updateFromOld: update }))
    expect(await manager.getDeviceInfo({ headers: { 'user-agent': 'Mozilla/5.0' }, user: { id: 'user' } }, { deviceId: 'device' })).to.equal(existing)
    expect(update.calledOnceWithExactly(existing)).to.equal(true)
  })
  it('creates a device when no existing client ID was supplied', async () => {
    const create = sinon.stub().resolves()
    sinon.stub(Database, 'deviceModel').get(() => ({ createFromOld: create }))
    const device = await manager.getDeviceInfo({ headers: {}, user: { id: 'user' } })
    expect(create.calledOnceWithExactly(device)).to.equal(true)
    expect(device.userId).to.equal('user')
  })

})
