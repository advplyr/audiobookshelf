const { expect } = require('chai')
const sinon = require('sinon')
const manager = require('../../../server/managers/CoverManager')
const cache = require('../../../server/managers/CacheManager')
const fs = require('../../../server/libs/fsExtra')
const nodeFs = require('fs/promises')
const Path = require('path')
const os = require('os')

describe('CoverManager compatibility', () => {
  let settings, metadata, temporary
  beforeEach(async () => { settings = global.ServerSettings; metadata = global.MetadataPath; global.ServerSettings = {}; temporary = await nodeFs.mkdtemp(Path.join(os.tmpdir(), 'abs-phase5-cover-')); global.MetadataPath = temporary })
  afterEach(async () => { sinon.restore(); global.ServerSettings = settings; global.MetadataPath = metadata; await nodeFs.rm(temporary, { recursive: true, force: true }) })
  it('recognizes a real PNG header and removes invalid images only when requested', async () => {
    const image = Path.join(temporary, 'valid.png'), invalid = Path.join(temporary, 'invalid')
    await nodeFs.writeFile(image, Buffer.from('89504e470d0a1a0a00000000', 'hex'))
    await nodeFs.writeFile(invalid, 'invalid')
    expect((await manager.checkFileIsValidImage(image)).ext).to.equal('png')
    expect(await manager.checkFileIsValidImage(invalid, true)).to.deep.equal({ error: 'Invalid image' })
    expect(await fs.pathExists(invalid)).to.equal(false)
  })
  it('rejects upload extensions and preserves move failure without purging cache', async () => {
    const item = { id: 'item', path: temporary, media: { title: 'Title' } }, purge = sinon.stub(cache, 'purgeCoverCache').resolves([])
    expect((await manager.uploadCover(item, { name: 'bad.exe' })).error).to.include('Invalid image type')
    const mv = sinon.stub().rejects(new Error('denied'))
    expect(await manager.uploadCover(item, { name: 'cover.png', mv })).to.deep.equal({ error: 'Failed to move cover into destination' })
    expect(purge.called).to.equal(false)
  })
  it('keeps already-selected covers without checking filesystem or purging', async () => {
    const path = Path.join(temporary, 'cover.png'), item = { id: 'item', media: { coverPath: path }, libraryFiles: [{ metadata: { path } }] }
    const purge = sinon.stub(cache, 'purgeCoverCache').resolves([])
    expect(await manager.validateCoverPath(path, item)).to.deep.equal({ cover: path, updated: false })
    expect(purge.called).to.equal(false)
    expect(await manager.validateCoverPath('https://example.test/image.png', item)).to.deep.equal({ error: 'Invalid cover path' })
  })
  it('removes only differently-suffixed recognized cover files', async () => {
    sinon.stub(fs, 'readdir').resolves(['cover.png', 'COVER.jpg', 'other.jpg', 'cover.txt'])
    const remove = sinon.stub(manager, 'removeFile').resolves()
    await manager.removeOldCovers(temporary, '.png')
    expect(remove.calledOnceWithExactly(Path.join(temporary, 'COVER.jpg'))).to.equal(true)
    expect(await manager.saveEmbeddedCoverArt([], 'item')).to.equal(null)
    expect(await manager.saveEbookCoverArt(null, 'item')).to.equal(null)
  })
})
