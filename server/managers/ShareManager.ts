import Database from '../Database'
import Logger from '../Logger'
import SocketAuthority from '../SocketAuthority'
import LongTimeout from '../utils/longTimeout'
import { elapsedPretty } from '../utils/index'
import type PlaybackSession from '../objects/PlaybackSession'
import type MediaItemShare from '../models/MediaItemShare'

// Shares loaded/created through Sequelize have populated createdAt/updatedAt.
type ShareObject = Partial<Pick<MediaItemShare, 'pash' | 'userId' | 'extraData'>> & Omit<ReturnType<MediaItemShare['toJSONForClient']>, 'pash' | 'userId' | 'extraData'>
type OpenShare = { id: string; mediaItemShare: ShareObject; timeout?: LongTimeout }


/**
 * @typedef OpenMediaItemShareObject
 * @property {string} id
 * @property {import('../models/MediaItemShare').MediaItemShareObject} mediaItemShare
 * @property {LongTimeout} timeout
 */

class ShareManager {
  declare openMediaItemShares: OpenShare[]
  declare openSharePlaybackSessions: PlaybackSession[]
  constructor() {
    /** @type {OpenMediaItemShareObject[]} */
    this.openMediaItemShares = []

    /** @type {import('../objects/PlaybackSession')[]} */
    this.openSharePlaybackSessions = []
  }

  init() {
    void this.loadMediaItemShares()
  }

  /**
   * @param {import('../objects/PlaybackSession')} playbackSession
   */
  addOpenSharePlaybackSession(playbackSession: PlaybackSession) {
    Logger.info(`[ShareManager] Adding new open share playback session "${playbackSession.displayTitle}"`)
    this.openSharePlaybackSessions.push(playbackSession)
  }

  /**
   *
   * @param {import('../objects/PlaybackSession')} playbackSession
   */
  closeSharePlaybackSession(playbackSession: PlaybackSession) {
    Logger.info(`[ShareManager] Closing share playback session "${playbackSession.displayTitle}"`)
    this.openSharePlaybackSessions = this.openSharePlaybackSessions.filter((s) => s.id !== playbackSession.id)
  }

  /**
   * Find an open media item share by media item ID
   * @param {string} mediaItemId
   * @returns {import('../models/MediaItemShare').MediaItemShareForClient}
   */
  findByMediaItemId(mediaItemId: string) {
    const mediaItemShareObject = this.openMediaItemShares.find((s) => s.mediaItemShare.mediaItemId === mediaItemId)?.mediaItemShare
    if (mediaItemShareObject) {
      const mediaItemShareObjectForClient = { ...mediaItemShareObject }
      delete mediaItemShareObjectForClient.pash
      delete mediaItemShareObjectForClient.userId
      delete mediaItemShareObjectForClient.extraData
      return mediaItemShareObjectForClient
    }
    return null
  }

  /**
   * Find an open media item share by slug
   * @param {string} slug
   * @returns {import('../models/MediaItemShare').MediaItemShareForClient}
   */
  findBySlug(slug: string) {
    const mediaItemShareObject = this.openMediaItemShares.find((s) => s.mediaItemShare.slug === slug)?.mediaItemShare
    if (mediaItemShareObject) {
      const mediaItemShareObjectForClient = { ...mediaItemShareObject }
      delete mediaItemShareObjectForClient.pash
      delete mediaItemShareObjectForClient.userId
      delete mediaItemShareObjectForClient.extraData
      return mediaItemShareObjectForClient
    }
    return null
  }

  /**
   * @param {string} shareSessionId
   * @returns {import('../objects/PlaybackSession')}
   */
  findPlaybackSessionBySessionId(shareSessionId: string) {
    return this.openSharePlaybackSessions.find((s) => s.shareSessionId === shareSessionId)
  }

