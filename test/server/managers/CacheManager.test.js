const { expect } = require('chai')
const sinon = require('sinon')
const manager = require('../../../server/managers/CacheManager')
const Database = require('../../../server/Database')
const fs = require('../../../server/libs/fsExtra')

describe('CacheManager compatibility', () => {
  let coverPath, imagePath, xAccel
  beforeEach(() => { coverPath = manager.CoverCachePath; imagePath = manager.ImageCachePath; xAccel = global.XAccel; manager.CoverCachePath = '/temporary/covers'; manager.ImageCachePath = '/temporary/images' })
  afterEach(() => { sinon.restore(); manager.CoverCachePath = coverPath; manager.ImageCachePath = imagePath; global.XAccel = xAccel })
  const response = () => ({ sendStatus: sinon.spy(), type: sinon.spy(), status: sinon.stub().returnsThis(), header: sinon.stub().returnsThis(), send: sinon.spy() })
  const id = '11111111-1111-4111-8111-111111111111'
  it('rejects invalid IDs, formats and unsafe dimensions before filesystem access', async () => {
    const exists = sinon.stub(fs, 'pathExists'), res = response()
    await manager.handleCoverCache(res, 'invalid')
    await manager.handleAuthorCache(res, id, { width: -1 })
    await manager.handleCoverCache(res, id, { height: 1.5 })
    await manager.handleCoverCache(res, id, { format: '../png' })
    expect(res.sendStatus.callCount).to.equal(4)
    expect(res.sendStatus.alwaysCalledWithExactly(400)).to.equal(true)
    expect(exists.called).to.equal(false)
  })
  it('returns 404 for missing source after a cache miss', async () => {
    sinon.stub(fs, 'pathExists').resolves(false)
    sinon.stub(Database, 'libraryItemModel').get(() => ({ getCoverPath: sinon.stub().resolves(null) }))
    const res = response()
    await manager.handleCoverCache(res, id)
    expect(res.type.calledWithExactly('image/webp')).to.equal(true)
    expect(res.sendStatus.calledWithExactly(404)).to.equal(true)
  })
  it('preserves X-Accel response for an existing cached cover', async () => {
    sinon.stub(fs, 'pathExists').resolves(true)
    global.XAccel = '/internal'
    const res = response()
    await manager.handleCoverCache(res, id)
    expect(res.status.calledWithExactly(204)).to.equal(true)
    expect(res.header.firstCall.args[0]['X-Accel-Redirect']).to.include(id + '_400.webp')
    expect(res.send.calledOnce).to.equal(true)
  })
  it('purges matching filename prefixes and converts unlink errors to false', async () => {
    sinon.stub(fs, 'readdir').resolves(['item_400.webp', 'item-other.png', 'different.png'])
    sinon.stub(fs, 'pathExists').resolves(true)
    const unlink = sinon.stub(fs, 'unlink').onFirstCall().resolves().onSecondCall().rejects(new Error('denied'))
    expect(await manager.purgeEntityCache('item', '/temporary')).to.deep.equal([true, false])
    expect(unlink.callCount).to.equal(2)
    expect(await manager.purgeEntityCache(null, '/temporary')).to.deep.equal([])
    expect(manager.removeCache(null)).to.equal(false)
  })
})
