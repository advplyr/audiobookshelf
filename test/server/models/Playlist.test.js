const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')
const Database = require('../../../server/Database')
const SocketAuthority = require('../../../server/SocketAuthority')

describe('Playlist model', () => {
  let previousSequelize
  let previousSettings
  let library
  let user
  let firstBook
  let secondBook
  let firstItem
  let episode
  beforeEach(async () => {
    previousSequelize = Database.sequelize
    previousSettings = global.ServerSettings
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()
    sinon.stub(SocketAuthority, 'clientEmitter')
    library = await Database.libraryModel.create({ name: 'Library', mediaType: 'book' })
    user = await Database.userModel.create({ username: 'test' })
    firstBook = await Database.bookModel.create({ title: 'First', audioFiles: [], chapters: [], tags: [], narrators: [], genres: [] })
    secondBook = await Database.bookModel.create({ title: 'Second', audioFiles: [], chapters: [], tags: [], narrators: [], genres: [] })
    firstItem = await Database.libraryItemModel.create({ libraryId: library.id, mediaType: 'book', mediaId: firstBook.id, libraryFiles: [] })
    await Database.libraryItemModel.create({ libraryId: library.id, mediaType: 'book', mediaId: secondBook.id, libraryFiles: [] })
    const podcast = await Database.podcastModel.create({ title: 'Podcast', tags: [], genres: [] })
    await Database.libraryItemModel.create({ libraryId: library.id, mediaType: 'podcast', mediaId: podcast.id, libraryFiles: [] })
    episode = await Database.podcastEpisodeModel.create({ podcastId: podcast.id, title: 'Episode', audioFile: { ino: 'file', metadata: { filename: 'episode.mp3', size: 123 }, duration: 60 }, chapters: [] })
  })
  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.close()
    Database.sequelize = previousSequelize
    global.ServerSettings = previousSettings
  })

  async function playlist(name, mediaItems) {
    const row = await Database.playlistModel.create({ name, userId: user.id, libraryId: library.id })
    for (const [index, media] of mediaItems.entries()) {
      await Database.playlistMediaItemModel.create({ playlistId: row.id, mediaItemId: media.id, mediaItemType: media === episode ? 'podcastEpisode' : 'book', order: index + 1 })
    }
    return row
  }

  it('sorts playlists by name and expands ordered book and podcast entries', async () => {
    await playlist('Zed', [secondBook])
    const mixed = await playlist('Alpha', [firstBook, episode])
    const json = await Database.playlistModel.getOldPlaylistsForUserAndLibrary(user.id, library.id)
    expect(json.map((row) => row.name)).to.deep.equal(['Alpha', 'Zed'])
    expect(json[0].items[0].libraryItemId).to.equal(firstItem.id)
    expect(json[0].items[0].libraryItem.media.metadata.title).to.equal('First')
    expect(json[0].items[1].episodeId).to.equal(episode.id)
    expect(json[0].items[1].episode.audioTrack.contentUrl).to.include('/file/file')
    expect(json[0].items[1].libraryItem.media.metadata.title).to.equal('Podcast')
    expect(await Database.playlistModel.getNumPlaylistsForUserAndLibrary(user.id, library.id)).to.equal(2)
    expect(await Database.playlistModel.getOldPlaylistsForUserAndLibrary(null, null)).to.deep.equal([])
    const rows = await Database.playlistModel.findAll({ where: { id: mixed.id }, include: { model: Database.playlistMediaItemModel, include: [Database.bookModel, Database.podcastEpisodeModel] } })
    expect(rows[0].playlistMediaItems[0].mediaItem.id).to.equal(firstBook.id)
    expect(rows[0].playlistMediaItems[0].dataValues).not.to.have.property('book')
  })

  it('deduplicates owning playlists and reorders remaining media entries', async () => {
    const row = await playlist('Playlist', [firstBook, secondBook, episode])
    const matching = await Database.playlistModel.getPlaylistsForMediaItemIds([firstBook.id, secondBook.id])
    expect(matching).to.have.length(1)
    expect(matching[0].playlistMediaItems.map((item) => item.mediaItem.id)).to.deep.equal([firstBook.id, secondBook.id, episode.id])
    await Database.playlistModel.removeMediaItemsFromPlaylists([firstBook.id])
    const remaining = await Database.playlistMediaItemModel.findAll({ where: { playlistId: row.id }, order: [['order', 'ASC']] })
    expect(remaining.map((item) => item.mediaItemId)).to.deep.equal([secondBook.id, episode.id])
    expect(remaining.map((item) => item.order)).to.deep.equal([1, 2])
    expect(SocketAuthority.clientEmitter.calledWith(user.id, 'playlist_updated')).to.equal(true)
    expect(await Database.playlistModel.findByPk(row.id)).not.to.equal(null)
  })

  it('removes empty playlists and preserves unloaded-item errors and membership checks', async () => {
    const row = await playlist('Playlist', [firstBook])
    expect(() => row.checkHasMediaItem(firstItem.id)).to.throw('playlistMediaItems are required')
    expect(() => row.toOldJSONExpanded()).to.throw('playlistMediaItems are required')
    row.playlistMediaItems = await row.getMediaItemsExpandedWithLibraryItem()
    expect(row.checkHasMediaItem(firstItem.id)).to.equal(true)
    expect(row.checkHasMediaItem('missing', episode.id)).to.equal(false)
    await Database.playlistModel.removeMediaItemsFromPlaylists([firstBook.id])
    expect(await Database.playlistModel.findByPk(row.id)).to.equal(null)
    expect(SocketAuthority.clientEmitter.calledWith(user.id, 'playlist_removed')).to.equal(true)
    expect(await Database.playlistModel.getPlaylistsForMediaItemIds([])).to.deep.equal([])
    expect(await Database.playlistModel.removeMediaItemsFromPlaylists([])).to.equal(undefined)
  })
})
