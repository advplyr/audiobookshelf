const { expect } = require('chai')

const { repairMojibake, tryGrabTags } = require('../../../server/utils/prober')

function mojibake(correctText) {
  // Simulates a tagging tool writing UTF-8 bytes into a frame declared as ISO-8859-1,
  // and ffprobe decoding those bytes per the declared (wrong) encoding.
  return Buffer.from(correctText, 'utf8').toString('latin1')
}

describe('prober', () => {
  describe('repairMojibake', () => {
    it('repairs UTF-8 bytes that were misread as Latin-1', () => {
      const correct = 'Je čas metat kamení'
      expect(repairMojibake(mojibake(correct))).to.equal(correct)
    })

    it('leaves plain ASCII text unchanged', () => {
      expect(repairMojibake('The Great Gatsby')).to.equal('The Great Gatsby')
    })

    it('leaves correctly-decoded CJK text unchanged', () => {
      expect(repairMojibake('三体')).to.equal('三体')
      expect(repairMojibake('ノルウェイの森')).to.equal('ノルウェイの森')
    })

    it('leaves correctly-decoded Latin-1-range text unchanged', () => {
      expect(repairMojibake('Café')).to.equal('Café')
      expect(repairMojibake('Müller')).to.equal('Müller')
    })

    it('handles empty and null values', () => {
      expect(repairMojibake('')).to.equal('')
      expect(repairMojibake(null)).to.equal(null)
    })
  })

  describe('tryGrabTags', () => {
    it('returns the repaired value when a matching tag is mojibake', () => {
      const stream = { tags: { title: mojibake('Je čas metat kamení') } }
      expect(tryGrabTags(stream, 'title')).to.equal('Je čas metat kamení')
    })

    it('returns null when there are no tags', () => {
      expect(tryGrabTags({})).to.equal(null)
    })

    it('is case-insensitive on tag keys and falls back through alternatives', () => {
      const stream = { tags: { Album: 'Some Album' } }
      expect(tryGrabTags(stream, 'title', 'album')).to.equal('Some Album')
    })
  })
})
