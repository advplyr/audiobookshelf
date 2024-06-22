const Logger = require('../Logger')
const Database = require('../Database')
const { Op } = require('sequelize')

const ShareManager = require('../managers/ShareManager')

class ShareController {
  constructor() {}

  /**
   * Public route
   * GET: /api/share/mediaitem/:slug
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
      const mediaItemModel = mediaItemShare.mediaItemType === 'book' ? Database.bookModel : Database.podcastEpisodeModel
      mediaItemShare.mediaItem = await mediaItemModel.findByPk(mediaItemShare.mediaItemId)

      if (!mediaItemShare.mediaItem) {
        return res.status(404).send('Media item not found')
      }
      res.json(mediaItemShare)
    } catch (error) {
      Logger.error(`[ShareController] Failed`, error)
      res.status(500).send('Internal server error')
    }
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
      const existingMediaItemShare = await Database.models.mediaItemShare.findOne({
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

      const mediaItemShare = await Database.models.mediaItemShare.create({
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
      const mediaItemShare = await Database.models.mediaItemShare.findByPk(req.params.id)
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
