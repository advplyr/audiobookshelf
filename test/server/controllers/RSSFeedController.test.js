const { expect } = require('chai')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')
const RssFeedManager = require('../../../server/managers/RssFeedManager')
const controller = require('../../../server/controllers/RSSFeedController')

describe('RSSFeedController request validation', () => {
  const routes = [
    ['openRSSFeedForItem', 'libraryItemModel', 'openFeedForItem'],
    ['openRSSFeedForCollection', 'collectionModel', 'openFeedForCollection'],
    ['openRSSFeedForSeries', 'seriesModel', 'openFeedForSeries']
  ]
  let entity
  let req
  let res

  beforeEach(() => {
    entity = { media: { title: 'Book' }, hasAudioTracks: true, books: [{ includedAudioFiles: [{}] }] }
    req = {
      params: { itemId: 'item', collectionId: 'collection', seriesId: 'series' },
      user: { id: 'user', username: 'admin', checkCanAccessLibraryItem: () => true }
    }
    res = { status: sinon.stub().returnsThis(), send: sinon.stub().returnsThis(), sendStatus: sinon.stub(), json: sinon.stub() }
    sinon.stub(Logger, 'error')
    sinon.stub(RssFeedManager, 'checkExistsBySlug').resolves(false)
    for (const [, model, open] of routes) {
      sinon.stub(Database, model).value({ getExpandedById: sinon.stub().resolves(entity) })
      sinon.stub(RssFeedManager, open).resolves({ toOldJSONMinified: () => ({ id: 'feed' }) })
    }
  })

  afterEach(() => sinon.restore())

  for (const [method, , open] of routes) {
    it(`${method} preserves invalid-body responses without opening a feed`, async () => {
      const invalidBodies = [undefined, null, {}, [], 'text', { serverAddress: '', slug: 'feed' }, { serverAddress: 1, slug: 'feed' }, { serverAddress: 'host' }, { serverAddress: 'host', slug: '' }, { serverAddress: 'host', slug: false }]
      for (const body of invalidBodies) {
        req.body = body
        await controller[method](req, res)
        expect(res.status.lastCall.args).to.deep.equal([400])
        expect(res.send.lastCall.args).to.deep.equal(['Invalid request body'])
      }
      expect(RssFeedManager[open].called).to.equal(false)
      expect(RssFeedManager.checkExistsBySlug.called).to.equal(false)
    })

    it(`${method} preserves whitespace, non-URL addresses and extra options`, async () => {
      for (const serverAddress of ['host', ' ']) {
        req.body = { serverAddress, slug: ' ', customOption: { enabled: true } }
        await controller[method](req, res)
        expect(RssFeedManager[open].lastCall.args[2]).to.equal(req.body)
        expect(res.json.lastCall.args).to.deep.equal([{ feed: { id: 'feed' } }])
      }
      expect(res.status.called).to.equal(false)
    })
  }

  it('keeps item lookup and access checks before body validation', async () => {
    Database.libraryItemModel.getExpandedById.resolves(null)
    await controller.openRSSFeedForItem(req, res)
    expect(res.sendStatus.lastCall.args).to.deep.equal([404])

    Database.libraryItemModel.getExpandedById.resolves(entity)
    req.user.checkCanAccessLibraryItem = () => false
    await controller.openRSSFeedForItem(req, res)
    expect(res.sendStatus.lastCall.args).to.deep.equal([403])
    expect(res.status.called).to.equal(false)
  })
})
