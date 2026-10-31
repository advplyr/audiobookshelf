const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const Database = require('../../../server/Database')
const DeviceInfo = require('../../../server/objects/DeviceInfo')

describe('devices and playlist media items', () => {
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

  it('round-trips Android devices and updates the existing record', async () => {
    const user = await Database.userModel.create({ username: 'test' })
    const legacy = new DeviceInfo()
    legacy.setData('127.0.0.1', null, { deviceId: 'device', sdkVersion: 34, manufacturer: 'Google', model: 'Pixel' }, '2.0', user.id)
    const created = await Database.deviceModel.createFromOld(legacy)
    const restored = await Database.deviceModel.getOldDeviceByDeviceId('device')
    expect(restored).to.be.instanceOf(DeviceInfo)
    expect(restored.toJSON()).to.deep.equal(legacy.toJSON())
    expect(created.toOldJSON()).to.include({ sdkVersion: '34', browserVersion: null })
    restored.clientVersion = '2.1'
    await Database.deviceModel.updateFromOld(restored)
    expect((await Database.deviceModel.findByPk(created.id)).clientVersion).to.equal('2.1')
    expect(await Database.deviceModel.getOldDeviceByDeviceId('missing')).to.equal(null)
    await user.destroy()
    expect(await Database.deviceModel.count()).to.equal(0)
  })

  it('restores browser versions and tolerates missing extra device fields', async () => {
    const device = await Database.deviceModel.create({ clientName: 'Abs Web', deviceVersion: '120', extraData: {} })
    expect(device.toOldJSON()).to.include({ browserVersion: '120', sdkVersion: null, browserName: null, manufacturer: null })
    expect(device.getOldDevice().browserVersion).to.equal('120')
  })

  it('resolves polymorphic mixins and normalizes both single and array eager-load results', async () => {
    const playlist = await Database.playlistModel.create({ name: 'Playlist' })
    const book = await Database.bookModel.create({ title: 'Book' })
    const podcast = await Database.podcastModel.create({ title: 'Podcast' })
    const episode = await Database.podcastEpisodeModel.create({ title: 'Episode', podcastId: podcast.id })
    const bookLink = await Database.playlistMediaItemModel.create({ playlistId: playlist.id, mediaItemId: book.id, mediaItemType: 'book', order: 1 })
    const episodeLink = await Database.playlistMediaItemModel.create({ playlistId: playlist.id, mediaItemId: episode.id, mediaItemType: 'podcastEpisode', order: 2 })
    expect((await bookLink.getMediaItem()).id).to.equal(book.id)
    expect((await episodeLink.getMediaItem()).id).to.equal(episode.id)
    const include = [{ model: Database.bookModel }, { model: Database.podcastEpisodeModel }]
    const single = await Database.playlistMediaItemModel.findByPk(bookLink.id, { include })
    expect(single.mediaItem.id).to.equal(book.id)
    expect(single).not.to.have.property('book')
    expect(single.dataValues).not.to.have.property('podcastEpisode')
    const links = await Database.playlistMediaItemModel.findAll({ include, order: [['order', 'ASC']] })
    expect(links.map((link) => link.mediaItem.id)).to.deep.equal([book.id, episode.id])
    expect(links[1].dataValues.mediaItem.id).to.equal(episode.id)
    expect(await Database.playlistMediaItemModel.findByPk('missing', { include })).to.equal(null)
    await playlist.destroy()
    expect(await Database.playlistMediaItemModel.count()).to.equal(0)
  })

  it('returns null when the media discriminator is absent', async () => {
    const link = await Database.playlistMediaItemModel.create({ order: 1 })
    expect(await link.getMediaItem()).to.equal(null)
  })

  it('preserves share client fields and normalizes eager-loaded media', async () => {
    const book = await Database.bookModel.create({ title: 'Shared book' })
    const share = await Database.mediaItemShareModel.create({ mediaItemId: book.id, mediaItemType: 'book', slug: 'share', pash: 'test-placeholder', extraData: { private: true }, isDownloadable: true })
    expect(Object.keys(share.toJSONForClient())).to.deep.equal(['id', 'mediaItemId', 'mediaItemType', 'slug', 'expiresAt', 'createdAt', 'updatedAt', 'isDownloadable'])
    expect((await share.getMediaItem()).id).to.equal(book.id)
    const saved = await Database.mediaItemShareModel.findByPk(share.id, { include: Database.bookModel })
    expect(saved.mediaItem.id).to.equal(book.id)
    expect(saved.dataValues.mediaItem.id).to.equal(book.id)
    expect(saved).not.to.have.property('book')
    expect(saved.dataValues).not.to.have.property('book')
    const shares = await Database.mediaItemShareModel.findAll({ include: Database.bookModel })
    expect(shares[0].mediaItem.id).to.equal(book.id)
    expect(await Database.mediaItemShareModel.findByPk('missing')).to.equal(null)
  })

  it('expands book library settings for shares and preserves unsupported media behavior', async () => {
    const library = await Database.libraryModel.create({ name: 'Books', settings: { audiobooksOnly: true } })
    const book = await Database.bookModel.create({ title: 'Shared book' })
    const item = await Database.libraryItemModel.create({ mediaId: book.id, mediaType: 'book', libraryId: library.id, libraryFiles: [] })
    const expanded = await Database.mediaItemShareModel.getMediaItemsLibraryItem(book.id, 'book')
    expect(expanded.id).to.equal(item.id)
    expect(expanded.library.settings).to.deep.equal({ audiobooksOnly: true })
    expect(await Database.mediaItemShareModel.getMediaItemsLibraryItem(book.id, 'podcastEpisode')).to.equal(null)
    expect(await Database.mediaItemShareModel.getMediaItemsLibraryItem('missing', 'book')).to.equal(null)
  })
})
