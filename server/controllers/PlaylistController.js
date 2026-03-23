const { Request, Response, NextFunction } = require('express')
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')
const htmlSanitizer = require('../utils/htmlSanitizer')
const { resolvePlaylistRequestItems } = require('../utils/playlistHelpers')

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 *
 * @typedef RequestEntityObject
 * @property {import('../models/Playlist')} playlist
 *
 * @typedef {RequestWithUser & RequestEntityObject} PlaylistControllerRequest
 */

class PlaylistController {
  constructor() {}

  /**
   * POST: /api/playlists
   * Create playlist
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async create(req, res) {
    const reqBody = req.body || {}

    // Validation
    const nameCleaned = htmlSanitizer.stripAllTags(reqBody.name)
    if (!nameCleaned || !reqBody.libraryId) {
      return res.status(400).send('Invalid playlist data')
    }
    if (reqBody.description && typeof reqBody.description !== 'string') {
      return res.status(400).send('Invalid playlist description')
    }
    const items = reqBody.items || []
    const isPodcast = items.some((i) => i.episodeId)
    const libraryItemIds = new Set()
    for (const item of items) {
      if (!item.libraryItemId || typeof item.libraryItemId !== 'string') {
        return res.status(400).send('Invalid playlist item')
      }
      if (isPodcast && (!item.episodeId || typeof item.episodeId !== 'string')) {
        return res.status(400).send('Invalid playlist item episodeId')
      } else if (!isPodcast && item.episodeId) {
        return res.status(400).send('Invalid playlist item episodeId')
      }
      libraryItemIds.add(item.libraryItemId)
    }

    // Load library items
    const libraryItems = await Database.libraryItemModel.findAll({
      attributes: ['id', 'mediaId', 'mediaType', 'libraryId'],
      where: {
        id: Array.from(libraryItemIds),
        libraryId: reqBody.libraryId,
        mediaType: isPodcast ? 'podcast' : 'book'
      }
    })
    if (libraryItems.length !== libraryItemIds.size) {
      return res.status(400).send('Invalid playlist data. Invalid items')
    }

    // Validate podcast episodes
    if (isPodcast) {
      const podcastEpisodeIds = items.map((i) => i.episodeId)
      const podcastEpisodes = await Database.podcastEpisodeModel.findAll({
        attributes: ['id'],
        where: {
          id: podcastEpisodeIds
        }
      })
      if (podcastEpisodes.length !== podcastEpisodeIds.length) {
        return res.status(400).send('Invalid playlist data. Invalid podcast episodes')
      }
    }

    const transaction = await Database.sequelize.transaction()
    try {
      // Create playlist
      const newPlaylist = await Database.playlistModel.create(
        {
          libraryId: reqBody.libraryId,
          userId: req.user.id,
          name: nameCleaned,
          description: reqBody.description || null
        },
        { transaction }
      )

      // Create playlistMediaItems
      const playlistItemPayloads = []
      for (const [index, item] of items.entries()) {
        const libraryItem = libraryItems.find((li) => li.id === item.libraryItemId)
        playlistItemPayloads.push({
          playlistId: newPlaylist.id,
          mediaItemId: item.episodeId || libraryItem.mediaId,
          mediaItemType: item.episodeId ? 'podcastEpisode' : 'book',
          order: index + 1
        })
      }

      await Database.playlistMediaItemModel.bulkCreate(playlistItemPayloads, { transaction })

      await transaction.commit()

      newPlaylist.playlistMediaItems = await newPlaylist.getMediaItemsExpandedWithLibraryItem()

      const jsonExpanded = newPlaylist.toOldJSONExpanded()
      SocketAuthority.clientEmitter(newPlaylist.userId, 'playlist_added', jsonExpanded)
      res.json(jsonExpanded)
    } catch (error) {
      await transaction.rollback()
      Logger.error('[PlaylistController] create:', error)
      res.status(500).send('Failed to create playlist')
    }
  }

  /**
   * @deprecated - Use /api/libraries/:libraryId/playlists
   * This is not used by Abs web client or mobile apps
   * TODO: Remove this endpoint or make it the primary
   *
   * GET: /api/playlists
   * Get all playlists for user
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async findAllForUser(req, res) {
    const playlistsForUser = await Database.playlistModel.getOldPlaylistsForUserAndLibrary(req.user.id)
    res.json({
      playlists: playlistsForUser
    })
  }

  /**
   * GET: /api/playlists/:id
   *
   * @param {PlaylistControllerRequest} req
   * @param {Response} res
   */
  async findOne(req, res) {
    req.playlist.playlistMediaItems = await req.playlist.getMediaItemsExpandedWithLibraryItem()
    res.json(req.playlist.toOldJSONExpanded())
  }

