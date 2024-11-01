const { Request, Response } = require('express')
const uuid = require('uuid')
const Path = require('path')
const { Op } = require('sequelize')
const Logger = require('../Logger')
const Database = require('../Database')

const { PlayMethod } = require('../utils/constants')
const { getAudioMimeTypeFromExtname, encodeUriPath } = require('../utils/fileUtils')

const PlaybackSession = require('../objects/PlaybackSession')
const ShareManager = require('../managers/ShareManager')

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 */

class ShareController {
  constructor() {}

  /**
   * Public route
   * GET: /api/share/:slug
   * Get media item share by slug
   *
   * @this {import('../routers/PublicRouter')}
   *
   * @param {Request} req
   * @param {Response} res
   */
  async getMediaItemShareBySlug(req, res) {
    const { slug } = req.params
    // Optional start time
    let startTime = req.query.t && !isNaN(req.query.t) ? Math.max(0, parseInt(req.query.t)) : 0

    const mediaItemShare = ShareManager.findBySlug(slug)
    if (!mediaItemShare) {
      Logger.warn(`[ShareController] Media item share not found with slug ${slug}`)
      return res.sendStatus(404)
    }
    if (mediaItemShare.expiresAt && mediaItemShare.expiresAt.valueOf() < Date.now()) {
      ShareManager.removeMediaItemShare(mediaItemShare.id)
      return res.status(404).send('Media item share not found')
    }

    if (req.cookies.share_session_id) {
      const playbackSession = ShareManager.findPlaybackSessionBySessionId(req.cookies.share_session_id)

      if (playbackSession) {
        if (mediaItemShare.id === playbackSession.mediaItemShareId) {
          Logger.debug(`[ShareController] Found share playback session ${req.cookies.share_session_id}`)
          mediaItemShare.playbackSession = playbackSession.toJSONForClient()
          return res.json(mediaItemShare)
        } else {
          // Changed media item share - close other session
          Logger.debug(`[ShareController] Other playback session is already open for share session. Closing session "${playbackSession.displayTitle}"`)
          ShareManager.closeSharePlaybackSession(playbackSession)
        }
      } else {
        Logger.info(`[ShareController] Share playback session not found with id ${req.cookies.share_session_id}`)
        if (!uuid.validate(req.cookies.share_session_id) || uuid.version(req.cookies.share_session_id) !== 4) {
          Logger.warn(`[ShareController] Invalid share session id ${req.cookies.share_session_id}`)
          res.clearCookie('share_session_id')
        }
      }
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
          contentUrl: `${global.RouterBasePath}/public/share/${slug}/track/${audioFile.index}`,
          mimeType: audioFile.mimeType,
          codec: audioFile.codec || null,
          metadata: audioFile.metadata.clone()
        }
        startOffset += audioTrack.duration
        return audioTrack
      })

      if (startTime > startOffset) {
        Logger.warn(`[ShareController] Start time ${startTime} is greater than total duration ${startOffset}`)
        startTime = 0
      }

      const shareSessionId = req.cookies.share_session_id || uuid.v4()
      const clientDeviceInfo = {
        clientName: 'Abs Web Share',
        deviceId: shareSessionId
      }
      const deviceInfo = await this.playbackSessionManager.getDeviceInfo(req, clientDeviceInfo)

      const newPlaybackSession = new PlaybackSession()
      newPlaybackSession.setData(oldLibraryItem, null, 'web-share', deviceInfo, startTime)
      newPlaybackSession.audioTracks = publicTracks
      newPlaybackSession.playMethod = PlayMethod.DIRECTPLAY
      newPlaybackSession.shareSessionId = shareSessionId
      newPlaybackSession.mediaItemShareId = mediaItemShare.id
      newPlaybackSession.coverAspectRatio = oldLibraryItem.librarySettings.coverAspectRatio

      mediaItemShare.playbackSession = newPlaybackSession.toJSONForClient()
      ShareManager.addOpenSharePlaybackSession(newPlaybackSession)

      // 30 day cookie
      res.cookie('share_session_id', newPlaybackSession.shareSessionId, { maxAge: 1000 * 60 * 60 * 24 * 30, httpOnly: true })

      res.json(mediaItemShare)
    } catch (error) {
      Logger.error(`[ShareController] Failed`, error)
      res.status(500).send('Internal server error')
    }
  }

  /**
   * Public route - requires share_session_id cookie
   *
   * GET: /api/share/:slug/cover
   * Get media item share cover image
   *
   * @param {Request} req
   * @param {Response} res
   */
  async getMediaItemShareCoverImage(req, res) {
    if (!req.cookies.share_session_id) {
      return res.status(404).send('Share session not set')
    }

    const { slug } = req.params

    const mediaItemShare = ShareManager.findBySlug(slug)
    if (!mediaItemShare) {
      return res.status(404)
    }

    const playbackSession = ShareManager.findPlaybackSessionBySessionId(req.cookies.share_session_id)
    if (!playbackSession || playbackSession.mediaItemShareId !== mediaItemShare.id) {
      return res.status(404).send('Share session not found')
    }

    const coverPath = playbackSession.coverPath
    if (!coverPath) {
      return res.status(404).send('Cover image not found')
    }

    if (global.XAccel) {
      const encodedURI = encodeUriPath(global.XAccel + coverPath)
      Logger.debug(`Use X-Accel to serve static file ${encodedURI}`)
      return res.status(204).header({ 'X-Accel-Redirect': encodedURI }).send()
    }

    res.sendFile(coverPath)
  }

  /**
   * Public route - requires share_session_id cookie
   *
   * GET: /api/share/:slug/track/:index
   * Get media item share audio track
   *
   * @param {Request} req
   * @param {Response} res
   */
  async getMediaItemShareAudioTrack(req, res) {
    if (!req.cookies.share_session_id) {
      return res.status(404).send('Share session not set')
    }

    const { slug, index } = req.params

    const mediaItemShare = ShareManager.findBySlug(slug)
    if (!mediaItemShare) {
      return res.status(404)
    }

    const playbackSession = ShareManager.findPlaybackSessionBySessionId(req.cookies.share_session_id)
    if (!playbackSession || playbackSession.mediaItemShareId !== mediaItemShare.id) {
      return res.status(404).send('Share session not found')
    }

    const audioTrack = playbackSession.audioTracks.find((t) => t.index === parseInt(index))
    if (!audioTrack) {
      return res.status(404).send('Track not found')
    }
    const audioTrackPath = audioTrack.metadata.path

    if (global.XAccel) {
      const encodedURI = encodeUriPath(global.XAccel + audioTrackPath)
      Logger.debug(`Use X-Accel to serve static file ${encodedURI}`)
      return res.status(204).header({ 'X-Accel-Redirect': encodedURI }).send()
    }

    // Express does not set the correct mimetype for m4b files so use our defined mimetypes if available
    const audioMimeType = getAudioMimeTypeFromExtname(Path.extname(audioTrackPath))
    if (audioMimeType) {
      res.setHeader('Content-Type', audioMimeType)
    }
    res.sendFile(audioTrackPath)
  }

  /**
   * Public route - requires share_session_id cookie
   *
   * PATCH: /api/share/:slug/progress
   * Update media item share progress
   *
   * @param {Request} req
   * @param {Response} res
   */
  async updateMediaItemShareProgress(req, res) {
    if (!req.cookies.share_session_id) {
      return res.status(404).send('Share session not set')
    }

    const { slug } = req.params
    const { currentTime } = req.body
    if (currentTime === null || isNaN(currentTime) || currentTime < 0) {
      return res.status(400).send('Invalid current time')
    }

    const mediaItemShare = ShareManager.findBySlug(slug)
    if (!mediaItemShare) {
      return res.status(404)
    }

    const playbackSession = ShareManager.findPlaybackSessionBySessionId(req.cookies.share_session_id)
    if (!playbackSession || playbackSession.mediaItemShareId !== mediaItemShare.id) {
      return res.status(404).send('Share session not found')
    }

    playbackSession.currentTime = Math.min(currentTime, playbackSession.duration)
    playbackSession.updatedAt = Date.now()
    Logger.debug(`[ShareController] Update share playback session ${req.cookies.share_session_id} currentTime: ${playbackSession.currentTime}`)
    res.sendStatus(204)
  }

  /**
   * POST: /api/share/mediaitem
   * Create a new media item share
   *
   * @param {RequestWithUser} req
   * @param {Response} res
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
   * @param {RequestWithUser} req
   * @param {Response} res
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
