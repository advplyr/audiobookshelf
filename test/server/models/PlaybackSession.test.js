const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const Database = require('../../../server/Database')
const DeviceInfo = require('../../../server/objects/DeviceInfo')

describe('PlaybackSession model', () => {
  let previousSequelize
  let previousSettings

  beforeEach(async () => {
    previousSequelize = Database.sequelize
    previousSettings = global.ServerSettings
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
  })

  afterEach(async () => {
    await Database.sequelize.close()
    Database.sequelize = previousSequelize
    global.ServerSettings = previousSettings
  })

  it('round-trips legacy book sessions, devices and explicit timestamps', async () => {
    const user = await Database.userModel.create({ username: 'test' })
    const book = await Database.bookModel.create({ title: 'Book' })
    const device = new DeviceInfo()
    device.setData('127.0.0.1', null, { deviceId: 'test-device' }, '2.0', user.id)
    await Database.deviceModel.createFromOld(device)
    const legacy = {
      id: 'session', userId: user.id, bookId: book.id, libraryItemId: 'legacy-item', deviceInfo: device,
      displayTitle: 'Book', displayAuthor: 'Author', duration: 100, playMethod: 0, mediaPlayer: 'test',
      currentTime: 20, startTime: 10, timeListening: 42, mediaMetadata: { title: 'Book' },
      date: '2020-09-13', dayOfWeek: 'Sunday', startedAt: 1600000000000, updatedAt: 1600000001000
    }
    await Database.playbackSessionModel.createFromOld(legacy)
    const restored = await Database.playbackSessionModel.getById('session')
    expect(restored.toJSON()).to.include({ bookId: book.id, episodeId: null, mediaType: 'book', currentTime: 20, timeListening: 42, startedAt: legacy.startedAt, updatedAt: legacy.updatedAt })
    // Legacy device reconstruction sanitizes absent text fields to empty strings.
    expect(restored.deviceInfo.toJSON()).to.deep.equal({ ...device.toJSON(), deviceName: '', manufacturer: '', model: '', sdkVersion: '' })
    legacy.currentTime = 30
    legacy.updatedAt = 1600000002000
    await Database.playbackSessionModel.updateFromOld(legacy)
    const updated = await Database.playbackSessionModel.getById('session')
    expect(updated.currentTime).to.equal(30)
    expect(updated.startedAt).to.equal(legacy.startedAt)
    expect(updated.updatedAt).to.equal(legacy.updatedAt)
    expect(await Database.playbackSessionModel.count()).to.equal(1)
  })

  it('restores podcast sessions and keeps legacy zero-listening normalization', async () => {
    const podcast = await Database.podcastModel.create({ title: 'Podcast' })
    const episode = await Database.podcastEpisodeModel.create({ title: 'Episode', podcastId: podcast.id })
    await Database.playbackSessionModel.createFromOld({ id: 'podcast-session', episodeId: episode.id, libraryItemId: 'legacy-item', timeListening: 0, startedAt: 1600000000000, updatedAt: 1600000001000 })
    const restored = await Database.playbackSessionModel.getById('podcast-session')
    expect(restored.toJSON()).to.include({ mediaType: 'podcast', episodeId: episode.id, bookId: null, timeListening: null })
    const row = await Database.playbackSessionModel.findByPk('podcast-session', { include: Database.podcastEpisodeModel })
    expect((await row.getMediaItem()).id).to.equal(episode.id)
    expect(row.mediaItem.id).to.equal(episode.id)
    expect(row.dataValues).not.to.have.property('podcastEpisode')
    expect(row.createdAt).to.be.instanceOf(Date)
  })

  it('supports unfiltered and filtered legacy queries and removal', async () => {
    await Database.playbackSessionModel.create({ id: 'one', displayTitle: 'One', extraData: {} })
    await Database.playbackSessionModel.create({ id: 'two', displayTitle: 'Two', extraData: {} })
    expect(await Database.playbackSessionModel.getOldPlaybackSessions()).to.have.length(2)
    expect(await Database.playbackSessionModel.getOldPlaybackSessions({ id: 'one' })).to.have.length(1)
    expect(await Database.playbackSessionModel.getById('missing')).to.equal(null)
    expect(await Database.playbackSessionModel.removeById('one')).to.equal(1)
    expect(await Database.playbackSessionModel.getById('one')).to.equal(null)
  })
})
