const { expect } = require('chai')
const sinon = require('sinon')
const MediaProbeData = require('../../../server/scanner/MediaProbeData')
const Logger = require('../../../server/Logger')
const ffprobePath = require.resolve('../../../server/libs/nodeFfprobe')
const proberPath = require.resolve('../../../server/utils/prober')
require(ffprobePath)

describe('prober compatibility', () => {
  let utils
  let ffprobe
  let dependency
  let previousModule
  let previousPath
  let setData

  function audio(overrides = {}) {
    return { index: 0, codec_type: 'audio', codec_name: 'aac', bit_rate: '128000', sample_rate: '44100', channels: 2, ...overrides }
  }

  function respond(streams = [audio()], format = {}, chapters) {
    const data = { format: { format_long_name: 'MPEG audio', duration: '12.5', size: '1048576', bit_rate: '256000', ...format }, streams, chapters }
    ffprobe.resolves(data)
    return data
  }

  function parsed() {
    return setData.lastCall.args[0]
  }

  beforeEach(() => {
    dependency = require.cache[ffprobePath].exports
    previousModule = require.cache[proberPath]
    previousPath = process.env.FFPROBE_PATH
    ffprobe = sinon.stub()
    require.cache[ffprobePath].exports = ffprobe
    delete require.cache[proberPath]
    utils = require(proberPath)
    setData = sinon.spy(MediaProbeData.prototype, 'setData')
    sinon.stub(console, 'error')
    sinon.stub(Logger, 'debug')
  })

  afterEach(() => {
    require.cache[ffprobePath].exports = dependency
    if (previousModule) require.cache[proberPath] = previousModule
    else delete require.cache[proberPath]
    if (previousPath === undefined) delete process.env.FFPROBE_PATH
    else process.env.FFPROBE_PATH = previousPath
    sinon.restore()
  })

  it('preserves CommonJS exports and constructs MediaProbeData with normalized metadata', async () => {
    expect(Object.keys(utils)).to.deep.equal(['probe', 'rawProbe'])
    respond([audio({ time_base: '1/44100', channel_layout: 'stereo(side)' })], { tags: { TITLE: ' Book ', ARTIST: ' Author ', track: '2/9' } })
    const result = await utils.probe('/media/book.m4b')
    expect(result).to.be.instanceOf(MediaProbeData)
    expect(result).to.include({ format: 'MPEG audio', duration: 12.5, size: 1048576, bitRate: 128000, codec: 'aac', timeBase: '1/44100', channels: 2, sampleRate: 44100, channelLayout: 'stereo' })
    expect(result.audioMetaTags).to.include({ tagTitle: 'Book', tagArtist: 'Author', tagTrack: '2/9' })
    expect(parsed().sizeMb).to.equal(1)
    expect(ffprobe.calledOnceWithExactly('/media/book.m4b')).to.equal(true)
  })

  it('selects a numeric or string default disposition and otherwise uses the first audio stream', async () => {
    for (const defaultValue of [1, '1']) {
      respond([audio(), audio({ index: 1, disposition: { default: defaultValue } })])
      expect((await utils.probe('book')).audioStream.index).to.equal(1)
    }
    respond([audio(), audio({ index: 1, disposition: { default: '0' } })])
    expect((await utils.probe('book')).audioStream.index).to.equal(0)
  })

  it('falls back to stream tags only when format tags are absent', async () => {
    respond([audio({ tags: { title: ' Stream ', language: ' en ' } })])
    expect((await utils.probe('book')).audioMetaTags.tagTitle).to.equal('Stream')
    expect(parsed().audio_stream.language).to.equal('en')
    respond([audio({ tags: { title: 'Stream' } })], { tags: {} })
    expect((await utils.probe('book')).audioMetaTags.tagTitle).to.equal(null)
  })

  it('preserves case-insensitive aliases, whitespace filtering and legacy undefined-key lookup', async () => {
    respond([audio()], { tags: { title: ' ', TiT2: ' Alias ', 'MusicBrainz Album Id': ' album-id ', undefined: ' fallback ' } })
    const result = await utils.probe('book')
    expect(result.audioMetaTags.tagTitle).to.equal('Alias')
    expect(result.audioMetaTags.tagMusicBrainzAlbumId).to.equal('album-id')
    expect(result.audioMetaTags.tagArtist).to.equal('fallback')
  })

  it('uses BPS and byte-duration tags before the default audio bitrate', async () => {
    for (const [tags, rate] of [[{ BPS: '64000' }, 64000], [{ 'BPS-eng': '96000' }, 96000], [{ DURATION: '2', NUMBER_OF_BYTES: '1000' }, 4000], [{}, 112000]]) {
      respond([audio({ bit_rate: undefined, tags })])
      expect((await utils.probe('book')).audioStream.bit_rate).to.equal(rate)
    }
    respond([audio({ bit_rate: undefined })])
    expect((await utils.probe('book')).audioStream.bit_rate).to.equal(null)
  })

  it('retains numeric coercion, nulls and layout whitespace', async () => {
    respond([audio({ bit_rate: 'bad', channels: '2', sample_rate: null, channel_layout: 'stereo (side)' })], { duration: null, size: 'bad', bit_rate: 'bad', format_long_name: '', name: 'fallback' })
    const result = await utils.probe('book')
    expect(result).to.include({ duration: 0, size: null, bitRate: null, channels: '2', sampleRate: 0, channelLayout: 'stereo ', format: 'fallback' })
    expect(parsed().sizeMb).to.equal(null)
    respond([audio({ sample_rate: undefined })], { format_long_name: '', name: '' })
    expect(await utils.probe('book')).to.include({ sampleRate: null, format: 'Unknown' })
  })

  it('preserves video metadata, frame-rate fractions and cover-art handling', async () => {
    const video = { index: 1, codec_type: 'video', codec_name: 'mjpeg', bit_rate: '32000', avg_frame_rate: '30000/1001', width: '800', height: null, is_avc: 'false', tags: {} }
    respond([audio(), video])
    const result = await utils.probe('book')
    expect(result).to.include({ embeddedCoverArt: 'mjpeg', videoStream: null })
    expect(parsed().video_stream).to.include({ frame_rate: 30000 / 1001, width: 800, height: 0, is_avc: false, bit_rate: 256000 })
    for (const [rate, expected] of [['1/0', Infinity], ['bad', null], ['24', 24]]) {
      respond([audio(), { ...video, avg_frame_rate: '', r_frame_rate: rate, is_avc: 0 }])
      await utils.probe('book')
      expect(parsed().video_stream.frame_rate).to.equal(expected)
      expect(parsed().video_stream.is_avc).to.equal(true)
    }
  })

  it('estimates video bitrate from the container and preserves the low-estimate fallback', async () => {
    const video = { index: 1, codec_type: 'video', tags: {} }
    respond([audio({ bit_rate: '64000' }), video], { bit_rate: '256000' })
    await utils.probe('book')
    expect(parsed().video_stream.bit_rate).to.equal(192000)
    respond([audio({ bit_rate: '128000' }), video], { bit_rate: '160000' })
    await utils.probe('book')
    expect(parsed().video_stream.bit_rate).to.equal(160000)
  })

  it('sorts chapters, assigns sequential ids and preserves time-base fallback rules', async () => {
    respond([audio()], {}, [
      { start_time: '10.5', end_time: '20', 'TAG:title': ' Second ' },
      { start_time: null, end_time: 'bad', start: 1000, end: 2000, time_base: '2/1000', tags: { title: ' First ' } },
      { title: ' Empty ' }
    ])
    expect((await utils.probe('book')).chapters).to.deep.equal([
      { start: 0, end: 0, title: 'Empty', id: 0 },
      { start: 1, end: 2, title: 'First', id: 1 },
      { start: 10.5, end: 20, title: 'Second', id: 2 }
    ])
  })

  it('retains raw tags and debug logging only in verbose mode', async () => {
    const raw = respond([audio()], { tags: { title: 'Book' } })
    await utils.probe('book', true)
    expect(parsed().rawTags).to.equal(raw.format.tags)
    expect(Logger.debug.calledWithExactly('Tags', raw.format.tags)).to.equal(true)
    await utils.probe('book')
    expect(parsed()).not.to.have.property('rawTags')
  })

  it('returns ffprobe errors and parse failures without changing their messages', async () => {
    ffprobe.resolves({ error: { string: 'Bad input' } })
    expect(await utils.probe('book')).to.deep.equal({ error: 'Bad input' })
    ffprobe.resolves(null)
    expect((await utils.probe('book')).error).to.be.instanceOf(TypeError)
    for (const raw of [{}, { format: {}, streams: null }, { format: { tags: { title: 42 } }, streams: [] }]) {
      ffprobe.resolves(raw)
      expect(await utils.probe('book')).to.deep.equal({ error: 'Probe Failed' })
    }
    expect(console.error.callCount).to.equal(3)
    respond([])
    expect(await utils.probe('book')).to.deep.equal({ error: 'Invalid media file: no audio or video streams found' })
  })

  it('preserves the existing video-only setData failure', async () => {
    respond([{ index: 0, codec_type: 'video', codec_name: 'h264' }])
    expect((await utils.probe('video')).error).to.be.instanceOf(TypeError)
  })

  it('returns rejected values unchanged for both entry points', async () => {
    for (const error of [new Error('spawn failed'), { code: 'ENOENT' }, 'failed', null]) {
      ffprobe.callsFake(() => Promise.reject(error))
      expect((await utils.probe('book')).error).to.equal(error)
      expect((await utils.rawProbe('book')).error).to.equal(error)
    }
  })

  it('passes raw results through unchanged and shares the environment binary path', async () => {
    process.env.FFPROBE_PATH = '/custom/ffprobe'
    const raw = respond()
    expect(await utils.rawProbe('book')).to.equal(raw)
    expect(ffprobe.FFPROBE_PATH).to.equal('/custom/ffprobe')
    ffprobe.FFPROBE_PATH = undefined
    await utils.probe('book')
    expect(ffprobe.FFPROBE_PATH).to.equal('/custom/ffprobe')
    delete process.env.FFPROBE_PATH
    await utils.rawProbe('book')
    expect(ffprobe.FFPROBE_PATH).to.equal('/custom/ffprobe')
  })
})
