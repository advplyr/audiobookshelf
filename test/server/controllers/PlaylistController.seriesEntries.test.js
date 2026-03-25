const { expect } = require('chai')
const { Sequelize } = require('sequelize')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const PlaylistController = require('../../../server/controllers/PlaylistController')
const Logger = require('../../../server/Logger')
const SocketAuthority = require('../../../server/SocketAuthority')

describe('PlaylistController - Series Entries', () => {
  let user1, library, library2, series1, series2, book1, book2, libraryItem1, libraryItem2

  beforeEach(async () => {
    global.ServerSettings = {}
    Database.sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
    Database.sequelize.uppercaseFirst = (str) => (str ? `${str[0].toUpperCase()}${str.substr(1)}` : '')
    await Database.buildModels()

    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'error')
    sinon.stub(Logger, 'warn')
    sinon.stub(Logger, 'debug')
    sinon.stub(SocketAuthority, 'clientEmitter')

    // Create test data
    library = await Database.libraryModel.create({ name: 'Test Library', mediaType: 'book' })
    library2 = await Database.libraryModel.create({ name: 'Other Library', mediaType: 'book' })

    user1 = await Database.userModel.create({
      username: 'user1',
      pash: 'hashed_password_1',
      type: 'user',
      isActive: true
    })
    user1.mediaProgresses = []

    series1 = await Database.seriesModel.create({
      name: 'The Expanse',
      nameIgnorePrefix: 'Expanse',
      libraryId: library.id
    })

    series2 = await Database.seriesModel.create({
      name: 'Foundation',
      nameIgnorePrefix: 'Foundation',
      libraryId: library.id
    })

    book1 = await Database.bookModel.create({
      title: 'Book One',
      authorName: 'Author 1',
      audioFiles: [],
      chapters: [],
      tags: [],
      narrators: [],
      genres: []
    })

    libraryItem1 = await Database.libraryItemModel.create({
      path: '/books/book1',
      relPath: 'book1',
      mediaId: book1.id,
      mediaType: 'book',
      libraryId: library.id,
      libraryFiles: []
    })

    book2 = await Database.bookModel.create({
      title: 'Book Two',
      authorName: 'Author 2',
      audioFiles: [],
      chapters: [],
      tags: [],
      narrators: [],
      genres: []
    })

    libraryItem2 = await Database.libraryItemModel.create({
      path: '/books/book2',
      relPath: 'book2',
      mediaId: book2.id,
      mediaType: 'book',
      libraryId: library.id,
      libraryFiles: []
    })
  })

  afterEach(async () => {
    sinon.restore()
    await Database.sequelize.sync({ force: true })
  })

  function makeFakeRes() {
    return {
      sendStatus: sinon.spy(),
      status: sinon.stub().returnsThis(),
      send: sinon.spy(),
      json: sinon.spy()
    }
  }

  describe('create', () => {
    it('should create playlist with items and seriesIds', async () => {
      const fakeReq = {
        user: user1,
        body: {
          libraryId: library.id,
          name: 'My Playlist',
          items: [{ libraryItemId: libraryItem1.id }],
          seriesIds: [series1.id]
        }
      }
      const fakeRes = makeFakeRes()

      await PlaylistController.create(fakeReq, fakeRes)

      expect(fakeRes.json.calledOnce).to.be.true
      const response = fakeRes.json.firstCall.args[0]

      // items should only contain book entries
      expect(response.items).to.have.length(1)
      expect(response.items[0].libraryItemId).to.equal(libraryItem1.id)

      // entries should contain both book and series
      expect(response.entries).to.have.length(2)
      expect(response.entries[0].type).to.equal('libraryItem')
      expect(response.entries[0].libraryItemId).to.equal(libraryItem1.id)
      expect(response.entries[0].order).to.equal(1)
      expect(response.entries[1].type).to.equal('series')
      expect(response.entries[1].seriesId).to.equal(series1.id)
      expect(response.entries[1].seriesName).to.equal('The Expanse')
      expect(response.entries[1].order).to.equal(2)

      // Socket event
      expect(SocketAuthority.clientEmitter.calledOnce).to.be.true
      const [userId, event] = SocketAuthority.clientEmitter.firstCall.args
      expect(userId).to.equal(user1.id)
      expect(event).to.equal('playlist_added')
    })

    it('should create playlist with only seriesIds (no items)', async () => {
      const fakeReq = {
        user: user1,
        body: {
          libraryId: library.id,
          name: 'Series Only Playlist',
          seriesIds: [series1.id, series2.id]
        }
      }
      const fakeRes = makeFakeRes()

      await PlaylistController.create(fakeReq, fakeRes)

      expect(fakeRes.json.calledOnce).to.be.true
      const response = fakeRes.json.firstCall.args[0]

      // items should be empty (no book/episode entries)
      expect(response.items).to.have.length(0)

      // entries should contain both series
      expect(response.entries).to.have.length(2)
      expect(response.entries[0].type).to.equal('series')
      expect(response.entries[0].seriesId).to.equal(series1.id)
      expect(response.entries[1].type).to.equal('series')
      expect(response.entries[1].seriesId).to.equal(series2.id)
    })

    it('should reject seriesIds for podcast playlists', async () => {
      const podcast = await Database.podcastModel.create({ title: 'Test Podcast' })
      const podcastLI = await Database.libraryItemModel.create({
        path: '/podcasts/p1',
        relPath: 'p1',
        mediaId: podcast.id,
        mediaType: 'podcast',
        libraryId: library.id
      })
      const episode = await Database.podcastEpisodeModel.create({
        title: 'Episode 1',
        podcastId: podcast.id
      })

      const fakeReq = {
        user: user1,
        body: {
          libraryId: library.id,
          name: 'Podcast Playlist',
          items: [{ libraryItemId: podcastLI.id, episodeId: episode.id }],
          seriesIds: [series1.id]
        }
      }
      const fakeRes = makeFakeRes()

      await PlaylistController.create(fakeReq, fakeRes)

      expect(fakeRes.status.calledWith(400)).to.be.true
      expect(fakeRes.send.calledWith('Series entries are not valid for podcast playlists')).to.be.true
    })

    it('should reject invalid seriesId', async () => {
      const fakeReq = {
        user: user1,
        body: {
          libraryId: library.id,
          name: 'Bad Playlist',
          seriesIds: ['00000000-0000-0000-0000-000000000000']
        }
      }
      const fakeRes = makeFakeRes()

      await PlaylistController.create(fakeReq, fakeRes)

      expect(fakeRes.status.calledWith(400)).to.be.true
      expect(fakeRes.send.calledWith('Invalid playlist data. Invalid series')).to.be.true
    })

    it('should reject seriesId from different library', async () => {
      const otherSeries = await Database.seriesModel.create({
        name: 'Other Series',
        nameIgnorePrefix: 'Other Series',
        libraryId: library2.id
      })

      const fakeReq = {
        user: user1,
        body: {
          libraryId: library.id,
          name: 'Cross Library',
          seriesIds: [otherSeries.id]
        }
      }
      const fakeRes = makeFakeRes()

      await PlaylistController.create(fakeReq, fakeRes)

      expect(fakeRes.status.calledWith(400)).to.be.true
    })

    it('should reject playlist with no items and no seriesIds', async () => {
      const fakeReq = {
        user: user1,
        body: {
          libraryId: library.id,
          name: 'Empty Playlist'
        }
      }
      const fakeRes = makeFakeRes()

      await PlaylistController.create(fakeReq, fakeRes)

      expect(fakeRes.status.calledWith(400)).to.be.true
    })
  })

  describe('addBatch', () => {
    let playlist

    beforeEach(async () => {
      // Create a playlist with one book
      playlist = await Database.playlistModel.create({
        libraryId: library.id,
        userId: user1.id,
        name: 'Test Playlist'
      })
      await Database.playlistMediaItemModel.create({
        playlistId: playlist.id,
        mediaItemId: book1.id,
        mediaItemType: 'book',
        order: 1
      })
    })

    it('should add series to existing playlist', async () => {
      const fakeReq = {
        user: user1,
        playlist,
        body: {
          seriesIds: [series1.id]
        }
      }
      const fakeRes = makeFakeRes()

      await PlaylistController.addBatch(fakeReq, fakeRes)

      expect(fakeRes.json.calledOnce).to.be.true
      const response = fakeRes.json.firstCall.args[0]

      expect(response.entries).to.have.length(2)
      expect(response.entries[0].type).to.equal('libraryItem')
      expect(response.entries[0].order).to.equal(1)
      expect(response.entries[1].type).to.equal('series')
      expect(response.entries[1].seriesId).to.equal(series1.id)
      expect(response.entries[1].order).to.equal(2)
    })

    it('should skip duplicate series', async () => {
      // Add series first
      await Database.playlistMediaItemModel.create({
        playlistId: playlist.id,
        mediaItemId: series1.id,
        mediaItemType: 'series',
        order: 2
      })

      const fakeReq = {
        user: user1,
        playlist,
        body: {
          seriesIds: [series1.id]
        }
      }
      const fakeRes = makeFakeRes()

      await PlaylistController.addBatch(fakeReq, fakeRes)

      expect(fakeRes.json.calledOnce).to.be.true
      const response = fakeRes.json.firstCall.args[0]

      // Should still have only 2 entries (no duplicate)
      expect(response.entries).to.have.length(2)
      expect(SocketAuthority.clientEmitter.called).to.be.false
    })

    it('should add only series (no items in request)', async () => {
      const fakeReq = {
        user: user1,
        playlist,
        body: {
          seriesIds: [series1.id, series2.id]
        }
      }
      const fakeRes = makeFakeRes()

      await PlaylistController.addBatch(fakeReq, fakeRes)

      expect(fakeRes.json.calledOnce).to.be.true
      const response = fakeRes.json.firstCall.args[0]

      expect(response.entries).to.have.length(3)
      expect(response.entries[1].type).to.equal('series')
      expect(response.entries[2].type).to.equal('series')
    })
  })

  describe('removeSeries', () => {
    let playlist

    beforeEach(async () => {
      playlist = await Database.playlistModel.create({
        libraryId: library.id,
        userId: user1.id,
        name: 'Test Playlist'
      })
      await Database.playlistMediaItemModel.create({
        playlistId: playlist.id,
        mediaItemId: book1.id,
        mediaItemType: 'book',
        order: 1
      })
      await Database.playlistMediaItemModel.create({
        playlistId: playlist.id,
        mediaItemId: series1.id,
        mediaItemType: 'series',
        order: 2
      })
      await Database.playlistMediaItemModel.create({
        playlistId: playlist.id,
        mediaItemId: book2.id,
        mediaItemType: 'book',
        order: 3
      })
    })

    it('should remove series and re-compact orders', async () => {
      const fakeReq = {
        user: user1,
        playlist,
        params: { id: playlist.id, seriesId: series1.id }
      }
      const fakeRes = makeFakeRes()

      await PlaylistController.removeSeries(fakeReq, fakeRes)

      expect(fakeRes.json.calledOnce).to.be.true
      const response = fakeRes.json.firstCall.args[0]

      // Should have 2 entries left (both books)
      expect(response.entries).to.have.length(2)
      expect(response.entries[0].order).to.equal(1)
      expect(response.entries[1].order).to.equal(2)

      // items should still have both books
      expect(response.items).to.have.length(2)

      expect(SocketAuthority.clientEmitter.calledOnce).to.be.true
      expect(SocketAuthority.clientEmitter.firstCall.args[1]).to.equal('playlist_updated')
    })

    it('should return 200 for non-existent series (idempotent)', async () => {
      const fakeReq = {
        user: user1,
        playlist,
        params: { id: playlist.id, seriesId: '00000000-0000-0000-0000-000000000000' }
      }
      const fakeRes = makeFakeRes()

      await PlaylistController.removeSeries(fakeReq, fakeRes)

      expect(fakeRes.json.calledOnce).to.be.true
      const response = fakeRes.json.firstCall.args[0]
      // All 3 entries should remain
      expect(response.entries).to.have.length(3)
    })

    it('should delete playlist when last entry is removed', async () => {
      // Create a playlist with only one series entry
      const soloPlaylist = await Database.playlistModel.create({
        libraryId: library.id,
        userId: user1.id,
        name: 'Solo Series Playlist'
      })
      await Database.playlistMediaItemModel.create({
        playlistId: soloPlaylist.id,
        mediaItemId: series1.id,
        mediaItemType: 'series',
        order: 1
      })

      const fakeReq = {
        user: user1,
        playlist: soloPlaylist,
        params: { id: soloPlaylist.id, seriesId: series1.id }
      }
      const fakeRes = makeFakeRes()

      await PlaylistController.removeSeries(fakeReq, fakeRes)

      expect(fakeRes.json.calledOnce).to.be.true
      expect(SocketAuthority.clientEmitter.calledOnce).to.be.true
      expect(SocketAuthority.clientEmitter.firstCall.args[1]).to.equal('playlist_removed')

      // Playlist should be deleted from DB
      const deletedPlaylist = await Database.playlistModel.findByPk(soloPlaylist.id)
      expect(deletedPlaylist).to.be.null
    })
  })

  describe('findOne', () => {
    it('should include entries in response', async () => {
      const playlist = await Database.playlistModel.create({
        libraryId: library.id,
        userId: user1.id,
        name: 'Test Playlist'
      })
      await Database.playlistMediaItemModel.create({
        playlistId: playlist.id,
        mediaItemId: book1.id,
        mediaItemType: 'book',
        order: 1
      })
      await Database.playlistMediaItemModel.create({
        playlistId: playlist.id,
        mediaItemId: series1.id,
        mediaItemType: 'series',
        order: 2
      })

      const fakeReq = {
        user: user1,
        playlist,
        params: { id: playlist.id }
      }
      const fakeRes = makeFakeRes()

      await PlaylistController.findOne(fakeReq, fakeRes)

      expect(fakeRes.json.calledOnce).to.be.true
      const response = fakeRes.json.firstCall.args[0]

      expect(response.entries).to.be.an('array')
      expect(response.entries).to.have.length(2)
      expect(response.items).to.be.an('array')
      expect(response.items).to.have.length(1)
    })
  })

  describe('backward compatibility', () => {
    it('items array should only contain book/episode entries', async () => {
      const playlist = await Database.playlistModel.create({
        libraryId: library.id,
        userId: user1.id,
        name: 'Mixed Playlist'
      })
      await Database.playlistMediaItemModel.create({
        playlistId: playlist.id,
        mediaItemId: book1.id,
        mediaItemType: 'book',
        order: 1
      })
      await Database.playlistMediaItemModel.create({
        playlistId: playlist.id,
        mediaItemId: series1.id,
        mediaItemType: 'series',
        order: 2
      })
      await Database.playlistMediaItemModel.create({
        playlistId: playlist.id,
        mediaItemId: book2.id,
        mediaItemType: 'book',
        order: 3
      })

      playlist.playlistMediaItems = await playlist.getMediaItemsExpandedWithLibraryItem()
      const json = playlist.toOldJSONExpanded()

      // items should only have books, not series
      expect(json.items).to.have.length(2)
      json.items.forEach((item) => {
        expect(item.libraryItemId).to.be.a('string')
      })

      // entries should have all three
      expect(json.entries).to.have.length(3)
      expect(json.entries.filter((e) => e.type === 'libraryItem')).to.have.length(2)
      expect(json.entries.filter((e) => e.type === 'series')).to.have.length(1)
    })
  })

  describe('removeSeriesFromPlaylists', () => {
    it('should clean up playlist when series is removed', async () => {
      const playlist = await Database.playlistModel.create({
        libraryId: library.id,
        userId: user1.id,
        name: 'Cleanup Test'
      })
      await Database.playlistMediaItemModel.create({
        playlistId: playlist.id,
        mediaItemId: book1.id,
        mediaItemType: 'book',
        order: 1
      })
      await Database.playlistMediaItemModel.create({
        playlistId: playlist.id,
        mediaItemId: series1.id,
        mediaItemType: 'series',
        order: 2
      })

      await Database.playlistModel.removeSeriesFromPlaylists([series1.id])

      // Verify series PMI was removed
      const remainingPmis = await Database.playlistMediaItemModel.findAll({
        where: { playlistId: playlist.id }
      })
      expect(remainingPmis).to.have.length(1)
      expect(remainingPmis[0].mediaItemType).to.equal('book')
      expect(remainingPmis[0].order).to.equal(1)

      // Socket should emit update
      expect(SocketAuthority.clientEmitter.calledOnce).to.be.true
      expect(SocketAuthority.clientEmitter.firstCall.args[1]).to.equal('playlist_updated')
    })

    it('should delete playlist when series removal empties it', async () => {
      const playlist = await Database.playlistModel.create({
        libraryId: library.id,
        userId: user1.id,
        name: 'Series Only'
      })
      await Database.playlistMediaItemModel.create({
        playlistId: playlist.id,
        mediaItemId: series1.id,
        mediaItemType: 'series',
        order: 1
      })

      await Database.playlistModel.removeSeriesFromPlaylists([series1.id])

      const deletedPlaylist = await Database.playlistModel.findByPk(playlist.id)
      expect(deletedPlaylist).to.be.null

      expect(SocketAuthority.clientEmitter.calledOnce).to.be.true
      expect(SocketAuthority.clientEmitter.firstCall.args[1]).to.equal('playlist_removed')
    })
  })
})
