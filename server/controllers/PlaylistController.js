const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')

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
    const jsonExpanded = newPlaylist.toJSONExpanded(this.db.libraryItems)
    await this.db.insertEntity('playlist', newPlaylist)
    SocketAuthority.clientEmitter(newPlaylist.userId, 'playlist_added', jsonExpanded)
    res.json(jsonExpanded)
  }

  // GET: api/playlists
  findAllForUser(req, res) {
    res.json({
      playlists: this.db.playlists.filter(p => p.userId === req.user.id).map(p => p.toJSONExpanded(this.db.libraryItems))
    })
  }

  // GET: api/playlists/:id
  findOne(req, res) {
    res.json(req.playlist.toJSONExpanded(this.db.libraryItems))
  }

  // PATCH: api/playlists/:id
  async update(req, res) {
    const playlist = req.playlist
    let wasUpdated = playlist.update(req.body)
    const jsonExpanded = playlist.toJSONExpanded(this.db.libraryItems)
    if (wasUpdated) {
      await this.db.updateEntity('playlist', playlist)
      SocketAuthority.clientEmitter(playlist.userId, 'playlist_updated', jsonExpanded)
    }
    res.json(jsonExpanded)
  }

  // DELETE: api/playlists/:id
  async delete(req, res) {
    const playlist = req.playlist
    const jsonExpanded = playlist.toJSONExpanded(this.db.libraryItems)
    await this.db.removeEntity('playlist', playlist.id)
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

    const libraryItem = this.db.libraryItems.find(li => li.id === itemToAdd.libraryItemId)
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
    const jsonExpanded = playlist.toJSONExpanded(this.db.libraryItems)
    await this.db.updateEntity('playlist', playlist)
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

    const jsonExpanded = playlist.toJSONExpanded(this.db.libraryItems)

    // Playlist is removed when there are no items
    if (!playlist.items.length) {
      Logger.info(`[PlaylistController] Playlist "${playlist.name}" has no more items - removing it`)
      await this.db.removeEntity('playlist', playlist.id)
      SocketAuthority.clientEmitter(playlist.userId, 'playlist_removed', jsonExpanded)
    } else {
      await this.db.updateEntity('playlist', playlist)
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
    for (const item of itemsToAdd) {
      if (!item.libraryItemId) {
        return res.status(400).send('Item does not have libraryItemId')
      }

      if (!playlist.containsItem(item)) {
        playlist.addItem(item.libraryItemId, item.episodeId)
        hasUpdated = true
      }
    }

    const jsonExpanded = playlist.toJSONExpanded(this.db.libraryItems)
    if (hasUpdated) {
      await this.db.updateEntity('playlist', playlist)
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

    const jsonExpanded = playlist.toJSONExpanded(this.db.libraryItems)
    if (hasUpdated) {
      // Playlist is removed when there are no items
      if (!playlist.items.length) {
        Logger.info(`[PlaylistController] Playlist "${playlist.name}" has no more items - removing it`)
        await this.db.removeEntity('playlist', playlist.id)
        SocketAuthority.clientEmitter(playlist.userId, 'playlist_removed', jsonExpanded)
      } else {
        await this.db.updateEntity('playlist', playlist)
        SocketAuthority.clientEmitter(playlist.userId, 'playlist_updated', jsonExpanded)
      }
    }
    res.json(jsonExpanded)
  }

  middleware(req, res, next) {
    if (req.params.id) {
      var playlist = this.db.playlists.find(p => p.id === req.params.id)
      if (!playlist) {
        return res.status(404).send('Playlist not found')
      }
      if (playlist.userId !== req.user.id) {
        Logger.warn(`[PlaylistController] Playlist ${req.params.id} requested by user ${req.user.id} that is not the owner`)
        return res.sendStatus(403)
      }
      req.playlist = playlist
    }

    if (req.method == 'DELETE' && !req.user.canDelete) {
      Logger.warn(`[PlaylistController] User attempted to delete without permission`, req.user.username)
      return res.sendStatus(403)
    } else if ((req.method == 'PATCH' || req.method == 'POST') && !req.user.canUpdate) {
      Logger.warn('[PlaylistController] User attempted to update without permission', req.user.username)
      return res.sendStatus(403)
    }

    next()
  }
}
module.exports = new PlaylistController()