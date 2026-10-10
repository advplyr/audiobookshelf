const { expect } = require('chai')
const AudioFile = require('../../../server/objects/files/AudioFile')
const AudioMetaTags = require('../../../server/objects/metadata/AudioMetaTags')
const FileMetadata = require('../../../server/objects/metadata/FileMetadata')

const metadata = { filename: 'a.mp3', ext: '.mp3', path: '/x/a.mp3', relPath: 'a.mp3', size: 10, mtimeMs: 1, ctimeMs: 2, birthtimeMs: 3 }

function audioJSON(overrides = {}) {
  return {
    index: 1,
    ino: '123',
    metadata,
    addedAt: 100,
    updatedAt: 200,
    trackNumFromMeta: 1,
    discNumFromMeta: null,
    trackNumFromFilename: 1,
    discNumFromFilename: null,
    manuallyVerified: false,
    exclude: false,
    error: null,
    format: 'MP2/3 (MPEG audio layer 2/3)',
    duration: 60,
    bitRate: 128000,
    language: null,
    codec: 'mp3',
    timeBase: '1/14112000',
    channels: 2,
    channelLayout: 'stereo',
    chapters: [{ id: 0, start: 0, end: 30, title: 'One' }],
    embeddedCoverArt: null,
    metaTags: { tagTitle: 'T' },
    ...overrides
  }
}

