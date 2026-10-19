const { expect } = require('chai')
const sinon = require('sinon')
const Stream = require('../../../server/objects/Stream')
const SocketAuthority = require('../../../server/SocketAuthority')
const Ffmpeg = require('../../../server/libs/fluentFfmpeg')
const fs = require('../../../server/libs/fsExtra')
const nodeFs = require('fs/promises')
const Path = require('path')
const os = require('os')

describe('Stream compatibility', () => {
  let temporary, stream, item
  beforeEach(async () => {
    temporary = await nodeFs.mkdtemp(Path.join(os.tmpdir(), 'abs-phase5-stream-'))
    item = { id: 'item', isPodcast: false, media: { getPlaybackTitle: () => 'Title', getPlaybackDuration: () => 70 }, toOldJSONExpanded: () => ({ id: 'item' }), getTrackList: () => [{ index: 1, duration: 70, metadata: { path: Path.join(temporary, 'input.m4b'), ext: '.m4b' }, mimeType: 'audio/mp4', codec: 'aac' }] }
    stream = new Stream('session', temporary, { id: 'user' }, item, null, 60)
    sinon.stub(SocketAuthority, 'clientEmitter')
  })
  afterEach(async () => { if (stream.loop) clearInterval(stream.loop); sinon.restore(); await nodeFs.rm(temporary, { recursive: true, force: true }) })
  it('keeps segment calculations and stream audio track shape', () => {
    expect(stream.segmentStartNumber).to.equal(5)
    expect(stream.numSegments).to.equal(12)
    expect(stream.getAudioTrack().toJSON()).to.include({ contentUrl: '/hls/session/output.m3u8', duration: 70, mimeType: 'application/vnd.apple.mpegurl' })
    expect(stream.episode).to.equal(null)
  })
  it('resets for backward/far-forward requests but ignores completed transcode requests', async () => {
    const reset = sinon.stub(stream, 'reset').resolves()
    expect(await stream.checkSegmentNumberRequest(3)).to.equal(18)
    expect(reset.calledWithExactly(-12)).to.equal(true)
    stream.furthestSegmentCreated = 6
    expect(await stream.checkSegmentNumberRequest(20)).to.equal(120)
    expect(reset.calledWithExactly(90)).to.equal(true)
    stream.isTranscodeComplete = true
    expect(await stream.checkSegmentNumberRequest(10)).to.equal(false)
  })
  it('reports chunks and opens the client only once after seven segments', async () => {
    sinon.stub(fs, 'readdir').resolves(['output-0.ts', 'output-1.ts', 'output-2.ts', 'output-3.ts', 'output-4.ts', 'output-5.ts', 'output-6.ts', 'ignore.txt'])
    await stream.checkFiles(); await stream.checkFiles()
    const calls = SocketAuthority.clientEmitter.getCalls().map(c => c.args)
    expect(calls.filter(c => c[1] === 'stream_open')).to.have.length(1)
    expect(calls.find(c => c[1] === 'stream_progress')[2]).to.include({ stream: 'session', numSegments: 12, percent: '58.33%' })
    expect(calls.find(c => c[1] === 'stream_progress')[2].chunks).to.deep.equal(['0-6'])
    expect(stream.furthestSegmentCreated).to.equal(6)
  })
  it('kills and emits closed only after cleaning the stream directory', async () => {
    const remove = sinon.stub(fs, 'remove').resolves(), kill = sinon.spy(), closed = sinon.spy()
    stream.ffmpeg = { kill }; stream.on('closed', closed)
    await stream.close('  failure  ')
    expect(kill.calledOnceWithExactly('SIGKILL')).to.equal(true)
    expect(remove.calledOnceWithExactly(stream.streamPath)).to.equal(true)
    expect(SocketAuthority.clientEmitter.lastCall.args).to.deep.equal(['user', 'stream_error', { id: 'session', error: 'failure' }])
    expect(closed.calledOnce).to.equal(true)
  })
  it('keeps timeout result and prevents concurrent resets', async () => {
    const clock = sinon.useFakeTimers(); stream.ffmpeg = {}
    const pending = stream.waitCancelTranscode()
    await clock.tickAsync(10000)
    expect(await pending).to.equal(false)
    stream.ffmpeg = null
    const start = sinon.stub(stream, 'start').resolves()
    await stream.reset(-10); await stream.reset(30)
    expect(start.calledOnce).to.equal(true)
    expect(stream.startTime).to.equal(0)
    expect(stream.isResetting).to.equal(true)
  })
  it('closes on concat-file write failure without running FFmpeg', async () => {
    const close = sinon.stub(stream, 'close').resolves(), run = sinon.stub(Ffmpeg.prototype, 'run')
    await stream.start()
    expect(close.calledOnceWithExactly('Failed to write stream concat file')).to.equal(true)
    expect(stream.ffmpeg).to.equal(null)
    expect(run.called).to.equal(false)
  })
  it('retries AAC errors, but closes for a missing source file', async () => {
    sinon.stub(Ffmpeg.prototype, 'run')
    const reset = sinon.stub(stream, 'reset').resolves(), close = sinon.stub(stream, 'close').resolves()
    await stream.generatePlaylist(); await stream.start()
    const command = stream.ffmpeg
    command.emit('error', new Error('ffmpeg exited with code 1'))
    expect(stream.transcodeOptions.forceAAC).to.equal(true)
    expect(reset.calledOnceWithExactly(60)).to.equal(true)
    command.emit('error', new Error('ffmpeg exited with code 1: No such file or directory'))
    expect(close.calledOnce).to.equal(true)
  })
  it('marks completion and clears the FFmpeg reference on end', async () => {
    sinon.stub(Ffmpeg.prototype, 'run')
    await stream.generatePlaylist(); await stream.start()
    stream.ffmpeg.emit('end')
    expect(stream.isTranscodeComplete).to.equal(true)
    expect(stream.isClientInitialized).to.equal(true)
    expect(stream.ffmpeg).to.equal(null)
    expect(SocketAuthority.clientEmitter.calledWith('user', 'stream_open')).to.equal(true)
  })
})