  /**
   * PATCH: /api/playlists/:id
   * Update playlist
   *
   * Used for updating name and description or reordering items
   *
   * @param {PlaylistControllerRequest} req
   * @param {Response} res
   */
  async update(req, res) {
    // Validation
    const reqBody = req.body || {}
    if (reqBody.libraryId || reqBody.userId) {
      // Could allow support for this if needed with additional validation
      return res.status(400).send('Invalid playlist data. Cannot update libraryId or userId')
    }
    if (reqBody.name && typeof reqBody.name !== 'string') {
      return res.status(400).send('Invalid playlist name')
    }
    if (reqBody.description && typeof reqBody.description !== 'string') {
      return res.status(400).send('Invalid playlist description')
    }
    if (reqBody.items && (!Array.isArray(reqBody.items) || reqBody.items.some((i) => !i.libraryItemId || typeof i.libraryItemId !== 'string' || (i.episodeId && typeof i.episodeId !== 'string')))) {
      return res.status(400).send('Invalid playlist items')
    }

    const playlistUpdatePayload = {}

    const nameCleaned = htmlSanitizer.stripAllTags(reqBody.name)
    if (nameCleaned) {
      playlistUpdatePayload.name = nameCleaned
    }
    if (reqBody.description) playlistUpdatePayload.description = reqBody.description

    // Update name and description
    let wasUpdated = false
    if (Object.keys(playlistUpdatePayload).length) {
      req.playlist.set(playlistUpdatePayload)
      const changed = req.playlist.changed()
      if (changed?.length) {
        await req.playlist.save()
        Logger.debug(`[PlaylistController] Updated playlist ${req.playlist.id} keys [${changed.join(',')}]`)
        wasUpdated = true
      }
    }

    // If array of items is set then update order of playlist media items
    if (reqBody.items?.length) {
      const libraryItemIds = Array.from(new Set(reqBody.items.map((i) => i.libraryItemId)))
      const libraryItems = await Database.libraryItemModel.findAll({
        attributes: ['id', 'mediaId', 'mediaType'],
        where: {
          id: libraryItemIds
        }
      })
      if (libraryItems.length !== libraryItemIds.length) {
        return res.status(400).send('Invalid playlist items. Items not found')
      }
      /** @type {import('../models/PlaylistMediaItem')[]} */
      const existingPlaylistMediaItems = await req.playlist.getPlaylistMediaItems({
        order: [['order', 'ASC']]
      })
      if (existingPlaylistMediaItems.length !== reqBody.items.length) {
        return res.status(400).send('Invalid playlist items. Length mismatch')
      }

      // Set an array of mediaItemId
      const newMediaItemIdOrder = []
      for (const item of reqBody.items) {
        const libraryItem = libraryItems.find((li) => li.id === item.libraryItemId)
        const mediaItemId = item.episodeId || libraryItem.mediaId
        newMediaItemIdOrder.push(mediaItemId)
      }

      // Sort existing playlist media items into new order
      existingPlaylistMediaItems.sort((a, b) => {
        const aIndex = newMediaItemIdOrder.findIndex((i) => i === a.mediaItemId)
        const bIndex = newMediaItemIdOrder.findIndex((i) => i === b.mediaItemId)
        return aIndex - bIndex
      })

      // Update order on playlistMediaItem records
      for (const [index, playlistMediaItem] of existingPlaylistMediaItems.entries()) {
        if (playlistMediaItem.order !== index + 1) {
          await playlistMediaItem.update({
            order: index + 1
          })
          wasUpdated = true
        }
      }
    }

    req.playlist.playlistMediaItems = await req.playlist.getMediaItemsExpandedWithLibraryItem()

    const jsonExpanded = req.playlist.toOldJSONExpanded()
    if (wasUpdated) {
      SocketAuthority.clientEmitter(req.playlist.userId, 'playlist_updated', jsonExpanded)
    }
    res.json(jsonExpanded)
  }

  /**
   * DELETE: /api/playlists/:id
   * Remove playlist
   *
   * @param {PlaylistControllerRequest} req
   * @param {Response} res
   */
  async delete(req, res) {
    req.playlist.playlistMediaItems = await req.playlist.getMediaItemsExpandedWithLibraryItem()
    const jsonExpanded = req.playlist.toOldJSONExpanded()

    await req.playlist.destroy()
    SocketAuthority.clientEmitter(jsonExpanded.userId, 'playlist_removed', jsonExpanded)
    res.sendStatus(200)
  }