describe('AudioFile', () => {
  it('preserves undefined fields from partial persisted JSON', () => {
    const file = new AudioFile({})
    expect(file.index).to.equal(undefined)
    expect(file.chapters).to.equal(undefined)
    expect(file.metadata.filename).to.equal(undefined)
    expect(file.toJSON()).to.have.property('index', undefined)
    expect(() => file.syncChapters([])).to.throw(TypeError)
  })

  it('constructs from json and serializes with mimeType and trimmed metaTags', () => {
    const file = new AudioFile(audioJSON())
    expect(file.metadata).to.be.instanceOf(FileMetadata)
    expect(file.metaTags).to.be.instanceOf(AudioMetaTags)
    expect(file.toJSON()).to.deep.equal({ ...audioJSON(), mimeType: 'audio/mpeg' })
  })

  it('serializes empty metaTags as an empty object and coerces flags', () => {
    const file = new AudioFile(audioJSON({ metaTags: undefined, manuallyVerified: 1, exclude: 0, error: '' }))
    const json = file.toJSON()
    expect(json.metaTags).to.deep.equal({})
    expect(json.manuallyVerified).to.equal(true)
    expect(json.exclude).to.equal(false)
    expect(json.error).to.equal(null)
  })

  it('supports the old cdNumFromFilename key', () => {
    expect(new AudioFile(audioJSON({ discNumFromFilename: 9, cdNumFromFilename: 2 })).discNumFromFilename).to.equal(2)
    expect(new AudioFile(audioJSON({ discNumFromFilename: 9 })).discNumFromFilename).to.equal(9)
  })

  it('derives mimeType from the extension and defaults to mp3', () => {
    const mime = (ext) => new AudioFile(audioJSON({ metadata: { ...metadata, ext } })).mimeType
    expect(mime('.m4b')).to.equal('audio/mp4')
    expect(mime('.FLAC')).to.equal('audio/flac')
    expect(mime('.zzz')).to.equal('audio/mpeg')
  })

  it('clone copies data into an independent instance', () => {
    const file = new AudioFile(audioJSON())
    const copy = file.clone()
    expect(copy).to.not.equal(file)
    expect(copy.toJSON()).to.deep.equal(file.toJSON())
    expect(copy.metadata).to.not.equal(file.metadata)
  })

  describe('setDataFromProbe', () => {
    const tags = new AudioMetaTags({ tagTitle: 'Probed' })
    const probeData = {
      format: 'MP2/3',
      duration: 90,
      bitRate: 0,
      language: 'eng',
      codec: undefined,
      timeBase: '1/1',
      channels: 1,
      channelLayout: 'mono',
      chapters: undefined,
      audioMetaTags: tags,
      embeddedCoverArt: 'mjpeg'
    }

    it('clones a FileMetadata and applies defaults for missing probe values', () => {
      const libraryMetadata = new FileMetadata(metadata)
      const file = new AudioFile()
      file.setDataFromProbe({ ino: '55', metadata: libraryMetadata }, probeData)
      expect(file.ino).to.equal('55')
      expect(file.metadata).to.not.equal(libraryMetadata)
      expect(file.metadata.toJSON()).to.deep.equal(metadata)
      expect(file.duration).to.equal(90)
      expect(file.bitRate).to.equal(null)
      expect(file.codec).to.equal(null)
      expect(file.chapters).to.deep.equal([])
      expect(file.metaTags).to.equal(tags)
      expect(file.embeddedCoverArt).to.equal('mjpeg')
      expect(file.addedAt).to.be.a('number')
    })

    it('wraps plain metadata objects and defaults a missing ino to null', () => {
      const file = new AudioFile()
      file.setDataFromProbe({ metadata }, probeData)
      expect(file.ino).to.equal(null)
      expect(file.metadata).to.be.instanceOf(FileMetadata)
      expect(file.metadata.filename).to.equal('a.mp3')
    })
  })

  describe('syncChapters', () => {
    it('replaces chapters when the count differs and copies the chapter objects', () => {
      const file = new AudioFile(audioJSON())
      const updated = [
        { id: 0, start: 0, end: 10, title: 'A' },
        { id: 1, start: 10, end: 20, title: 'B' }
      ]
      expect(file.syncChapters(updated)).to.equal(true)
      expect(file.chapters).to.deep.equal(updated)
      expect(file.chapters[0]).to.not.equal(updated[0])
    })

    it('clears chapters when given an empty list', () => {
      const file = new AudioFile(audioJSON())
      expect(file.syncChapters([])).to.equal(true)
      expect(file.chapters).to.deep.equal([])
      expect(file.syncChapters([])).to.equal(false)
    })

    it('only reports a change when the same count has different content', () => {
      const file = new AudioFile(audioJSON())
      expect(file.syncChapters([{ id: 0, start: 0, end: 30, title: 'One' }])).to.equal(false)
      expect(file.syncChapters([{ id: 0, start: 0, end: 30, title: 'Renamed' }])).to.equal(true)
      expect(file.chapters[0].title).to.equal('Renamed')
    })
  })

  describe('updateFromScan', () => {
    it('returns false when nothing meaningful changed', () => {
      const file = new AudioFile(audioJSON())
      const scanned = new AudioFile(audioJSON({ addedAt: 999, updatedAt: 999, manuallyVerified: true }))
      expect(file.updateFromScan(scanned)).to.equal(false)
      expect(file.addedAt).to.equal(100)
      expect(file.manuallyVerified).to.equal(false)
    })

    it('copies changed scalar values', () => {
      const file = new AudioFile(audioJSON())
      expect(file.updateFromScan(new AudioFile(audioJSON({ duration: 61, bitRate: 64000 })))).to.equal(true)
      expect(file.duration).to.equal(61)
      expect(file.bitRate).to.equal(64000)
    })

    it('updates metadata, metaTags and chapters', () => {
      const file = new AudioFile(audioJSON())
      expect(file.updateFromScan(new AudioFile(audioJSON({ metadata: { ...metadata, size: 99 } })))).to.equal(true)
      expect(file.metadata.size).to.equal(99)

      expect(file.updateFromScan(new AudioFile(audioJSON({ metadata: { ...metadata, size: 99 }, metaTags: { tagTitle: 'New' } })))).to.equal(true)
      expect(file.metaTags.tagTitle).to.equal('New')

      expect(
        file.updateFromScan(
          new AudioFile(audioJSON({ metadata: { ...metadata, size: 99 }, metaTags: { tagTitle: 'New' }, chapters: [] }))
        )
      ).to.equal(true)
      expect(file.chapters).to.deep.equal([])
    })
  })
})
