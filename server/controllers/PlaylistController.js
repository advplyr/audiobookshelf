const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')

const Playlist = require('../objects/Playlist')

class PlaylistController {
  constructor() { }

  // POST: api/playlists
  async create(req, res) {
    const newPlaylist = new Playlist()
    req.body.userId = req.user.id
    const success = newPlaylist.setData(req.body)
    if (!success) {
      return res.status(400).send('Invalid playlist request data')
    }
    const jsonExpanded = newPlaylist.toJSONExpanded(Database.libraryItems)
    await Database.createPlaylist(newPlaylist)
    SocketAuthority.clientEmitter(newPlaylist.userId, 'playlist_added', jsonExpanded)
    res.json(jsonExpanded)
  }

  // GET: api/playlists
  async findAllForUser(req, res) {
    const playlistsForUser = await Database.models.playlist.getPlaylistsForUserAndLibrary(req.user.id)
    res.json({
      playlists: playlistsForUser.map(p => p.toJSONExpanded(Database.libraryItems))
    })
  }

  // GET: api/playlists/:id
  findOne(req, res) {
    res.json(req.playlist.toJSONExpanded(Database.libraryItems))
  }

  // PATCH: api/playlists/:id
  async update(req, res) {
    const playlist = req.playlist
    let wasUpdated = playlist.update(req.body)
    const jsonExpanded = playlist.toJSONExpanded(Database.libraryItems)
    if (wasUpdated) {
      await Database.updatePlaylist(playlist)
      SocketAuthority.clientEmitter(playlist.userId, 'playlist_updated', jsonExpanded)
    }
    res.json(jsonExpanded)
  }

  // DELETE: api/playlists/:id
  async delete(req, res) {
    const playlist = req.playlist
    const jsonExpanded = playlist.toJSONExpanded(Database.libraryItems)
    await Database.removePlaylist(playlist.id)
    SocketAuthority.clientEmitter(playlist.userId, 'playlist_removed', jsonExpanded)
    res.sendStatus(200)
  }

  // POST: api/playlists/:id/item
  async addItem(req, res) {
    const playlist = req.playlist
    const itemToAdd = req.body

    if (!itemToAdd.libraryItemId) {
      return res.status(400).send('Request body has no libraryItemId')
    }

    const libraryItem = Database.libraryItems.find(li => li.id === itemToAdd.libraryItemId)
    if (!libraryItem) {
      return res.status(400).send('Library item not found')
    }
    if (libraryItem.libraryId !== playlist.libraryId) {
      return res.status(400).send('Library item in different library')
    }
    if (playlist.containsItem(itemToAdd)) {
      return res.status(400).send('Item already in playlist')
    }
    if ((itemToAdd.episodeId && !libraryItem.isPodcast) || (libraryItem.isPodcast && !itemToAdd.episodeId)) {
      return res.status(400).send('Invalid item to add for this library type')
    }
    if (itemToAdd.episodeId && !libraryItem.media.checkHasEpisode(itemToAdd.episodeId)) {
      return res.status(400).send('Episode not found in library item')
    }

    playlist.addItem(itemToAdd.libraryItemId, itemToAdd.episodeId)

    const playlistMediaItem = {
      playlistId: playlist.id,
      mediaItemId: itemToAdd.episodeId || libraryItem.media.id,
      mediaItemType: itemToAdd.episodeId ? 'podcastEpisode' : 'book',
      order: playlist.items.length
    }

    const jsonExpanded = playlist.toJSONExpanded(Database.libraryItems)
    await Database.createPlaylistMediaItem(playlistMediaItem)
    SocketAuthority.clientEmitter(playlist.userId, 'playlist_updated', jsonExpanded)
    res.json(jsonExpanded)
  }

  // DELETE: api/playlists/:id/item/:libraryItemId/:episodeId?
  async removeItem(req, res) {
    const playlist = req.playlist
    const itemToRemove = {
      libraryItemId: req.params.libraryItemId,
      episodeId: req.params.episodeId || null
    }
    if (!playlist.containsItem(itemToRemove)) {
      return res.sendStatus(404)
    }

    playlist.removeItem(itemToRemove.libraryItemId, itemToRemove.episodeId)

    const jsonExpanded = playlist.toJSONExpanded(Database.libraryItems)

    // Playlist is removed when there are no items
    if (!playlist.items.length) {
      Logger.info(`[PlaylistController] Playlist "${playlist.name}" has no more items - removing it`)
      await Database.removePlaylist(playlist.id)
      SocketAuthority.clientEmitter(playlist.userId, 'playlist_removed', jsonExpanded)
    } else {
      await Database.updatePlaylist(playlist)
      SocketAuthority.clientEmitter(playlist.userId, 'playlist_updated', jsonExpanded)
    }

    res.json(jsonExpanded)
  }