  /**
   * POST: /api/playlists/:id/item
   * Add item to playlist
   *
   * This is not used by Abs web client or mobile apps. Only the batch endpoints are used.
   *
   * @param {PlaylistControllerRequest} req
   * @param {Response} res
   */
  async addItem(req, res) {
    const itemToAdd = req.body || {}

    if (!itemToAdd.libraryItemId) {
      return res.status(400).send('Request body has no libraryItemId')
    }

    const [resolvedItem] = (await resolvePlaylistRequestItems([itemToAdd], req.playlist.libraryId)) || []
    if (!resolvedItem) {
      return res.status(400).send('Library item not found')
    }

    req.playlist.playlistMediaItems = await req.playlist.getMediaItemsExpandedWithLibraryItem()

    if (req.playlist.checkHasMediaItem(itemToAdd.libraryItemId, itemToAdd.episodeId)) {
      return res.status(400).send('Item already in playlist')
    }

    const jsonExpanded = req.playlist.toOldJSONExpanded()

    const playlistMediaItem = {
      playlistId: req.playlist.id,
      mediaItemId: resolvedItem.mediaItemId,
      mediaItemType: resolvedItem.mediaItemType,
      order: req.playlist.playlistMediaItems.length + 1
    }
    await Database.playlistMediaItemModel.create(playlistMediaItem)

    jsonExpanded.items.push(resolvedItem.jsonItem)

    SocketAuthority.clientEmitter(jsonExpanded.userId, 'playlist_updated', jsonExpanded)
    res.json(jsonExpanded)
  }

  /**
   * DELETE: /api/playlists/:id/item/:libraryItemId/:episodeId?
   * Remove item from playlist
   *
   * @param {PlaylistControllerRequest} req
   * @param {Response} res
   */
  async removeItem(req, res) {
    req.playlist.playlistMediaItems = await req.playlist.getMediaItemsExpandedWithLibraryItem()

    let playlistMediaItem = null
    if (req.params.episodeId) {
      playlistMediaItem = req.playlist.playlistMediaItems.find((pmi) => pmi.mediaItemId === req.params.episodeId)
    } else {
      playlistMediaItem = req.playlist.playlistMediaItems.find((pmi) => pmi.mediaItem.libraryItem?.id === req.params.libraryItemId)
    }
    if (!playlistMediaItem) {
      return res.status(404).send('Media item not found in playlist')
    }

    // Remove record
    await playlistMediaItem.destroy()
    req.playlist.playlistMediaItems = req.playlist.playlistMediaItems.filter((pmi) => pmi.id !== playlistMediaItem.id)

    // Update playlist media items order
    for (const [index, mediaItem] of req.playlist.playlistMediaItems.entries()) {
      if (mediaItem.order !== index + 1) {
        await mediaItem.update({
          order: index + 1
        })
      }
    }

    const jsonExpanded = req.playlist.toOldJSONExpanded()

    // Playlist is removed when there are no items
    if (!jsonExpanded.items.length) {
      Logger.info(`[PlaylistController] Playlist "${jsonExpanded.name}" has no more items - removing it`)
      await req.playlist.destroy()
      SocketAuthority.clientEmitter(jsonExpanded.userId, 'playlist_removed', jsonExpanded)
    } else {
      SocketAuthority.clientEmitter(jsonExpanded.userId, 'playlist_updated', jsonExpanded)
    }

    res.json(jsonExpanded)
  }

  /**
   * POST: /api/playlists/:id/batch/add
   * Batch add playlist items
   *
   * @param {PlaylistControllerRequest} req
   * @param {Response} res
   */
  async addBatch(req, res) {
    if (!req.body.items?.length || !Array.isArray(req.body.items) || req.body.items.some((i) => !i?.libraryItemId || typeof i.libraryItemId !== 'string' || (i.episodeId && typeof i.episodeId !== 'string'))) {
      return res.status(400).send('Invalid request body items')
    }

    const resolvedItems = await resolvePlaylistRequestItems(req.body.items, req.playlist.libraryId)
    if (!resolvedItems || resolvedItems.some((item) => !item)) {
      return res.status(400).send('Invalid request body items')
    }

    req.playlist.playlistMediaItems = await req.playlist.getMediaItemsExpandedWithLibraryItem()

    const mediaItemsToAdd = []
    const jsonExpanded = req.playlist.toOldJSONExpanded()

    // Setup array of playlistMediaItem records to add
    let order = req.playlist.playlistMediaItems.length + 1
    for (const resolvedItem of resolvedItems) {
      const { mediaItemId, mediaItemType, jsonItem } = resolvedItem
      if (req.playlist.playlistMediaItems.some((pmi) => pmi.mediaItemId === mediaItemId)) {
        // Already exists in playlist
        continue
      } else {
        mediaItemsToAdd.push({
          playlistId: req.playlist.id,
          mediaItemId,
          mediaItemType,
          order: order++
        })
        jsonExpanded.items.push(jsonItem)
      }
    }

    if (mediaItemsToAdd.length) {
      await Database.playlistMediaItemModel.bulkCreate(mediaItemsToAdd)

      SocketAuthority.clientEmitter(req.playlist.userId, 'playlist_updated', jsonExpanded)
    }

    res.json(jsonExpanded)
  }

