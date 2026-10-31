const { expect } = require('chai')
const sinon = require('sinon')
const Path = require('path')
const os = require('os')
const fs = require('fs/promises')
const EventEmitter = require('events')
const { Readable } = require('stream')
const axios = require('axios')
const Ffmpeg = require('../../../server/libs/fluentFfmpeg')
const embeddedFs = require('../../../server/libs/fsExtra')
const helpers = require('../../../server/utils/ffmpegHelpers')

describe('ffmpegHelpers compatibility', () => {
  let directory
  let previousFilter
  beforeEach(async () => {
    directory = await fs.mkdtemp(Path.join(os.tmpdir(), 'abs-ffmpeg-'))
    previousFilter = global.DisableSsrfRequestFilter
  })
  afterEach(async () => {
    sinon.restore()
    global.DisableSsrfRequestFilter = previousFilter
    await fs.rm(directory, { recursive: true, force: true })
  })

  function command(event = 'end', payload) {
    const instance = new EventEmitter()
    for (const method of ['input', 'inputOptions', 'outputOptions', 'output']) instance[method] = sinon.stub().returnsThis()
    instance.run = () => instance.emit(event, payload)
    return instance
  }

  it('writes escaped concat paths and starts at the containing track', async () => {
    const tracks = [
      { index: 0, duration: 10, metadata: { path: '/first.mp3', ext: '.mp3' } },
      { index: 1, duration: 20, metadata: { path: "/a'b.mp3", ext: '.mp3' } }
    ]
    const output = Path.join(directory, 'concat.txt')
    expect(await helpers.writeConcatFile(tracks, output, 10)).to.equal(10)
    const text = await fs.readFile(output, 'utf8')
    expect(text).to.include('duration 20')
    expect(text).not.to.include('/first.mp3')
    expect(text).to.include("a'" + String.fromCharCode(92) + "''b.mp3")
    // A start beyond all tracks retains the original fallback to the first track.
    expect(await helpers.writeConcatFile(tracks, output, 100)).to.equal(0)
    expect(await fs.readFile(output, 'utf8')).to.include('/first.mp3')
  })

  it('keeps file-writing failures as null or false results', async () => {
    const missingPath = Path.join(directory, 'missing', 'metadata.txt')
    expect(await helpers.writeConcatFile([], missingPath)).to.equal(null)
    expect(await helpers.writeFFMetadataFile({ title: 'Title' }, null, missingPath)).to.equal(false)
    const output = Path.join(directory, 'metadata.txt')
    expect(await helpers.writeFFMetadataFile({ title: 'Title' }, null, output)).to.equal(true)
    expect(await fs.readFile(output, 'utf8')).to.equal(';FFMETADATA1\ntitle=Title\n')
  })

  it('preserves omission of empty metadata and series formatting', () => {
    expect(helpers.getFFMetadataObject({ media: {
      title: 'Title', subtitle: 'Subtitle', authorName: 'Author', genres: ['One', 'Two'],
      narrators: ['Narrator'], series: [{ name: 'Series', bookSeries: { sequence: '0.5' } }]
    } }, 2)).to.deep.equal({
      title: 'Title', artist: 'Author', album_artist: 'Author', album: 'Title: Subtitle',
      TIT3: 'Subtitle', genre: 'One; Two', composer: 'Narrator', TRACKTOTAL: '2', grouping: 'Series #0.5'
    })
  })

  it('retains arbitrary copy rejection values', async () => {
    const reason = { code: 'COPY_FAILED' }
    let failure
    try {
      await helpers.addCoverAndMetadataToFile('/book.mp3', null, '/metadata.txt', 1, 'audio/mpeg', null, command(), () => Promise.reject(reason))
    } catch (error) { failure = error }
    expect(failure).to.equal(reason)
  })

  it('reports merge progress by timemark and removes the concat file', async () => {
    const ffmpeg = command()
    const progress = sinon.spy()
    const remove = sinon.spy(embeddedFs, 'remove')
    ffmpeg.run = () => {
      ffmpeg.emit('progress', { timemark: '00:00:05', percent: 99 })
      ffmpeg.emit('end')
    }
    await helpers.mergeAudioFiles([
      { index: 0, duration: 10, metadata: { path: '/a.mp3', ext: '.mp3' } },
      { index: 1, duration: 10, metadata: { path: '/b.mp3', ext: '.mp3' } }
    ], 20, directory, '/out.m4b', {}, progress, ffmpeg)
    expect(progress.calledOnceWithExactly(25)).to.equal(true)
    expect(ffmpeg.outputOptions.secondCall.args[0]).to.deep.equal(['-map 0:a', '-acodec aac', '-ac 2', '-b:a 128k'])
    expect(remove.calledOnceWithExactly(Path.join(directory, 'files.txt'))).to.equal(true)
  })

  it('maps a canceled merge to the existing cancellation error', async () => {
    let failure
    try {
      await helpers.mergeAudioFiles([{ index: 0, duration: 1, metadata: { path: '/a.m4b', ext: '.m4b' } }], 1, directory, '/out.m4b', {}, null, command('error', new Error('Killed with SIGKILL')))
    } catch (error) { failure = error }
    expect(failure.message).to.equal('FFMPEG_CANCELED')
  })

  it('retries podcast user agents before reporting a request failure', async () => {
    const userAgents = []
    global.DisableSsrfRequestFilter = () => true
    sinon.stub(axios.defaults, 'adapter').callsFake((config) => {
      userAgents.push(config.headers['User-Agent'])
      return Promise.reject(new Error('Request failed'))
    })
    expect(await helpers.downloadPodcastEpisode({ url: 'https://example.test/episode.mp3' })).to.deep.equal({ success: false, isRequestError: true })
    expect(userAgents).to.have.length(2)
    expect(userAgents[0]).to.include('like iTMS')
    expect(userAgents[1]).not.to.include('like iTMS')
  })

  it('downloads through FFmpeg and trims long tags', async () => {
    global.DisableSsrfRequestFilter = () => true
    const stream = Readable.from(['audio'])
    sinon.stub(axios.defaults, 'adapter').callsFake((config) => Promise.resolve({ data: stream, status: 200, statusText: 'OK', headers: {}, config }))
    sinon.stub(Ffmpeg.prototype, 'run').callsFake(function () {
      const options = this._getArguments()
      expect(options).to.include('podcast=1')
      expect(options).to.include('comment=' + 'x'.repeat(10000))
      expect(options).to.include('year=2020')
      this.emit('end')
      return this
    })
    try {
      expect(await helpers.downloadPodcastEpisode({
        url: 'https://example.test/episode.mp3', targetPath: Path.join(directory, 'episode.mp3'), pubYear: 2020,
        libraryItem: { media: { title: 'Podcast', author: 'Author', genres: [], language: 'en' } },
        rssPodcastEpisode: { title: 'Episode', description: 'x'.repeat(10001), enclosure: { length: '100' } }
      })).to.deep.equal({ success: true })
    } finally { stream.destroy() }
  })

  it('retains image output paths and false on encoding failure', async () => {
    const run = sinon.stub(Ffmpeg.prototype, 'run').callsFake(function () {
      this.emit('end')
      return this
    })
    const output = Path.join(directory, 'cover.jpg')
    expect(await helpers.extractCoverArt('/book.mp3', output)).to.equal(output)
    expect(await helpers.resizeImage('/cover.png', output, 100, null)).to.equal(output)
    run.callsFake(function () {
      this.emit('error', new Error('Encoding failed'))
      return this
    })
    expect(await helpers.extractCoverArt('/book.mp3', output)).to.equal(false)
    expect(await helpers.resizeImage('/cover.png', output, null, 100)).to.equal(false)
  })
})
