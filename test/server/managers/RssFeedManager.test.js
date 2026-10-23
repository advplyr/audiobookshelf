const { expect } = require('chai')
const sinon = require('sinon')
const manager = require('../../../server/managers/RssFeedManager')
const Database = require('../../../server/Database')
const SocketAuthority = require('../../../server/SocketAuthority')

describe('RssFeedManager compatibility', () => {
  afterEach(() => sinon.restore())
  it('keeps default indexing protection and mutates supplied metadata details', () => {
    const metadataDetails = { ownerName: 1, ownerEmail: 'owner' }
    expect(manager.getFeedOptionsFromReqOptions({ metadataDetails })).to.deep.equal({ preventIndexing: true, ownerName: null, ownerEmail: 'owner' })
    expect(metadataDetails.preventIndexing).to.equal(true)
    expect(manager.getFeedOptionsFromReqOptions({ metadataDetails: { preventIndexing: false } }).preventIndexing).to.equal(false)
  })
  it('removes only feeds with missing entities on initialization', async () => {
    const destroy = sinon.stub().resolves(1)
    sinon.stub(Database, 'feedModel').get(() => ({ findAll: sinon.stub().resolves([{ id: 'missing', title: 'Missing', entity: null }, { id: 'keep', entity: {} }]), destroy }))
    await manager.init()
    expect(destroy.calledOnceWithExactly({ where: { id: ['missing'] } })).to.equal(true)
  })
  it('checks podcast child timestamps and preserves missing-entity failure', async () => {
    sinon.stub(Database, 'podcastEpisodeModel').get(() => ({ findOne: sinon.stub().resolves({ updatedAt: new Date(20) }) }))
    const feed = { entityType: 'libraryItem', entityUpdatedAt: new Date(15), getEntity: sinon.stub().resolves({ updatedAt: new Date(10), mediaType: 'podcast', mediaId: 'podcast' }) }
    expect(await manager.checkFeedRequiresUpdate(feed)).to.equal(true)
    feed.getEntity.resolves(null)
    const error = await manager.checkFeedRequiresUpdate(feed).catch(e => e)
    expect(error).to.be.instanceOf(TypeError)
  })
  it('detects changed collection track counts before timestamp checks', async () => {
    const feed = { entityType: 'collection', feedEpisodes: [], getEntity: sinon.stub().resolves({ updatedAt: new Date(10), books: [{ includedAudioFiles: [{}] }] }) }
    expect(await manager.checkFeedRequiresUpdate(feed)).to.equal(true)
    expect(feed.getEntity.firstCall.args[0].include.include.attributes).to.deep.equal(['id', 'updatedAt'])
  })
  it('emits closed feed even when removal reports false, and ignores null', async () => {
    sinon.stub(Database, 'feedModel').get(() => ({ removeById: sinon.stub().resolves(false) }))
    const emit = sinon.stub(SocketAuthority, 'emitter')
    expect(await manager.handleCloseFeed({ id: 'id', feedURL: 'url', toOldJSONMinified: () => ({ id: 'id' }) })).to.equal(false)
    expect(emit.firstCall.args).to.deep.equal(['rss_feed_closed', { id: 'id' }])
    expect(await manager.handleCloseFeed(null)).to.equal(false)
  })
  it('returns 404 for a missing feed and preserves the explicit m4b mime type', async () => {
    const findOne = sinon.stub().onFirstCall().resolves(null).onSecondCall().resolves({ getEpisodePath: () => '/temporary/book.m4b' })
    sinon.stub(Database, 'feedModel').get(() => ({ findOne }))
    const res = { sendStatus: sinon.spy(), setHeader: sinon.spy(), sendFile: sinon.spy() }
    await manager.getFeedItem({ params: { slug: 'missing', episodeId: 'episode' } }, res)
    expect(res.sendStatus.calledWithExactly(404)).to.equal(true)
    await manager.getFeedItem({ params: { slug: 'slug', episodeId: 'episode' } }, res)
    expect(res.setHeader.calledWithExactly('Content-Type', 'audio/mp4')).to.equal(true)
    expect(res.sendFile.calledWithExactly('/temporary/book.m4b')).to.equal(true)
  })
})
