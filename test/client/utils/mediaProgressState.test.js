const { expect } = require('chai')
const { getMediaProgressState, mediaProgressStatesChanged } = require('../../../client/utils/mediaProgressState')

describe('mediaProgressState', () => {
  describe('getMediaProgressState', () => {
    it('matches the progress filter classifications', () => {
      expect(getMediaProgressState(null)).to.equal('not-started')
      expect(getMediaProgressState({ currentTime: 0, isFinished: false })).to.equal('not-started')
      expect(getMediaProgressState({ currentTime: 12, isFinished: false })).to.equal('in-progress')
      expect(getMediaProgressState({ ebookProgress: 0.2, isFinished: false })).to.equal('in-progress')
      expect(getMediaProgressState({ currentTime: 12, isFinished: true })).to.equal('finished')
    })
  })

  describe('mediaProgressStatesChanged', () => {
    const progress = (overrides = {}) => ({ libraryItemId: 'book-1', episodeId: null, currentTime: 0, isFinished: false, ...overrides })

    it('detects transitions that change filter membership', () => {
      expect(mediaProgressStatesChanged([], [progress({ currentTime: 12 })])).to.equal(true)
      expect(mediaProgressStatesChanged([progress({ currentTime: 12 })], [progress({ currentTime: 12, isFinished: true })])).to.equal(true)
      expect(mediaProgressStatesChanged([progress({ isFinished: true })], [])).to.equal(true)
    })

    it('ignores playback heartbeats within the same classification', () => {
      expect(mediaProgressStatesChanged([progress({ currentTime: 12 })], [progress({ currentTime: 24 })])).to.equal(false)
    })

    it('ignores adding an empty progress record', () => {
      expect(mediaProgressStatesChanged([], [progress()])).to.equal(false)
    })
  })
})