  // POST: api/playlists/:id/batch/add
  async addBatch(req, res) {
    const playlist = req.playlist
    if (!req.body.items || !req.body.items.length) {
      return res.status(500).send('Invalid request body')
    }
    const itemsToAdd = req.body.items
    let hasUpdated = false

    let order = playlist.items.length
    const playlistMediaItems = []
    for (const item of itemsToAdd) {
      if (!item.libraryItemId) {
        return res.status(400).send('Item does not have libraryItemId')
      }

      const libraryItem = Database.getLibraryItem(item.libraryItemId)
      if (!libraryItem) {
        return res.status(400).send('Item not found with id ' + item.libraryItemId)
      }

      if (!playlist.containsItem(item)) {
        playlistMediaItems.push({
          playlistId: playlist.id,
          mediaItemId: item.episodeId || libraryItem.media.id, // podcastEpisodeId or bookId
          mediaItemType: item.episodeId ? 'podcastEpisode' : 'book',
          order: order++
        })
        playlist.addItem(item.libraryItemId, item.episodeId)
        hasUpdated = true
      }
    }

    const jsonExpanded = playlist.toJSONExpanded(Database.libraryItems)
    if (hasUpdated) {
      await Database.createBulkPlaylistMediaItems(playlistMediaItems)
      SocketAuthority.clientEmitter(playlist.userId, 'playlist_updated', jsonExpanded)
    }
    res.json(jsonExpanded)
  }

  // POST: api/playlists/:id/batch/remove
  async removeBatch(req, res) {
    const playlist = req.playlist
    if (!req.body.items || !req.body.items.length) {
      return res.status(500).send('Invalid request body')
    }
    const itemsToRemove = req.body.items
    let hasUpdated = false
    for (const item of itemsToRemove) {
      if (!item.libraryItemId) {
        return res.status(400).send('Item does not have libraryItemId')
      }

      if (playlist.containsItem(item)) {
        playlist.removeItem(item.libraryItemId, item.episodeId)
        hasUpdated = true
      }
    }

    const jsonExpanded = playlist.toJSONExpanded(Database.libraryItems)
    if (hasUpdated) {
      // Playlist is removed when there are no items
      if (!playlist.items.length) {
        Logger.info(`[PlaylistController] Playlist "${playlist.name}" has no more items - removing it`)
        await Database.removePlaylist(playlist.id)
        SocketAuthority.clientEmitter(playlist.userId, 'playlist_removed', jsonExpanded)
      } else {
        await Database.updatePlaylist(playlist)
        SocketAuthority.clientEmitter(playlist.userId, 'playlist_updated', jsonExpanded)
      }
    }
    res.json(jsonExpanded)
  }

  // POST: api/playlists/collection/:collectionId
  async createFromCollection(req, res) {
    let collection = await Database.models.collection.getById(req.params.collectionId)
    if (!collection) {
      return res.status(404).send('Collection not found')
    }
    // Expand collection to get library items
    collection = collection.toJSONExpanded(Database.libraryItems)

    // Filter out library items not accessible to user
    const libraryItems = collection.books.filter(item => req.user.checkCanAccessLibraryItem(item))

    if (!libraryItems.length) {
      return res.status(400).send('Collection has no books accessible to user')
    }

    const newPlaylist = new Playlist()

    const newPlaylistData = {
      userId: req.user.id,
      libraryId: collection.libraryId,
      name: collection.name,
      description: collection.description || null,
      items: libraryItems.map(li => ({ libraryItemId: li.id }))
    }
    newPlaylist.setData(newPlaylistData)

    const jsonExpanded = newPlaylist.toJSONExpanded(Database.libraryItems)
    await Database.createPlaylist(newPlaylist)
    SocketAuthority.clientEmitter(newPlaylist.userId, 'playlist_added', jsonExpanded)
    res.json(jsonExpanded)
  }

  async middleware(req, res, next) {
    if (req.params.id) {
      const playlist = await Database.models.playlist.getById(req.params.id)
      if (!playlist) {
        return res.status(404).send('Playlist not found')
      }
      if (playlist.userId !== req.user.id) {
        Logger.warn(`[PlaylistController] Playlist ${req.params.id} requested by user ${req.user.id} that is not the owner`)
        return res.sendStatus(403)
      }
      req.playlist = playlist
    }

    next()
  }
}
module.exports = new PlaylistController()