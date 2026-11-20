const { expect } = require('chai')
const sinon = require('sinon')

const PodcastController = require('../../../server/controllers/PodcastController')

describe('PodcastController.checkNewEpisodes', () => {
  function makeRequest() {
    return {
      user: { isAdminOrUp: true },
      libraryItem: { media: { feedURL: 'https://example.com/feed.xml' } },
      query: { limit: '3' }
    }
  }

  function makeResponse() {
    return {
      status: sinon.stub().returnsThis(),
      send: sinon.spy(),
      json: sinon.spy(),
      sendStatus: sinon.spy()
    }
  }

  it('returns an error when the RSS feed check fails', async () => {
    const podcastManager = { checkAndDownloadNewEpisodes: sinon.stub().resolves(null) }
    const response = makeResponse()

    await PodcastController.checkNewEpisodes.call({ podcastManager }, makeRequest(), response)

    expect(response.status.calledWith(500)).to.be.true
    expect(response.send.calledWith('Failed to check podcast RSS feed')).to.be.true
    expect(response.json.called).to.be.false
  })

  it('returns an empty episode list after a successful check', async () => {
    const podcastManager = { checkAndDownloadNewEpisodes: sinon.stub().resolves([]) }
    const response = makeResponse()

    await PodcastController.checkNewEpisodes.call({ podcastManager }, makeRequest(), response)

    expect(response.json.calledWith({ episodes: [] })).to.be.true
    expect(response.status.called).to.be.false
  })
})
