const chai = require('chai')
const expect = chai.expect
const globals = require('../../../server/utils/globals')
const { AudioMimeType } = require('../../../server/utils/constants')

describe('AudioMimeType', async () => {
  it('should have an entry for every supported audio extension', async () => {
    // AudioFile's mimeType getter falls back to MP3 when there is no entry,
    // so a missing mapping serves the file as audio/mpeg rather than failing
    const missing = globals.SupportedAudioTypes.filter((ext) => !AudioMimeType[ext.toUpperCase()])

    expect(missing, `SupportedAudioTypes with no AudioMimeType entry: ${missing.join(', ')}`).to.be.empty
  })

  it('should not map any extension to a malformed mime type', async () => {
    for (const ext of globals.SupportedAudioTypes) {
      const mimeType = AudioMimeType[ext.toUpperCase()]
      expect(mimeType, `AudioMimeType.${ext.toUpperCase()}`).to.be.a('string')
      expect(mimeType, `AudioMimeType.${ext.toUpperCase()}`).to.match(/^[a-z]+\/[a-z0-9.+-]+$/)
    }
  })

  it('should map mka and mkv to the same mime type', async () => {
    // Both are Matroska. webm is excluded, it has its own registered type
    expect(AudioMimeType.MKA).to.be.a('string')
    expect(AudioMimeType.MKV).to.be.a('string')
    expect(AudioMimeType.MKA).to.equal(AudioMimeType.MKV)
  })
})
