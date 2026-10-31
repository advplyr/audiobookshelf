const { expect } = require('chai')
const AudioTrack = require('../../../server/objects/files/AudioTrack')
const AudioFile = require('../../../server/objects/files/AudioFile')

describe('AudioTrack', () => {
  it('starts empty and serializes a null metadata', () => {
    expect(new AudioTrack().toJSON()).to.deep.equal({
      index: null,
      startOffset: null,
      duration: null,
      title: null,
      contentUrl: null,
      mimeType: null,
      codec: null,
      metadata: null
    })
  })

  it('setData builds the track from an audio file', () => {
    const audioFile = new AudioFile({
      index: 3,
      ino: '77',
      metadata: { filename: 'Part 3.mp3', ext: '.mp3', path: '/x/Part 3.mp3', relPath: 'Part 3.mp3', size: 1, mtimeMs: 1, ctimeMs: 2, birthtimeMs: 3 },
      duration: 120.5,
      codec: 'mp3'
    })
    const track = new AudioTrack()
    track.setData('item-1', audioFile, 60)
    expect(track.index).to.equal(3)
    expect(track.startOffset).to.equal(60)
    expect(track.duration).to.equal(120.5)
    expect(track.title).to.equal('Part 3.mp3')
    expect(track.contentUrl).to.equal('/api/items/item-1/file/77')
    expect(track.mimeType).to.equal('audio/mpeg')
    expect(track.codec).to.equal('mp3')
    expect(track.metadata).to.not.equal(audioFile.metadata)
    expect(track.toJSON().metadata).to.deep.equal(audioFile.metadata.toJSON())
  })

  it('setData falls back to an empty title and null codec', () => {
    const audioFile = new AudioFile({
      index: 1,
      ino: '1',
      metadata: { filename: '', ext: '.mp3', path: '/x', relPath: 'x', size: 1, mtimeMs: 1, ctimeMs: 2, birthtimeMs: 3 }
    })
    const track = new AudioTrack()
    track.setData('i', audioFile, 0)
    expect(track.title).to.equal('')
    expect(track.codec).to.equal(null)
  })

  it('setFromStream describes an HLS stream track', () => {
    const track = new AudioTrack()
    track.setFromStream('A Title', 300, '/hls/output.m3u8')
    expect(track.toJSON()).to.deep.equal({
      index: 1,
      startOffset: 0,
      duration: 300,
      title: 'A Title',
      contentUrl: '/hls/output.m3u8',
      mimeType: 'application/vnd.apple.mpegurl',
      codec: null,
      metadata: null
    })
  })
})
