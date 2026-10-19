const { expect } = require('chai')
const sinon = require('sinon')
const authorFinder = require('../../../server/finders/AuthorFinder')
const podcastFinder = require('../../../server/finders/PodcastFinder')
const fs = require('../../../server/libs/fsExtra')
const fileUtils = require('../../../server/utils/fileUtils')
const Logger = require('../../../server/Logger')
const path = require('path')

describe('AuthorFinder and PodcastFinder compatibility', () => {
  let previousPath
  beforeEach(() => {
    previousPath = global.MetadataPath
    global.MetadataPath = path.join(require('os').tmpdir(), 'abs-finder-stub')
    for (const level of ['error', 'debug']) sinon.stub(Logger, level)
  })
  afterEach(() => { sinon.restore(); global.MetadataPath = previousPath })
  it('retains singleton exports and synchronous missing ASIN', async () => {
    expect(require('../../../server/finders/AuthorFinder')).to.equal(authorFinder)
    expect(authorFinder.findAuthorByASIN('', '')).to.equal(null)
    expect(await authorFinder.findAuthorByName('', '')).to.equal(null)
    const stub = sinon.stub(authorFinder.audnexus, 'findAuthorByName').resolves({ name: 'Writer' })
    expect(await authorFinder.findAuthorByName('Writer', 'us', { maxLevenshtein: '2' })).to.deep.equal({ name: 'Writer' })
    expect(stub.firstCall.args).to.deep.equal(['Writer', 'us', 2])
  })
  it('maps author image success and failure with original extension selection', async () => {
    sinon.stub(fs, 'pathExists').resolves(false)
    const ensure = sinon.stub(fs, 'ensureDir').resolves()
    const download = sinon.stub(fileUtils, 'downloadImageFile').resolves()
    // JS captures the destructured dependency when loading the module.
    const modulePath = require.resolve('../../../server/finders/AuthorFinder')
    const cachedModule = require.cache[modulePath]
    delete require.cache[modulePath]
    const imageFinder = require(modulePath)
    require.cache[modulePath] = cachedModule
    const result = await imageFinder.saveAuthorImage('id', 'https://image/cover.PNG')
    const expectedPath = path.posix.join(path.join(global.MetadataPath, 'authors'), 'id.png')
    expect(result).to.deep.equal({ path: expectedPath })
    expect(ensure.calledOnce).to.equal(true)
    expect(download.firstCall.args).to.deep.equal(['https://image/cover.PNG', expectedPath])
    download.rejects(new Error('offline'))
    expect(await imageFinder.saveAuthorImage('id', 'https://image/cover.png?x=1')).to.deep.equal({ error: 'offline' })
    expect(download.secondCall.args[1]).to.match(/id\.jpg$/)
  })
  it('keeps podcast options, empty-term null and cover order with duplicates', async () => {
    expect(await podcastFinder.search('')).to.equal(null)
    expect(await podcastFinder.findCovers('')).to.equal(null)
    const results = [{ cover: 'one' }, { cover: null }, { cover: 'one' }, { cover: 'two' }]
    const stub = sinon.stub(podcastFinder.iTunesApi, 'searchPodcasts').resolves(results)
    expect(await podcastFinder.search('Title', { country: 'NZ' })).to.equal(results)
    expect(stub.firstCall.args).to.deep.equal(['Title', { country: 'NZ' }])
    expect(await podcastFinder.findCovers('Title')).to.deep.equal(['one', 'one', 'two'])
  })
})
