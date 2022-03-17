const Logger = require('../Logger')

class AudiobookController {
  constructor() { }

  async findOne(req, res) {
    if (req.query.expanded == 1) return res.json(req.audiobook.toJSONExpanded())
    return res.json(req.audiobook)
  }

  async findWithItem(req, res) {
    if (req.query.expanded == 1) {
      return res.json({
        libraryItem: req.libraryItem.toJSONExpanded(),
        audiobook: req.audiobook.toJSONExpanded()
      })
    }
    res.json({
      libraryItem: req.libraryItem.toJSON(),
      audiobook: req.audiobook.toJSON()
    })
  }

  // PATCH: api/audiobooks/:id/tracks
  async updateTracks(req, res) {
    var libraryItem = req.libraryItem
    var audiobook = req.audiobook
    var orderedFileData = req.body.orderedFileData
    audiobook.updateAudioTracks(orderedFileData)
    await this.db.updateLibraryItem(libraryItem)
    this.emitter('item_updated', libraryItem.toJSONExpanded())
    res.json(libraryItem.toJSON())
  }

  middleware(req, res, next) {
    var audiobook = null
    var libraryItem = this.db.libraryItems.find(li => {
      if (li.mediaType != 'book') return false
      audiobook = li.media.getAudiobookById(req.params.id)
      return !!audiobook
    })
    if (!audiobook) return res.sendStatus(404)

    if (req.method == 'DELETE' && !req.user.canDelete) {
      Logger.warn(`[AudiobookController] User attempted to delete without permission`, req.user)
      return res.sendStatus(403)
    } else if ((req.method == 'PATCH' || req.method == 'POST') && !req.user.canUpdate) {
      Logger.warn('[AudiobookController] User attempted to update without permission', req.user)
      return res.sendStatus(403)
    }

    req.libraryItem = libraryItem
    req.audiobook = audiobook
    next()
  }
}
module.exports = new AudiobookController()