  /**
   * POST: /api/playlists/:id/batch/remove
   * Batch remove playlist items
   *
   * @param {PlaylistControllerRequest} req
   * @param {Response} res
   */
  async removeBatch(req, res) {
    if (!req.body.items?.length || !Array.isArray(req.body.items) || req.body.items.some((i) => !i?.libraryItemId || typeof i.libraryItemId !== 'string' || (i.episodeId && typeof i.episodeId !== 'string'))) {
      return res.status(400).send('Invalid request body items')
    }

    req.playlist.playlistMediaItems = await req.playlist.getMediaItemsExpandedWithLibraryItem()

    // Remove playlist media items
    let hasUpdated = false
    for (const item of req.body.items) {
      let playlistMediaItem = null
      if (item.episodeId) {
        playlistMediaItem = req.playlist.playlistMediaItems.find((pmi) => pmi.mediaItemId === item.episodeId)
      } else {
        playlistMediaItem = req.playlist.playlistMediaItems.find((pmi) => pmi.mediaItem.libraryItem?.id === item.libraryItemId)
      }
      if (!playlistMediaItem) {
        Logger.warn(`[PlaylistController] Playlist item not found in playlist ${req.playlist.id}`, item)
        continue
      }

      await playlistMediaItem.destroy()
      req.playlist.playlistMediaItems = req.playlist.playlistMediaItems.filter((pmi) => pmi.id !== playlistMediaItem.id)

      hasUpdated = true
    }

    const jsonExpanded = req.playlist.toOldJSONExpanded()
    if (hasUpdated) {
      // Playlist is removed when there are no items
      if (!req.playlist.playlistMediaItems.length) {
        Logger.info(`[PlaylistController] Playlist "${req.playlist.name}" has no more items - removing it`)
        await req.playlist.destroy()
        SocketAuthority.clientEmitter(jsonExpanded.userId, 'playlist_removed', jsonExpanded)
      } else {
        SocketAuthority.clientEmitter(jsonExpanded.userId, 'playlist_updated', jsonExpanded)
      }
    }
    res.json(jsonExpanded)
  }

  /**
   * POST: /api/playlists/collection/:collectionId
   * Create a playlist from a collection
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async createFromCollection(req, res) {
    const collection = await Database.collectionModel.findByPk(req.params.collectionId)
    if (!collection) {
      return res.status(404).send('Collection not found')
    }
    // Expand collection to get library items
    const collectionExpanded = await collection.getOldJsonExpanded(req.user)
    if (!collectionExpanded) {
      // This can happen if the user has no access to all items in collection
      return res.status(404).send('Collection not found')
    }

    // Playlists cannot be empty
    if (!collectionExpanded.books.length) {
      return res.status(400).send('Collection has no books')
    }

    const transaction = await Database.sequelize.transaction()
    try {
      const playlist = await Database.playlistModel.create(
        {
          userId: req.user.id,
          libraryId: collection.libraryId,
          name: collection.name,
          description: collection.description || null
        },
        { transaction }
      )

      const mediaItemsToAdd = []
      for (const [index, libraryItem] of collectionExpanded.books.entries()) {
        mediaItemsToAdd.push({
          playlistId: playlist.id,
          mediaItemId: libraryItem.media.id,
          mediaItemType: 'book',
          order: index + 1
        })
      }
      await Database.playlistMediaItemModel.bulkCreate(mediaItemsToAdd, { transaction })

      await transaction.commit()

      playlist.playlistMediaItems = await playlist.getMediaItemsExpandedWithLibraryItem()

      const jsonExpanded = playlist.toOldJSONExpanded()
      SocketAuthority.clientEmitter(playlist.userId, 'playlist_added', jsonExpanded)
      res.json(jsonExpanded)
    } catch (error) {
      await transaction.rollback()
      Logger.error('[PlaylistController] createFromCollection:', error)
      res.status(500).send('Failed to create playlist')
    }
  }

  /**
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   * @param {NextFunction} next
   */
  async middleware(req, res, next) {
    if (req.params.id) {
      const playlist = await Database.playlistModel.findByPk(req.params.id)
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
