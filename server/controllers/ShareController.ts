import type { Request, Response } from 'express'
import type User from '../models/User'
import type Book from '../models/Book'
import type PlaybackSessionManager from '../managers/PlaybackSessionManager'
import * as uuid from 'uuid'
import Path from 'path'
import { Op } from 'sequelize'
import Logger from '../Logger'
import Database from '../Database'

import { PlayMethod } from '../utils/constants'
import { getAudioMimeTypeFromExtname, encodeUriPath } from '../utils/fileUtils'
import * as zipHelpers from '../utils/zipHelpers'

import PlaybackSession from '../objects/PlaybackSession'
import ShareManager from '../managers/ShareManager'

type RequestWithUser<Body = unknown> = Request<Record<string, string>, unknown, Body> & { user: User }
type PublicShareRequest<Body = unknown, Query = Record<string, unknown>> = Omit<Request<Record<string, string>, unknown, Body, Query>, 'cookies'> & {
  cookies: { share_session_id?: string }
}
type ShareContext = { playbackSessionManager: PlaybackSessionManager }
type SharedItemResponse = NonNullable<ReturnType<typeof ShareManager.findBySlug>> & { playbackSession?: ReturnType<PlaybackSession['toJSONForClient']> }

class ShareController {
  constructor() {}

  /**
   * Public route
   * GET: /api/share/:slug
   * Get media item share by slug
   */
  async getMediaItemShareBySlug(this: ShareContext, req: PublicShareRequest<unknown, { t?: string }>, res: Response) {
    const { slug } = req.params
    // Optional start time
    let startTime = req.query.t && !isNaN(Number(req.query.t)) ? Math.max(0, parseInt(req.query.t)) : 0

    const mediaItemShare: SharedItemResponse | null = ShareManager.findBySlug(slug)
    if (!mediaItemShare) {
      Logger.warn(`[ShareController] Media item share not found with slug ${slug}`)
      return res.sendStatus(404)
    }
    if (mediaItemShare.expiresAt && mediaItemShare.expiresAt.valueOf() < Date.now()) {
      void ShareManager.removeMediaItemShare(mediaItemShare.id)
      return res.status(404).send('Media item share not found')
    }

    if (req.cookies.share_session_id) {
      const playbackSession = ShareManager.findPlaybackSessionBySessionId(req.cookies.share_session_id)

      if (playbackSession) {
        if (mediaItemShare.id === playbackSession.mediaItemShareId) {
          Logger.debug(`[ShareController] Found share playback session ${req.cookies.share_session_id}`)
          // If ?t was provided, override the cached currentTime
          if (startTime > 0 && startTime < playbackSession.duration!) {
            playbackSession.currentTime = startTime
          }
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
      const libraryItem = await Database.mediaItemShareModel.getMediaItemsLibraryItem(mediaItemShare.mediaItemId!, mediaItemShare.mediaItemType!)
      if (!libraryItem) {
        return res.status(404).send('Media item not found')
      }

      let startOffset = 0
      // The share lookup loads a library item only for book shares.
      const publicTracks = (libraryItem.media as Book).includedAudioFiles.map((audioFile) => {
        const audioTrack = {
          index: audioFile.index,
          startOffset,
          duration: audioFile.duration,
          title: audioFile.metadata.filename || '',
          contentUrl: `${global.RouterBasePath}/public/share/${slug}/track/${audioFile.index}`,
          mimeType: audioFile.mimeType,
          codec: audioFile.codec || null,
          metadata: structuredClone(audioFile.metadata)
        }
        startOffset += audioTrack.duration!
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
      newPlaybackSession.setData(libraryItem, null, 'web-share', deviceInfo, startTime)
      newPlaybackSession.audioTracks = publicTracks
      newPlaybackSession.playMethod = PlayMethod.DIRECTPLAY
      newPlaybackSession.shareSessionId = shareSessionId
      newPlaybackSession.mediaItemShareId = mediaItemShare.id
      newPlaybackSession.coverAspectRatio = libraryItem.library!.settings!.coverAspectRatio

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
   */
  async getMediaItemShareCoverImage(req: PublicShareRequest, res: Response) {
    if (!req.cookies.share_session_id) {
      return res.status(404).send('Share session not set')
    }

    const { slug } = req.params

    const mediaItemShare = ShareManager.findBySlug(slug)
    if (!mediaItemShare) {
      return res.sendStatus(404)
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
    return Promise.resolve()
  }

  /**
   * Public route - requires share_session_id cookie
   *
   * GET: /api/share/:slug/track/:index
   * Get media item share audio track
   */
  async getMediaItemShareAudioTrack(req: PublicShareRequest, res: Response) {
    if (!req.cookies.share_session_id) {
      return res.status(404).send('Share session not set')
    }

    const { slug, index } = req.params

    const mediaItemShare = ShareManager.findBySlug(slug)
    if (!mediaItemShare) {
      return res.sendStatus(404)
    }

    const playbackSession = ShareManager.findPlaybackSessionBySessionId(req.cookies.share_session_id)
    if (!playbackSession || playbackSession.mediaItemShareId !== mediaItemShare.id) {
      return res.status(404).send('Share session not found')
    }

    const audioTrack = playbackSession.audioTracks.find((t) => t.index === parseInt(index))
    if (!audioTrack) {
      return res.status(404).send('Track not found')
    }
    const audioTrackPath = audioTrack.metadata!.path!

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
    return Promise.resolve()
  }

  /**
   * Public route - requires share_session_id cookie
   *
   * GET: /api/share/:slug/download
   * Downloads media item share
   */
  async downloadMediaItemShare(req: PublicShareRequest, res: Response) {
    if (!req.cookies.share_session_id) {
      return res.status(404).send('Share session not set')
    }

    const { slug } = req.params
    const mediaItemShare = ShareManager.findBySlug(slug)
    if (!mediaItemShare) {
      return res.sendStatus(404)
    }
    if (!mediaItemShare.isDownloadable) {
      return res.status(403).send('Download is not allowed for this item')
    }

    const playbackSession = ShareManager.findPlaybackSessionBySessionId(req.cookies.share_session_id)
    if (!playbackSession || playbackSession.mediaItemShareId !== mediaItemShare.id) {
      return res.status(404).send('Share session not found')
    }

    const libraryItem = await Database.libraryItemModel.findByPk(playbackSession.libraryItemId!, {
      attributes: ['id', 'path', 'relPath', 'isFile']
    })
    if (!libraryItem) {
      return res.status(404).send('Library item not found')
    }

    const itemPath = libraryItem.path!
    const itemTitle = playbackSession.displayTitle

    Logger.info(`[ShareController] Requested download for book "${itemTitle}" at "${itemPath}"`)

    try {
      if (libraryItem.isFile) {
        const audioMimeType = getAudioMimeTypeFromExtname(Path.extname(itemPath))
        if (audioMimeType) {
          res.setHeader('Content-Type', audioMimeType)
        }
        await new Promise<void>((resolve, reject) => res.download(itemPath, libraryItem.relPath!, (error) => (error ? reject(error) : resolve())))
      } else {
        const filename = `${itemTitle}.zip`
        await zipHelpers.zipDirectoryPipe(itemPath, filename, res)
      }

      Logger.info(`[ShareController] Downloaded item "${itemTitle}" at "${itemPath}"`)
    } catch (error) {
      Logger.error(`[ShareController] Download failed for item "${itemTitle}" at "${itemPath}"`, error)
      res.status(500).send('Failed to download the item')
    }
  }

  /**
   * Public route - requires share_session_id cookie
   *
   * PATCH: /api/share/:slug/progress
   * Update media item share progress
   */
  async updateMediaItemShareProgress(req: PublicShareRequest<{ currentTime: number | null }>, res: Response) {
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
      return res.sendStatus(404)
    }

    const playbackSession = ShareManager.findPlaybackSessionBySessionId(req.cookies.share_session_id)
    if (!playbackSession || playbackSession.mediaItemShareId !== mediaItemShare.id) {
      return res.status(404).send('Share session not found')
    }

    playbackSession.currentTime = Math.min(currentTime, playbackSession.duration!)
    playbackSession.updatedAt = Date.now()
    Logger.debug(`[ShareController] Update share playback session ${req.cookies.share_session_id} currentTime: ${playbackSession.currentTime}`)
    res.sendStatus(204)
    return Promise.resolve()
  }

  /**
   * POST: /api/share/mediaitem
   * Create a new media item share
   */
  async createMediaItemShare(req: RequestWithUser<{ slug?: string; expiresAt: number | null; mediaItemType?: string; mediaItemId?: string; isDownloadable?: boolean }>, res: Response) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[ShareController] Non-admin user "${req.user.username}" attempted to create item share`)
      return res.sendStatus(403)
    }

    const { slug, expiresAt, mediaItemType, mediaItemId, isDownloadable } = req.body

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
      const mediaItemModel: { findByPk(id: string): Promise<unknown> } = mediaItemType === 'book' ? Database.bookModel : Database.podcastEpisodeModel
      const mediaItem = await mediaItemModel.findByPk(mediaItemId)
      if (!mediaItem) {
        return res.status(404).send('Media item not found')
      }

      const mediaItemShare = await Database.mediaItemShareModel.create({
        slug,
        expiresAt: expiresAt || null,
        mediaItemId,
        mediaItemType,
        userId: req.user.id,
        isDownloadable
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
   */
  async deleteMediaItemShare(req: RequestWithUser, res: Response) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[ShareController] Non-admin user "${req.user.username}" attempted to delete item share`)
      return res.sendStatus(403)
    }

    try {
      const mediaItemShare = await Database.mediaItemShareModel.findByPk(req.params.id)
      if (!mediaItemShare) {
        return res.status(404).send('Media item share not found')
      }

      void ShareManager.removeMediaItemShare(mediaItemShare.id)

      await mediaItemShare.destroy()
      res.sendStatus(204)
    } catch (error) {
      Logger.error(`[ShareController] Failed`, error)
      res.status(500).send('Internal server error')
    }
  }
}
export = new ShareController()
