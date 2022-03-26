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
  async removeMediaProgress(req, res) {
    var wasRemoved = req.user.removeMediaProgress(req.params.id)
    if (!wasRemoved) {
      return res.sendStatus(200)
    }
    await this.db.updateEntity('user', req.user)
    // this.clientEmitter(req.user.id, 'user_item_progress_updated', { id: libraryItem.id, data: null })

    this.clientEmitter(req.user.id, 'user_updated', req.user.toJSONForBrowser())
    res.sendStatus(200)
  }

  // PATCH: api/me/progress/:id
  async createUpdateMediaProgress(req, res) {
    var libraryItem = this.db.libraryItems.find(ab => ab.id === req.params.id)
    if (!libraryItem) {
      return res.status(404).send('Item not found')
    }
    var wasUpdated = req.user.createUpdateMediaProgress(libraryItem, req.body)
    if (wasUpdated) {
      await this.db.updateEntity('user', req.user)
      this.clientEmitter(req.user.id, 'user_updated', req.user.toJSONForBrowser())
    }
    res.sendStatus(200)
  }

  // PATCH: api/me/progress/batch/update
  async batchUpdateMediaProgress(req, res) {
    var itemProgressPayloads = req.body
    if (!itemProgressPayloads || !itemProgressPayloads.length) {
      return res.sendStatus(500)
    }

    var shouldUpdate = false
    itemProgressPayloads.forEach((itemProgress) => {
      var libraryItem = this.db.libraryItems.find(li => li.id === itemProgress.id) // Make sure this library item exists
      if (libraryItem) {
        var wasUpdated = req.user.createUpdateMediaProgress(libraryItem, itemProgress)
        if (wasUpdated) shouldUpdate = true
      } else {
        Logger.error(`[MeController] batchUpdateMediaProgress: Library Item does not exist ${itemProgress.id}`)
      }
    })

    if (shouldUpdate) {
      await this.db.updateEntity('user', req.user)
      this.clientEmitter(req.user.id, 'user_updated', req.user.toJSONForBrowser())
    }

    res.sendStatus(200)
  }

  // POST: api/me/item/:id/bookmark
  async createBookmark(req, res) {
    var libraryItem = this.db.libraryItems.find(li => li.id === req.params.id)
    if (!libraryItem) return res.sendStatus(404)
    const { time, title } = req.body
    var bookmark = req.user.createBookmark(libraryItem.id, time, title)
    await this.db.updateEntity('user', req.user)
    this.clientEmitter(req.user.id, 'user_updated', req.user.toJSONForBrowser())
    res.json(bookmark)
  }

  // PATCH: api/me/item/:id/bookmark
  async updateBookmark(req, res) {
    var libraryItem = this.db.libraryItems.find(li => li.id === req.params.id)
    if (!libraryItem) return res.sendStatus(404)
    const { time, title } = req.body
    if (!req.user.findBookmark(libraryItem.id, time)) {
      Logger.error(`[MeController] updateBookmark not found`)
      return res.sendStatus(404)
    }
    var bookmark = req.user.updateBookmark(libraryItem.id, time, title)
    if (!bookmark) return res.sendStatus(500)
    await this.db.updateEntity('user', req.user)
    this.clientEmitter(req.user.id, 'user_updated', req.user.toJSONForBrowser())
    res.json(bookmark)
  }

  // DELETE: api/me/item/:id/bookmark/:time
  async removeBookmark(req, res) {
    var libraryItem = this.db.libraryItems.find(li => li.id === req.params.id)
    if (!libraryItem) return res.sendStatus(404)
    var time = Number(req.params.time)
    if (isNaN(time)) return res.sendStatus(500)

    if (!req.user.findBookmark(libraryItem.id, time)) {
      Logger.error(`[MeController] removeBookmark not found`)
      return res.sendStatus(404)
    }
    req.user.removeBookmark(libraryItem.id, time)
    await this.db.updateEntity('user', req.user)
    this.clientEmitter(req.user.id, 'user_updated', req.user.toJSONForBrowser())
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