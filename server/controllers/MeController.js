const Logger = require('../Logger')
const { isObject } = require('../utils/index')

class MeController {
  constructor() { }

  // GET: api/me/listening-sessions
  async getListeningSessions(req, res) {
    var listeningSessions = await this.getUserListeningSessionsHelper(req.user.id)
    res.json(listeningSessions.slice(0, 10))
  }

  // GET: api/me/listening-stats
  async getListeningStats(req, res) {
    var listeningStats = await this.getUserListeningStatsHelpers(req.user.id)
    res.json(listeningStats)
  }

  // DELETE: api/me/progress/:id
  async removeLibraryItemProgress(req, res) {
    var wasRemoved = req.user.removeLibraryItemProgress(req.params.id)
    if (!wasRemoved) {
      return res.sendStatus(200)
    }
    await this.db.updateEntity('user', req.user)
    this.clientEmitter(req.user.id, 'user_item_progress_updated', { id: libraryItem.id, data: null })

    this.clientEmitter(req.user.id, 'user_updated', req.user.toJSONForBrowser())
    res.sendStatus(200)
  }

  // PATCH: api/me/progress/:id
  async createUpdateLibraryItemProgress(req, res) {
    var libraryItem = this.db.libraryItems.find(ab => ab.id === req.params.id)
    if (!libraryItem) {
      return res.status(404).send('Item not found')
    }
    var wasUpdated = req.user.createUpdateLibraryItemProgress(libraryItem.id, req.body)
    if (wasUpdated) {
      await this.db.updateEntity('user', req.user)
      this.clientEmitter(req.user.id, 'user_updated', req.user.toJSONForBrowser())
    }
    res.sendStatus(200)
  }

  // PATCH: api/me/progress/batch/update
  async batchUpdateLibraryItemProgress(req, res) {
    var itemProgressPayloads = req.body
    if (!itemProgressPayloads || !itemProgressPayloads.length) {
      return res.sendStatus(500)
    }

    var shouldUpdate = false
    itemProgressPayloads.forEach((itemProgress) => {
      var libraryItem = this.db.libraryItems.find(li => li.id === itemProgress.id) // Make sure this library item exists
      if (libraryItem) {
        var wasUpdated = req.user.createUpdateLibraryItemProgress(libraryItem.id, itemProgress)
        if (wasUpdated) shouldUpdate = true
      } else {
        Logger.error(`[MeController] batchUpdateLibraryItemProgress: Library Item does not exist ${itemProgress.id}`)
      }
    })

    if (shouldUpdate) {
      await this.db.updateEntity('user', req.user)
      this.clientEmitter(req.user.id, 'user_updated', req.user.toJSONForBrowser())
    }

    res.sendStatus(200)
  }

  // PATCH: api/me/password
  updatePassword(req, res) {
    this.auth.userChangePassword(req, res)
  }

  // PATCH: api/me/settings
  async updateSettings(req, res) {
    var settingsUpdate = req.body
    if (!settingsUpdate || !isObject(settingsUpdate)) {
      return res.sendStatus(500)
    }
    var madeUpdates = req.user.updateSettings(settingsUpdate)
    if (madeUpdates) {
      await this.db.updateEntity('user', req.user)
    }
    return res.json({
      success: true,
      settings: req.user.settings
    })
  }
}
module.exports = new MeController()