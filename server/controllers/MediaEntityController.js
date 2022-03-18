const Logger = require('../Logger')

class MediaEntityController {
  constructor() { }

  async findOne(req, res) {
    if (req.query.expanded == 1) return res.json(req.mediaEntity.toJSONExpanded())
    return res.json(req.mediaEntity)
  }

  async findWithItem(req, res) {
    if (req.query.expanded == 1) {
      return res.json({
        libraryItem: req.libraryItem.toJSONExpanded(),
        mediaEntity: req.mediaEntity.toJSONExpanded()
      })
    }
    res.json({
      libraryItem: req.libraryItem.toJSON(),
      mediaEntity: req.mediaEntity.toJSON()
    })
  }

  // PATCH: api/entities/:id/tracks
  async updateTracks(req, res) {
    var libraryItem = req.libraryItem
    var mediaEntity = req.mediaEntity
    var orderedFileData = req.body.orderedFileData
    if (!mediaEntity.updateAudioTracks) {
      Logger.error(`[MediaEntityController] updateTracks invalid media entity ${mediaEntity.id}`)
      return res.sendStatus(500)
    }
    mediaEntity.updateAudioTracks(orderedFileData)
    await this.db.updateLibraryItem(libraryItem)
    this.emitter('item_updated', libraryItem.toJSONExpanded())
    res.json(libraryItem.toJSON())
  }

  // POST: api/entities/:id/play
  startPlaybackSession(req, res) {
    if (!req.mediaEntity.isPlaybackMediaEntity) {
      Logger.error(`[MediaEntityController] startPlaybackSession invalid media entity ${req.mediaEntity.id}`)
      return res.sendStatus(500)
    }
    const options = req.body || {}
    this.playbackSessionManager.startSessionRequest(req.user, req.libraryItem, req.mediaEntity, options, res)
  }

  middleware(req, res, next) {
    var mediaEntity = null
    var libraryItem = this.db.libraryItems.find(li => {
      if (li.mediaType != 'book') return false
      mediaEntity = li.media.getMediaEntityById(req.params.id)
      return !!mediaEntity
    })
    if (!mediaEntity) return res.sendStatus(404)

    if (req.method == 'DELETE' && !req.user.canDelete) {
      Logger.warn(`[MediaEntityController] User attempted to delete without permission`, req.user)
      return res.sendStatus(403)
    } else if ((req.method == 'PATCH' || req.method == 'POST') && !req.user.canUpdate) {
      Logger.warn('[MediaEntityController] User attempted to update without permission', req.user)
      return res.sendStatus(403)
    }

    req.mediaEntity = mediaEntity
    req.libraryItem = libraryItem
    next()
  }
}
module.exports = new MediaEntityController()