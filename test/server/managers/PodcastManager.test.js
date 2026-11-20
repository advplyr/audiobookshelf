const { expect } = require('chai')
const sinon = require('sinon')
const Logger = require('../../../server/Logger')
const PodcastManager = require('../../../server/managers/PodcastManager')
const PodcastEpisodeDownload = require('../../../server/objects/PodcastEpisodeDownload')

function createEpisode(title, url) {
  return {
    title,
    enclosure: { url, type: 'audio/mpeg' }
  }
}

describe('PodcastManager', () => {
  afterEach(() => {
    sinon.restore()
  })

  describe('downloadPodcastEpisodes', () => {
    it('skips a malformed episode and prepares the next valid episode', async () => {
      const manager = new PodcastManager()
      const startDownloadStub = sinon.stub(manager, 'startPodcastEpisodeDownload').resolves()
      const loggerErrorStub = sinon.stub(Logger, 'error')
      const libraryItem = {
        id: 'podcast-item',
        libraryId: 'podcast-library',
        path: '/podcasts/example',
        media: { title: 'Example Podcast' }
      }
      const episodes = [createEpisode('Malformed Episode', 'https://example.com/episode%ZZ.mp3'), createEpisode('Valid Episode', 'https://example.com/valid episode.mp3')]

      const result = await manager.downloadPodcastEpisodes(libraryItem, episodes, false)

      expect(result).to.be.undefined
      expect(loggerErrorStub.calledOnce).to.be.true
      expect(loggerErrorStub.firstCall.args[0]).to.include('Malformed Episode')
      expect(loggerErrorStub.firstCall.args[1]).to.be.instanceOf(URIError)
      expect(startDownloadStub.calledOnce).to.be.true
      expect(startDownloadStub.firstCall.args[0].episodeTitle).to.equal('Valid Episode')
      expect(startDownloadStub.firstCall.args[0].url).to.equal('https://example.com/valid%20episode.mp3')
    })

    it('propagates unexpected errors from preparing an episode download', async () => {
      const manager = new PodcastManager()
      const unexpectedError = new Error('Unexpected setData failure')
      sinon.stub(PodcastEpisodeDownload.prototype, 'setData').throws(unexpectedError)
      const loggerErrorStub = sinon.stub(Logger, 'error')
      const libraryItem = { libraryId: 'podcast-library' }

      let caughtError
      try {
        await manager.downloadPodcastEpisodes(libraryItem, [createEpisode('Episode', 'https://example.com/episode.mp3')], false)
      } catch (error) {
        caughtError = error
      }

      expect(caughtError).to.equal(unexpectedError)
      expect(loggerErrorStub.notCalled).to.be.true
    })
  })
})
