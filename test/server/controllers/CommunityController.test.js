const { expect } = require('chai')
const sinon = require('sinon')

const CommunityController = require('../../../server/controllers/CommunityController')
const communityStats = require('../../../server/utils/queries/communityStats')

describe('CommunityController', () => {
  afterEach(() => {
    sinon.restore()
    delete global.ServerSettings
  })

  it('returns 403 when community stats are disabled', async () => {
    global.ServerSettings = { enableCommunityListeningStats: false }
    const res = { sendStatus: sinon.spy(), json: sinon.spy() }
    await CommunityController.getLibraryStats({ library: { id: 'library' }, user: {} }, res)
    expect(res.sendStatus.calledOnceWith(403)).to.be.true
    expect(res.json.called).to.be.false
  })

  it('returns the library stats response shape when enabled', async () => {
    global.ServerSettings = { enableCommunityListeningStats: true }
    const payload = { totalListeningTime: 10, listenerCount: 1, mostListenedBooks: [], mostActiveListeners: [], topAuthors: [] }
    sinon.stub(communityStats, 'getLibraryStats').resolves(payload)
    const res = { sendStatus: sinon.spy(), json: sinon.spy() }
    await CommunityController.getLibraryStats({ library: { id: 'library' }, user: {} }, res)
    expect(res.json.calledOnceWith(payload)).to.be.true
  })
})
