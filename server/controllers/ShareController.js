const Path = require('path')
const { Op } = require('sequelize')
const Logger = require('../Logger')
const Database = require('../Database')

const { PlayMethod } = require('../utils/constants')
const { getAudioMimeTypeFromExtname, encodeUriPath } = require('../utils/fileUtils')

const PlaybackSession = require('../objects/PlaybackSession')
const ShareManager = require('../managers/ShareManager')

class ShareController {
  constructor() {}

  /**
   * Public route
   * GET: /api/share/:slug
   * Get media item share by slug
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async getMediaItemShareBySlug(req, res) {
    const { slug } = req.params

    const mediaItemShare = ShareManager.findBySlug(slug)
    if (!mediaItemShare) {
      return res.status(404)
    }
    if (mediaItemShare.expiresAt && mediaItemShare.expiresAt.valueOf() < Date.now()) {
      ShareManager.removeMediaItemShare(mediaItemShare.id)
      return res.status(404).send('Media item share not found')
    }

    try {
      const oldLibraryItem = await Database.mediaItemShareModel.getMediaItemsOldLibraryItem(mediaItemShare.mediaItemId, mediaItemShare.mediaItemType)

      if (!oldLibraryItem) {
        return res.status(404).send('Media item not found')
      }

      let startOffset = 0
      const publicTracks = oldLibraryItem.media.includedAudioFiles.map((audioFile) => {
        const audioTrack = {
          index: audioFile.index,
          startOffset,
          duration: audioFile.duration,
          title: audioFile.metadata.filename || '',
          contentUrl: `${global.RouterBasePath}/public/share/${slug}/file/${audioFile.ino}`,
          mimeType: audioFile.mimeType,
          codec: audioFile.codec || null,
          metadata: audioFile.metadata.clone()
        }
        startOffset += audioTrack.duration
        return audioTrack
      })

      const newPlaybackSession = new PlaybackSession()
      newPlaybackSession.setData(oldLibraryItem, null, 'web-public', null, 0)
      newPlaybackSession.audioTracks = publicTracks
      newPlaybackSession.playMethod = PlayMethod.DIRECTPLAY

      mediaItemShare.playbackSession = newPlaybackSession.toJSONForClient()

      res.json(mediaItemShare)
    } catch (error) {
      Logger.error(`[ShareController] Failed`, error)
      res.status(500).send('Internal server error')
    }
  }

  /**
   * Public route
   * GET: /api/share/:slug/file/:fileid
   * Get media item share file
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async getMediaItemShareFile(req, res) {
    const { slug, fileid } = req.params

    const mediaItemShare = ShareManager.findBySlug(slug)
    if (!mediaItemShare) {
      return res.status(404)
    }

    /** @type {import('../models/LibraryItem')} */
    const libraryItem = await Database.libraryItemModel.findOne({
      where: {
        mediaId: mediaItemShare.mediaItemId
      }
    })

    const libraryFile = libraryItem?.libraryFiles.find((lf) => lf.ino === fileid)
    if (!libraryFile) {
      return res.status(404).send('File not found')
    }

    if (global.XAccel) {
      const encodedURI = encodeUriPath(global.XAccel + libraryFile.metadata.path)
      Logger.debug(`Use X-Accel to serve static file ${encodedURI}`)
      return res.status(204).header({ 'X-Accel-Redirect': encodedURI }).send()
    }

    // Express does not set the correct mimetype for m4b files so use our defined mimetypes if available
    const audioMimeType = getAudioMimeTypeFromExtname(Path.extname(libraryFile.metadata.path))
    if (audioMimeType) {
      res.setHeader('Content-Type', audioMimeType)
    }
    res.sendFile(libraryFile.metadata.path)
  }

  /**
   * POST: /api/share/mediaitem
   * Create a new media item share
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async createMediaItemShare(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[ShareController] Non-admin user "${req.user.username}" attempted to create item share`)
      return res.sendStatus(403)
    }

    const { slug, expiresAt, mediaItemType, mediaItemId } = req.body

    if (!slug?.trim?.() || typeof mediaItemType !== 'string' || typeof mediaItemId !== 'string') {
      return res.status(400).send('Missing or invalid required fields')
    }
    if (expiresAt === null || isNaN(expiresAt) || expiresAt < 0) {
      return res.status(400).send('Invalid expiration date')
    }
    if (!['book', 'podcastEpisode'].includes(mediaItemType)) {
      return res.status(400).send('Invalid media item type')
    }

    try {
      // Check if the media item share already exists by slug or mediaItemId
      const existingMediaItemShare = await Database.mediaItemShareModel.findOne({
        where: {
          [Op.or]: [{ slug }, { mediaItemId }]
        }
      })
      if (existingMediaItemShare) {
        if (existingMediaItemShare.mediaItemId === mediaItemId) {
          return res.status(409).send('Item is already shared')
        } else {
          return res.status(409).send('Slug is already in use')
        }
      }

      // Check that media item exists
      const mediaItemModel = mediaItemType === 'book' ? Database.bookModel : Database.podcastEpisodeModel
      const mediaItem = await mediaItemModel.findByPk(mediaItemId)
      if (!mediaItem) {
        return res.status(404).send('Media item not found')
      }

      const mediaItemShare = await Database.mediaItemShareModel.create({
        slug,
        expiresAt: expiresAt || null,
        mediaItemId,
        mediaItemType,
        userId: req.user.id
      })

      ShareManager.openMediaItemShare(mediaItemShare)

      res.status(201).json(mediaItemShare?.toJSONForClient())
    } catch (error) {
      Logger.error(`[ShareController] Failed`, error)
      res.status(500).send('Internal server error')
    }
  }

  /**
   * DELETE: /api/share/mediaitem/:id
   * Delete media item share
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async deleteMediaItemShare(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[ShareController] Non-admin user "${req.user.username}" attempted to delete item share`)
      return res.sendStatus(403)
    }

    try {
      const mediaItemShare = await Database.mediaItemShareModel.findByPk(req.params.id)
      if (!mediaItemShare) {
        return res.status(404).send('Media item share not found')
      }

      ShareManager.removeMediaItemShare(mediaItemShare.id)

      await mediaItemShare.destroy()
      res.sendStatus(204)
    } catch (error) {
      Logger.error(`[ShareController] Failed`, error)
      res.status(500).send('Internal server error')
    }
  }
}
module.exports = new ShareController()
