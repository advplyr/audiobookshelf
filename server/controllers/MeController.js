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

  // PATCH: api/me/progress/:id/:episodeId
  async createUpdateEpisodeMediaProgress(req, res) {
    var episodeId = req.params.episodeId
    var libraryItem = this.db.libraryItems.find(ab => ab.id === req.params.id)
    if (!libraryItem) {
      return res.status(404).send('Item not found')
    }
    if (!libraryItem.media.episodes.find(ep => ep.id === episodeId)) {
      Logger.error(`[MeController] removeEpisode episode ${episodeId} not found for item ${libraryItem.id}`)
      return res.status(404).send('Episode not found')
    }

    var wasUpdated = req.user.createUpdateMediaProgress(libraryItem, req.body, episodeId)
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

  // POST: api/me/sync-local-progress
  async syncLocalMediaProgress(req, res) {
    if (!req.body.localMediaProgress) {
      Logger.error(`[MeController] syncLocalMediaProgress invalid post body`)
      return res.sendStatus(500)
    }
    const updatedLocalMediaProgress = []
    var numServerProgressUpdates = 0
    var localMediaProgress = req.body.localMediaProgress || []
    localMediaProgress.forEach(localProgress => {
      if (!localProgress.libraryItemId) {
        Logger.error(`[MeController] syncLocalMediaProgress invalid local media progress object`, localProgress)
        return
      }
      var libraryItem = this.db.getLibraryItem(localProgress.libraryItemId)
      if (!libraryItem) {
        Logger.error(`[MeController] syncLocalMediaProgress invalid local media progress object no library item`, localProgress)
        return
      }

      var mediaProgress = req.user.getMediaProgress(localProgress.libraryItemId, localProgress.episodeId)
      if (!mediaProgress) {
        // New media progress from mobile
        Logger.debug(`[MeController] syncLocalMediaProgress local progress is new - creating ${localProgress.id}`)
        req.user.createUpdateMediaProgress(libraryItem, localProgress, localProgress.episodeId)
        numServerProgressUpdates++
      } else if (mediaProgress.lastUpdate < localProgress.lastUpdate) {
        Logger.debug(`[MeController] syncLocalMediaProgress local progress is more recent - updating ${mediaProgress.id}`)
        req.user.createUpdateMediaProgress(libraryItem, localProgress, localProgress.episodeId)
        numServerProgressUpdates++
      } else if (mediaProgress.lastUpdate > localProgress.lastUpdate) {
        var updateTimeDifference = mediaProgress.lastUpdate - localProgress.lastUpdate
        Logger.debug(`[MeController] syncLocalMediaProgress server progress is more recent by ${updateTimeDifference}ms - ${mediaProgress.id}`)

        for (const key in localProgress) {
          if (mediaProgress[key] != undefined && localProgress[key] !== mediaProgress[key]) {
            // Logger.debug(`[MeController] syncLocalMediaProgress key ${key} changed from ${localProgress[key]} to ${mediaProgress[key]} - ${mediaProgress.id}`)
            localProgress[key] = mediaProgress[key]
          }
        }
        updatedLocalMediaProgress.push(localProgress)
      } else {
        Logger.debug(`[MeController] syncLocalMediaProgress server and local are in sync - ${mediaProgress.id}`)
      }
    })

    Logger.debug(`[MeController] syncLocalMediaProgress server updates = ${numServerProgressUpdates}, local updates = ${updatedLocalMediaProgress.length}`)
    if (numServerProgressUpdates > 0) {
      await this.db.updateEntity('user', req.user)
      this.clientEmitter(req.user.id, 'user_updated', req.user.toJSONForBrowser())
    }

    res.json({
      numServerProgressUpdates,
      localProgressUpdates: updatedLocalMediaProgress
    })
  }
}
module.exports = new MeController()