  /**
   * Load all media item shares from the database
   * Remove expired & schedule active
   */
  async loadMediaItemShares() {
    /** @type {import('../models/MediaItemShare').MediaItemShareModel[]} */
    const mediaItemShares = await Database.models.mediaItemShare!.findAll()

    for (const mediaItemShare of mediaItemShares) {
      if (mediaItemShare.expiresAt && mediaItemShare.expiresAt.valueOf() < Date.now()) {
        Logger.info(`[ShareManager] Removing expired media item share "${mediaItemShare.id}"`)
        await this.destroyMediaItemShare(mediaItemShare.id)
      } else if (mediaItemShare.expiresAt) {
        this.scheduleMediaItemShare(mediaItemShare)
      } else {
        Logger.info(`[ShareManager] Loaded permanent media item share "${mediaItemShare.id}"`)
        this.openMediaItemShares.push({
          id: mediaItemShare.id,
          mediaItemShare: mediaItemShare.toJSON() as ShareObject
        })
      }
    }
  }

  /**
   *
   * @param {import('../models/MediaItemShare').MediaItemShareModel} mediaItemShare
   */
  scheduleMediaItemShare(mediaItemShare: MediaItemShare) {
    if (!mediaItemShare?.expiresAt) return

    const expiresAtDuration = mediaItemShare.expiresAt.valueOf() - Date.now()
    if (expiresAtDuration <= 0) {
      Logger.warn(`[ShareManager] Attempted to schedule expired media item share "${mediaItemShare.id}"`)
      void this.destroyMediaItemShare(mediaItemShare.id)
      return
    }
    const timeout = new LongTimeout()
    timeout.set(() => {
      Logger.info(`[ShareManager] Removing expired media item share "${mediaItemShare.id}"`)
      void this.removeMediaItemShare(mediaItemShare.id)
    }, expiresAtDuration)
    this.openMediaItemShares.push({ id: mediaItemShare.id, mediaItemShare: mediaItemShare.toJSON() as ShareObject, timeout })
    Logger.info(`[ShareManager] Scheduled media item share "${mediaItemShare.id}" to expire in ${elapsedPretty(expiresAtDuration / 1000)}`)
  }

  /**
   *
   * @param {import('../models/MediaItemShare').MediaItemShareModel} mediaItemShare
   */
  openMediaItemShare(mediaItemShare: MediaItemShare) {
    if (mediaItemShare.expiresAt) {
      this.scheduleMediaItemShare(mediaItemShare)
    } else {
      this.openMediaItemShares.push({ id: mediaItemShare.id, mediaItemShare: mediaItemShare.toJSON() as ShareObject })
    }
    SocketAuthority.adminEmitter('share_open', mediaItemShare.toJSONForClient())
  }

  /**
   *
   * @param {string} mediaItemShareId
   */
  async removeMediaItemShare(mediaItemShareId: string) {
    const mediaItemShare = this.openMediaItemShares.find((s) => s.id === mediaItemShareId)
    if (!mediaItemShare) return

    if (mediaItemShare.timeout) {
      mediaItemShare.timeout.clear()
    }

    this.openMediaItemShares = this.openMediaItemShares.filter((s) => s.id !== mediaItemShareId)
    this.openSharePlaybackSessions = this.openSharePlaybackSessions.filter((s) => s.mediaItemShareId !== mediaItemShareId)
    await this.destroyMediaItemShare(mediaItemShareId)

    const mediaItemShareObjectForClient = { ...mediaItemShare.mediaItemShare }
    delete mediaItemShareObjectForClient.pash
    delete mediaItemShareObjectForClient.userId
    delete mediaItemShareObjectForClient.extraData
    SocketAuthority.adminEmitter('share_closed', mediaItemShareObjectForClient)
  }

  /**
   *
   * @param {string} mediaItemShareId
   */
  destroyMediaItemShare(mediaItemShareId: string) {
    return Database.models.mediaItemShare!.destroy({ where: { id: mediaItemShareId } })
  }

  /**
   * Close open share sessions that have not been updated in the last 24 hours
   */
  closeStaleOpenShareSessions() {
    const updatedAtTimeCutoff = Date.now() - 1000 * 60 * 60 * 24
    const staleSessions = this.openSharePlaybackSessions.filter((session) => session.updatedAt! < updatedAtTimeCutoff)
    for (const session of staleSessions) {
      const sessionLastUpdate = new Date(session.updatedAt!)
      Logger.info(`[PlaybackSessionManager] Closing stale session "${session.displayTitle}" (${session.id}) last updated at ${String(sessionLastUpdate)}`)
      this.closeSharePlaybackSession(session)
    }
  }
}
const shareManager = new ShareManager()
export = shareManager
