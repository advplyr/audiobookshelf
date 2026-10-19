const { expect } = require('chai')
const sinon = require('sinon')
const Session = require('../../../server/objects/PlaybackSession')
const DeviceInfo = require('../../../server/objects/DeviceInfo')

describe('PlaybackSession object compatibility', () => {
  afterEach(() => sinon.restore())
  it('keeps nullable empty state and clamps playback progress', () => {
    const session = new Session()
    expect(session.progress).to.equal(0)
    expect(session.toJSON()).to.include({ id: null, duration: null, timeListening: null })
    session.duration = 100
    session.currentTime = 150; expect(session.progress).to.equal(1)
    session.currentTime = -5; expect(session.progress).to.equal(0)
    session.currentTime = 25; expect(session.progress).to.equal(0.25)
  })
  it('clears legacy IDs, copies device info and keeps zero listening time as null', () => {
    const device = new DeviceInfo({ id: 'device' })
    const session = new Session({ id: 'session', libraryId: 'lib_old', libraryItemId: 'local_old', episodeId: 'ep_old', deviceInfo: device, timeListening: 0, updatedAt: 100 })
    expect(session.toJSON()).to.include({ libraryId: null, libraryItemId: null, episodeId: null, timeListening: null, updatedAt: 100 })
    expect(session.deviceInfo).not.to.equal(device)
    expect(session.deviceId).to.equal('device')
    expect(session.date).to.be.a('string')
  })
  it('clones metadata/chapters and preserves client track fallback', () => {
    const metadata = { title: 'Original' }, chapters = [{ id: 1, start: 0, end: 10, title: 'One' }]
    const session = new Session({ mediaMetadata: metadata, chapters })
    session.audioTracks = [{ contentUrl: '/track' }, { toJSON: () => ({ title: 'converted' }) }]
    const result = session.toJSONForClient()
    result.mediaMetadata.title = 'Changed'; result.chapters[0].title = 'Changed'
    expect(metadata.title).to.equal('Original'); expect(chapters[0].title).to.equal('One')
    expect(result.audioTracks).to.deep.equal([{ contentUrl: '/track' }, { title: 'converted' }])
    expect(result.coverAspectRatio).to.equal(undefined)
  })
  it('ignores invalid listening time and accumulates numeric string values', () => {
    sinon.stub(Date, 'now').returns(42)
    const session = new Session()
    session.addListeningTime('invalid'); expect(session.updatedAt).to.equal(null)
    session.addListeningTime('1.5'); session.addListeningTime(2)
    expect(session.timeListening).to.equal(3.5)
    expect(session.updatedAt).to.equal(42)
  })
  it('retains JavaScript addition for a legacy string listening total', () => {
    const session = new Session({ timeListening: '5' })
    session.addListeningTime(1)
    expect(session.timeListening).to.equal('51')
  })

})
