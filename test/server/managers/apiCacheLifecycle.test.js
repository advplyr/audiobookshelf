const { expect } = require('chai')
const sinon = require('sinon')
const { LRUCache } = require('lru-cache')
const ApiCacheManager = require('../../../server/managers/ApiCacheManager')
const Logger = require('../../../server/Logger')

describe('ApiCacheManager lifecycle compatibility', () => {
  beforeEach(() => sinon.stub(Logger, 'debug'))
  afterEach(() => sinon.restore())
  it('keeps default byte-size calculation and personalized TTL', () => {
    const manager = new ApiCacheManager()
    const send = sinon.spy()
    const req = { user: { username: 'u' }, url: '/libraries/1/personalized', query: {} }
    const res = { send, getHeaders: () => ({ type: 'json' }), statusCode: 201 }
    manager.middleware(req, res, () => {})
    expect(res.send('body')).to.equal(undefined)
    const key = JSON.stringify({ user: 'u', url: req.url })
    expect(manager.cache.get(key)).to.deep.equal({ body: 'body', headers: { type: 'json' }, statusCode: 201 })
    expect(manager.cache.calculatedSize).to.equal(4 + JSON.stringify({ type: 'json' }).length)
    expect(manager.cache.getRemainingTTL(key)).to.be.greaterThan(0)
    expect(send.calledOnceWithExactly('body')).to.equal(true)
  })
  it('keeps seven hooks and resolves model names from instance or bulk options', () => {
    const manager = new ApiCacheManager(new LRUCache({ max: 10 }))
    const addHook = sinon.spy()
    manager.init({ sequelize: { addHook } })
    expect(addHook.callCount).to.equal(7)
    expect(addHook.getCalls().map((call) => call.args[0])).to.deep.equal(['afterCreate', 'afterUpdate', 'afterDestroy', 'afterBulkCreate', 'afterBulkUpdate', 'afterBulkDestroy', 'afterUpsert'])
    expect(manager.getModelName(null)).to.equal('unknown')
    expect(manager.getModelName({ model: { name: 'mediaProgress' } })).to.equal('mediaProgress')
    expect(manager.getModelName({ constructor: { name: 'session' } })).to.equal('session')
    const clear = sinon.stub(manager, 'clear')
    addHook.firstCall.args[1]({ name: 'book' })
    expect(clear.calledOnceWithExactly({ name: 'book' }, 'afterCreate')).to.equal(true)
  })
  it('removes malformed cache keys and only matching URL slices', () => {
    const cache = new LRUCache({ max: 10 })
    for (const key of ['invalid', JSON.stringify({ url: '/me/items' }), JSON.stringify({ url: '/libraries/1/items' }), JSON.stringify(null)]) {
      cache.set(key, { body: '[]', headers: {}, statusCode: 200 })
    }
    const manager = new ApiCacheManager(cache)
    expect(manager.clearByUrlPattern(/^\/me/)).to.equal(2)
    expect(cache.size).to.equal(2)
    manager.clear({ name: 'book' }, 'afterUpdate')
    expect(cache.size).to.equal(0)
  })
})
