const Database = require('../Database')
const Logger = require('../Logger')

/**
 * @typedef OpenMediaItemShareObject
 * @property {string} id
 * @property {import('../models/MediaItemShare').MediaItemShareObject} mediaItemShare
 * @property {NodeJS.Timeout} timeout
 */

class ShareManager {
  constructor() {
    /** @type {OpenMediaItemShareObject[]} */
    this.openMediaItemShares = []
  }

  init() {
    this.loadMediaItemShares()
  }

  /**
   * Find an open media item share by media item ID
   * @param {string} mediaItemId
   * @returns {import('../models/MediaItemShare').MediaItemShareForClient}
   */
  findByMediaItemId(mediaItemId) {
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
  findBySlug(slug) {
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
   * Load all media item shares from the database
   * Remove expired & schedule active
   */
  async loadMediaItemShares() {
    /** @type {import('../models/MediaItemShare').MediaItemShareModel[]} */
    const mediaItemShares = await Database.models.mediaItemShare.findAll()

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
          mediaItemShare: mediaItemShare.toJSON()
        })
      }
    }
  }

  /**
   *
   * @param {import('../models/MediaItemShare').MediaItemShareModel} mediaItemShare
   */
  scheduleMediaItemShare(mediaItemShare) {
    if (!mediaItemShare?.expiresAt) return

    const expiresAtDuration = mediaItemShare.expiresAt.valueOf() - Date.now()
    if (expiresAtDuration <= 0) {
      Logger.warn(`[ShareManager] Attempted to schedule expired media item share "${mediaItemShare.id}"`)
      this.destroyMediaItemShare(mediaItemShare.id)
      return
    }

    const timeout = setTimeout(() => {
      Logger.info(`[ShareManager] Removing expired media item share "${mediaItemShare.id}"`)
      this.removeMediaItemShare(mediaItemShare.id)
    }, expiresAtDuration)
    this.openMediaItemShares.push({ id: mediaItemShare.id, mediaItemShare: mediaItemShare.toJSON(), timeout })
    Logger.info(`[ShareManager] Scheduled media item share "${mediaItemShare.id}" to expire in ${expiresAtDuration}ms`)
  }

  /**
   *
   * @param {import('../models/MediaItemShare').MediaItemShareModel} mediaItemShare
   */
  openMediaItemShare(mediaItemShare) {
    if (mediaItemShare.expiresAt) {
      this.scheduleMediaItemShare(mediaItemShare)
    } else {
      this.openMediaItemShares.push({ id: mediaItemShare.id, mediaItemShare: mediaItemShare.toJSON() })
    }
  }

  /**
   *
   * @param {string} mediaItemShareId
   */
  async removeMediaItemShare(mediaItemShareId) {
    const mediaItemShare = this.openMediaItemShares.find((s) => s.id === mediaItemShareId)
    if (!mediaItemShare) return

    if (mediaItemShare.timeout) {
      clearTimeout(mediaItemShare.timeout)
    }

    this.openMediaItemShares = this.openMediaItemShares.filter((s) => s.id !== mediaItemShareId)
    await this.destroyMediaItemShare(mediaItemShareId)
  }

  /**
   *
   * @param {string} mediaItemShareId
   */
  destroyMediaItemShare(mediaItemShareId) {
    return Database.models.mediaItemShare.destroy({ where: { id: mediaItemShareId } })
  }
}
module.exports = new ShareManager()
