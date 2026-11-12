const { expect } = require('chai')
const sinon = require('sinon')
const scanner = require('../../../server/scanner/AudioFileScanner')
const prober = require('../../../server/utils/prober')
const Logger = require('../../../server/Logger')

describe('AudioFileScanner', () => {
  afterEach(() => sinon.restore())

  it('orders tracks by disc and track tags and updates their indexes in place', () => {
    const first = { discNumFromMeta: 1, trackNumFromMeta: 1, discNumFromFilename: null, trackNumFromFilename: null }
    const second = { ...first, trackNumFromMeta: 2 }
    const third = { ...first, discNumFromMeta: 2 }
    const audioFiles = [third, second, first]

    expect(scanner.runSmartTrackOrder('Book', audioFiles)).to.equal(audioFiles)
    expect(audioFiles).to.deep.equal([{ ...first, index: 1 }, { ...second, index: 2 }, { ...third, index: 3 }])
  })

  it('uses the disc folder and ignores the publication year in the track number', () => {
    const metadata = { path: '/Book/CD02/Book 2020 04.mp3', filename: 'Book 2020 04.mp3' }
    expect(scanner.getTrackAndDiscNumberFromFilename({ title: 'Book', publishedYear: '2020' }, { metadata })).to.deep.equal({
      trackNumber: 4,
      discNumber: 2
    })
  })

  it('skips failed probes while preserving the successful scan result', async () => {
    const probe = sinon.stub(prober, 'probe')
    const errorLog = sinon.stub(Logger, 'error')
    probe.onFirstCall().resolves({ error: 'malformed media' })
    probe.onSecondCall().resolves({ error: undefined })
    probe.onThirdCall().resolves({ audioStream: {}, audioMetaTags: { trackNumber: 3, discNumber: 1 }, channels: '2' })
    const files = ['bad.mp3', 'missing.mp3', 'track.mp3'].map((filename) => ({ metadata: { path: filename, filename } }))

    const result = await scanner.executeMediaFileScans('podcast', { mediaMetadata: { title: 'Podcast' } }, files)
    expect(result).to.have.lengthOf(1)
    expect(result[0]).to.include({ trackNumFromMeta: 3, discNumFromMeta: 1, channels: '2' })
    expect(errorLog.firstCall.args[0]).to.equal('[AudioFileScanner] malformed media : "bad.mp3"')
    expect(errorLog.secondCall.args[0]).to.equal('[AudioFileScanner] Invalid audio file no audio stream')
  })

  it('uses unique audio tags as chapter titles across multiple files', () => {
    const files = [
      { metadata: { filename: 'one.mp3' }, duration: 10, metaTags: { tagTitle: 'First' } },
      { metadata: { filename: 'two.mp3' }, duration: 20, metaTags: { tagTitle: 'Second' } }
    ]

    expect(scanner.getBookChaptersFromAudioFiles('Book', files, { addLog() {} })).to.deep.equal([
      { id: 0, start: 0, end: 10, title: 'First' },
      { id: 1, start: 10, end: 30, title: 'Second' }
    ])
  })
})
