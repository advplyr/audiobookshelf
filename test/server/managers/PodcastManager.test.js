const { expect } = require('chai')
const sinon = require('sinon')

const PodcastManager = require('../../../server/managers/PodcastManager')
const Logger = require('../../../server/Logger')
const SocketAuthority = require('../../../server/SocketAuthority')
const NotificationManager = require('../../../server/managers/NotificationManager')

describe('PodcastManager episode checks', () => {
  let podcastManager
  let libraryItem
  let lastEpisodeCheck

  beforeEach(() => {
    global.MaxFailedEpisodeChecks = 5
    podcastManager = new PodcastManager()
    lastEpisodeCheck = new Date('2026-01-01T00:00:00.000Z')
    libraryItem = {
      id: 'podcast-item-id',
      media: {
        title: 'Test Podcast',
        feedURL: 'https://example.com/feed.xml',
        lastEpisodeCheck,
        maxNewEpisodesToDownload: 3,
        autoDownloadEpisodes: true,
        getLatestEpisodePublishedAt: sinon.stub().returns(0),
        save: sinon.stub().resolves()
      },
      changed: sinon.spy(),
      save: sinon.stub().resolves()
    }

    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'warn')
    sinon.stub(Logger, 'error')
    sinon.stub(Logger, 'debug')
    sinon.stub(SocketAuthority, 'libraryItemEmitter')
    sinon.stub(NotificationManager, 'onRSSFeedFailed').resolves()
  })

  afterEach(() => {
    sinon.restore()
  })

  it('does not update the last check after a failed manual check', async () => {
    sinon.stub(podcastManager, 'checkPodcastForNewEpisodes').resolves(null)

    const result = await podcastManager.checkAndDownloadNewEpisodes(libraryItem, 3)

    expect(result).to.equal(null)
    expect(libraryItem.media.lastEpisodeCheck).to.equal(lastEpisodeCheck)
    expect(libraryItem.media.save.called).to.be.false
    expect(libraryItem.save.called).to.be.false
    expect(SocketAuthority.libraryItemEmitter.called).to.be.false
  })

  it('updates the last check after a successful manual check with no new episodes', async () => {
    sinon.stub(podcastManager, 'checkPodcastForNewEpisodes').resolves([])

    const result = await podcastManager.checkAndDownloadNewEpisodes(libraryItem, 3)

    expect(result).to.deep.equal([])
    expect(libraryItem.media.lastEpisodeCheck).to.be.greaterThan(lastEpisodeCheck)
    expect(libraryItem.media.save.calledOnce).to.be.true
    expect(libraryItem.save.calledOnce).to.be.true
  })

  it('does not update the last check after a failed scheduled check', async () => {
    sinon.stub(podcastManager, 'checkPodcastForNewEpisodes').resolves(null)

    await podcastManager.runEpisodeCheck(libraryItem)

    expect(libraryItem.media.lastEpisodeCheck).to.equal(lastEpisodeCheck)
    expect(NotificationManager.onRSSFeedFailed.calledOnce).to.be.true
  })
})
