const { expect } = require('chai')

const PlaybackSession = require('../../../server/objects/PlaybackSession')

describe('PlaybackSession', () => {
  it('computes progress from a single currentTime and duration domain', () => {
    const session = new PlaybackSession({
      id: 'session-1',
      userId: 'user-1',
      libraryItemId: 'item-1',
      mediaType: 'book',
      duration: 10,
      currentTime: 6,
      startedAt: Date.now(),
      updatedAt: Date.now(),
      deviceInfo: {}
    })

    expect(session.progress).to.equal(0.6)
    expect(session.mediaProgressObject).to.include({
      duration: 10,
      currentTime: 6,
      progress: 0.6
    })
  })
})
