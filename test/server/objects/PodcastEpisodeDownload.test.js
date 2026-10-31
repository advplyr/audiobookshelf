const { expect } = require('chai')
const sinon = require('sinon')
const Download = require('../../../server/objects/PodcastEpisodeDownload')

describe('PodcastEpisodeDownload compatibility', () => {
  afterEach(() => sinon.restore())
  const episode = { title: ' Episode ', enclosure: { url: 'https://example.test/file.M4A?token=x', type: 'audio/mp4' }, publishedAt: Date.UTC(2020, 0, 1) }
  const item = { id: 'item', path: '/temporary', media: { title: 'Podcast', explicit: true } }
  it('retains initial nullable client state and preinitialization failures', () => {
    const download = new Download()
    expect(download.toJSONForClient()).to.include({ id: null, libraryItemId: null, episodeType: 'full', podcastExplicit: false, publishedAt: null })
    expect(() => download.urlFileExtension).to.throw(TypeError)
  })
  it('sets encoded URL, filename, extension and random suffix', () => {
    const download = new Download()
    download.setData(episode, item, true, 'library')
    expect(download.fileExtension).to.equal('m4a')
    expect(download.targetFilename).to.equal('Episode.m4a')
    expect(download.pubYear).to.equal(2020)
    download.setAppendRandomId(true)
    expect(download.targetFilename).to.equal('Episode (' + download.id + ').m4a')
    expect(download.targetPath).to.equal(require('../../../server/utils/fileUtils').filePathToPOSIX(require('path').join('/temporary', download.targetFilename)))
    expect(download.toJSONForClient()).to.include({ libraryItemId: 'item', libraryId: 'library', podcastExplicit: true })
  })
  it('retains mp3 fallback, malformed URL error and completion flags', () => {
    const download = new Download()
    download.setData({ ...episode, enclosure: { url: 'https://example.test/file.bin' } }, item, false, null)
    expect(download.fileExtension).to.equal('mp3')
    sinon.stub(Date, 'now').returns(42)
    download.setFinished(false)
    expect(download.toJSONForClient()).to.include({ isFinished: true, failed: true, finishedAt: 42 })
    expect(() => new Download().setData({ ...episode, enclosure: { url: '%ZZ' } }, item, false, null)).to.throw(URIError)
  })
})
