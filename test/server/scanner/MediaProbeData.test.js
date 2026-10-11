const { expect } = require('chai')
const MediaProbeData = require('../../../server/scanner/MediaProbeData')
const AudioMetaTags = require('../../../server/objects/metadata/AudioMetaTags')

const parsed = {
  format: 'MP2/3 (MPEG audio layer 2/3)',
  duration: 120.5,
  size: 4096,
  bit_rate: 64000,
  video_stream: { codec: 'mjpeg' },
  audio_stream: { bit_rate: 128000, codec: 'mp3', time_base: '1/14112000', language: 'eng', channel_layout: 'stereo', channels: 2, sample_rate: 44100 },
  chapters: [{ id: 0, start: 0, end: 60, title: 'One' }],
  tags: { file_tag_title: 'Probed Title' }
}

describe('MediaProbeData', () => {
  it('starts with null fields and no chapters', () => {
    const data = new MediaProbeData()
    expect(data.embeddedCoverArt).to.equal(null)
    expect(data.format).to.equal(null)
    expect(data.audioStream).to.equal(null)
    expect(data.chapters).to.deep.equal([])
    expect(data.audioMetaTags).to.equal(null)
    expect(data.trackNumber).to.equal(null)
    expect(data.discTotal).to.equal(null)
  })

  it('construct copies known keys, ignores unknown keys and wraps audioMetaTags', () => {
    const data = new MediaProbeData({ format: 'flac', duration: 10, unknownKey: 'x', audioMetaTags: { tagTitle: 'T' }, trackNumber: 3 })
    expect(data.format).to.equal('flac')
    expect(data.duration).to.equal(10)
    expect(data.trackNumber).to.equal(3)
    expect(data).to.not.have.property('unknownKey')
    expect(data.audioMetaTags).to.be.instanceOf(AudioMetaTags)
    expect(data.audioMetaTags.tagTitle).to.equal('T')
  })

  it('construct keeps a falsy audioMetaTags value as given', () => {
    expect(new MediaProbeData({ audioMetaTags: null }).audioMetaTags).to.equal(null)
  })

  it('setData reads the audio stream and treats a video stream codec as embedded cover art', () => {
    const data = new MediaProbeData()
    data.setData(parsed)
    expect(data.embeddedCoverArt).to.equal('mjpeg')
    expect(data.videoStream).to.equal(null)
    expect(data.format).to.equal(parsed.format)
    expect(data.duration).to.equal(120.5)
    expect(data.size).to.equal(4096)
    expect(data.audioStream).to.equal(parsed.audio_stream)
    expect(data.bitRate).to.equal(128000)
    expect(data.codec).to.equal('mp3')
    expect(data.timeBase).to.equal('1/14112000')
    expect(data.language).to.equal('eng')
    expect(data.channelLayout).to.equal('stereo')
    expect(data.channels).to.equal(2)
    expect(data.sampleRate).to.equal(44100)
    expect(data.chapters).to.deep.equal(parsed.chapters)
    expect(data.audioMetaTags).to.be.instanceOf(AudioMetaTags)
    expect(data.audioMetaTags.tagTitle).to.equal('Probed Title')
  })

  it('setData falls back to the file bit rate, an empty chapter list and a video stream without a codec', () => {
    const videoStream = { codec: null, width: 100 }
    const data = new MediaProbeData()
    data.setData({ ...parsed, audio_stream: { ...parsed.audio_stream, bit_rate: 0 }, video_stream: videoStream, chapters: undefined })
    expect(data.bitRate).to.equal(64000)
    expect(data.chapters).to.deep.equal([])
    expect(data.embeddedCoverArt).to.equal(null)
    expect(data.videoStream).to.equal(videoStream)

    const noVideo = new MediaProbeData()
    noVideo.setData({ ...parsed, video_stream: undefined })
    expect(noVideo.embeddedCoverArt).to.equal(null)
    expect(noVideo.videoStream).to.equal(null)
  })

  it('setData throws a TypeError when there is no audio stream', () => {
    const data = new MediaProbeData()
    expect(() => data.setData({ ...parsed, audio_stream: null })).to.throw(TypeError)
  })
})
