const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')
const { sort } = require('../libs/fastSort')
const { toNumber } = require('../utils/index')
const userStats = require('../utils/queries/userStats')

class MeController {
  constructor() {}

  getCurrentUser(req, res) {
    res.json(req.user.toJSONForBrowser())
  }

  // GET: api/me/listening-sessions
  async getListeningSessions(req, res) {
    var listeningSessions = await this.getUserListeningSessionsHelper(req.user.id)

    const itemsPerPage = toNumber(req.query.itemsPerPage, 10) || 10
    const page = toNumber(req.query.page, 0)

    const start = page * itemsPerPage
    const sessions = listeningSessions.slice(start, start + itemsPerPage)

    const payload = {
      total: listeningSessions.length,
      numPages: Math.ceil(listeningSessions.length / itemsPerPage),
      page,
      itemsPerPage,
      sessions
    }

    res.json(payload)
  }

  /**
   * GET: /api/me/item/listening-sessions/:libraryItemId/:episodeId
   *
   * @this import('../routers/ApiRouter')
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async getItemListeningSessions(req, res) {
    const libraryItem = await Database.libraryItemModel.findByPk(req.params.libraryItemId)
    const episode = await Database.podcastEpisodeModel.findByPk(req.params.episodeId)

    if (!libraryItem || (libraryItem.mediaType === 'podcast' && !episode)) {
      Logger.error(`[MeController] Media item not found for library item id "${req.params.libraryItemId}"`)
      return res.sendStatus(404)
    }

    const mediaItemId = episode?.id || libraryItem.mediaId
    let listeningSessions = await this.getUserItemListeningSessionsHelper(req.user.id, mediaItemId)

    const itemsPerPage = toNumber(req.query.itemsPerPage, 10) || 10
    const page = toNumber(req.query.page, 0)

    const start = page * itemsPerPage
    const sessions = listeningSessions.slice(start, start + itemsPerPage)

    const payload = {
      total: listeningSessions.length,
      numPages: Math.ceil(listeningSessions.length / itemsPerPage),
      page,
      itemsPerPage,
      sessions
    }

    res.json(payload)
  }

  // GET: api/me/listening-stats
  async getListeningStats(req, res) {
    const listeningStats = await this.getUserListeningStatsHelpers(req.user.id)
    res.json(listeningStats)
  }

  // GET: api/me/progress/:id/:episodeId?
  async getMediaProgress(req, res) {
    const mediaProgress = req.user.getMediaProgress(req.params.id, req.params.episodeId || null)
    if (!mediaProgress) {
      return res.sendStatus(404)
    }
    res.json(mediaProgress)
  }

  // DELETE: api/me/progress/:id
  async removeMediaProgress(req, res) {
    if (!req.user.removeMediaProgress(req.params.id)) {
      return res.sendStatus(200)
    }
    await Database.removeMediaProgress(req.params.id)
    SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.user.toJSONForBrowser())
    res.sendStatus(200)
  }

  // PATCH: api/me/progress/:id
  async createUpdateMediaProgress(req, res) {
    const libraryItem = await Database.libraryItemModel.getOldById(req.params.id)
    if (!libraryItem) {
      return res.status(404).send('Item not found')
    }

    if (req.user.createUpdateMediaProgress(libraryItem, req.body)) {
      const mediaProgress = req.user.getMediaProgress(libraryItem.id)
      if (mediaProgress) await Database.upsertMediaProgress(mediaProgress)
      SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.user.toJSONForBrowser())
    }
    res.sendStatus(200)
  }

  // PATCH: api/me/progress/:id/:episodeId
  async createUpdateEpisodeMediaProgress(req, res) {
    const episodeId = req.params.episodeId
    const libraryItem = await Database.libraryItemModel.getOldById(req.params.id)
    if (!libraryItem) {
      return res.status(404).send('Item not found')
    }
    if (!libraryItem.media.episodes.find((ep) => ep.id === episodeId)) {
      Logger.error(`[MeController] removeEpisode episode ${episodeId} not found for item ${libraryItem.id}`)
      return res.status(404).send('Episode not found')
    }

    if (req.user.createUpdateMediaProgress(libraryItem, req.body, episodeId)) {
      const mediaProgress = req.user.getMediaProgress(libraryItem.id, episodeId)
      if (mediaProgress) await Database.upsertMediaProgress(mediaProgress)
      SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.user.toJSONForBrowser())
    }
    res.sendStatus(200)
  }

  // PATCH: api/me/progress/batch/update
  async batchUpdateMediaProgress(req, res) {
    const itemProgressPayloads = req.body
    if (!itemProgressPayloads?.length) {
      return res.status(400).send('Missing request payload')
    }

    let shouldUpdate = false
    for (const itemProgress of itemProgressPayloads) {
      const libraryItem = await Database.libraryItemModel.getOldById(itemProgress.libraryItemId)
      if (libraryItem) {
        if (req.user.createUpdateMediaProgress(libraryItem, itemProgress, itemProgress.episodeId)) {
          const mediaProgress = req.user.getMediaProgress(libraryItem.id, itemProgress.episodeId)
          if (mediaProgress) await Database.upsertMediaProgress(mediaProgress)
          shouldUpdate = true
        }
      } else {
        Logger.error(`[MeController] batchUpdateMediaProgress: Library Item does not exist ${itemProgress.id}`)
      }
    }

    if (shouldUpdate) {
      SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.user.toJSONForBrowser())
    }

    res.sendStatus(200)
  }

  // POST: api/me/item/:id/bookmark
  async createBookmark(req, res) {
    if (!(await Database.libraryItemModel.checkExistsById(req.params.id))) return res.sendStatus(404)

    const { time, title } = req.body
    const bookmark = req.user.createBookmark(req.params.id, time, title)
    await Database.updateUser(req.user)
    SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.user.toJSONForBrowser())
    res.json(bookmark)
  }

  // PATCH: api/me/item/:id/bookmark
  async updateBookmark(req, res) {
    if (!(await Database.libraryItemModel.checkExistsById(req.params.id))) return res.sendStatus(404)

    const { time, title } = req.body
    if (!req.user.findBookmark(req.params.id, time)) {
      Logger.error(`[MeController] updateBookmark not found`)
      return res.sendStatus(404)
    }

    const bookmark = req.user.updateBookmark(req.params.id, time, title)
    if (!bookmark) return res.sendStatus(500)

    await Database.updateUser(req.user)
    SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.user.toJSONForBrowser())
    res.json(bookmark)
  }

  // DELETE: api/me/item/:id/bookmark/:time
  async removeBookmark(req, res) {
    if (!(await Database.libraryItemModel.checkExistsById(req.params.id))) return res.sendStatus(404)

    const time = Number(req.params.time)
    if (isNaN(time)) return res.sendStatus(500)

    if (!req.user.findBookmark(req.params.id, time)) {
      Logger.error(`[MeController] removeBookmark not found`)
      return res.sendStatus(404)
    }

    req.user.removeBookmark(req.params.id, time)
    await Database.updateUser(req.user)
    SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.user.toJSONForBrowser())
    res.sendStatus(200)
  }

  // PATCH: api/me/password
  updatePassword(req, res) {
    if (req.user.isGuest) {
      Logger.error(`[MeController] Guest user attempted to change password`, req.user.username)
      return res.sendStatus(500)
    }
    this.auth.userChangePassword(req, res)
  }

  // TODO: Deprecated. Removed from Android. Only used in iOS app now.
  // POST: api/me/sync-local-progress
  async syncLocalMediaProgress(req, res) {
    if (!req.body.localMediaProgress) {
      Logger.error(`[MeController] syncLocalMediaProgress invalid post body`)
      return res.sendStatus(500)
    }
    const updatedLocalMediaProgress = []
    let numServerProgressUpdates = 0
    const updatedServerMediaProgress = []
    const localMediaProgress = req.body.localMediaProgress || []

    for (const localProgress of localMediaProgress) {
      if (!localProgress.libraryItemId) {
        Logger.error(`[MeController] syncLocalMediaProgress invalid local media progress object`, localProgress)
        continue
      }

      const libraryItem = await Database.libraryItemModel.getOldById(localProgress.libraryItemId)
      if (!libraryItem) {
        Logger.error(`[MeController] syncLocalMediaProgress invalid local media progress object no library item with id "${localProgress.libraryItemId}"`, localProgress)
        continue
      }

      let mediaProgress = req.user.getMediaProgress(localProgress.libraryItemId, localProgress.episodeId)
      if (!mediaProgress) {
        // New media progress from mobile
        Logger.debug(`[MeController] syncLocalMediaProgress local progress is new - creating ${localProgress.id}`)
        req.user.createUpdateMediaProgress(libraryItem, localProgress, localProgress.episodeId)
        mediaProgress = req.user.getMediaProgress(localProgress.libraryItemId, localProgress.episodeId)
        if (mediaProgress) await Database.upsertMediaProgress(mediaProgress)
        updatedServerMediaProgress.push(mediaProgress)
        numServerProgressUpdates++
      } else if (mediaProgress.lastUpdate < localProgress.lastUpdate) {
        Logger.debug(`[MeController] syncLocalMediaProgress local progress is more recent - updating ${mediaProgress.id}`)
        req.user.createUpdateMediaProgress(libraryItem, localProgress, localProgress.episodeId)
        mediaProgress = req.user.getMediaProgress(localProgress.libraryItemId, localProgress.episodeId)
        if (mediaProgress) await Database.upsertMediaProgress(mediaProgress)
        updatedServerMediaProgress.push(mediaProgress)
        numServerProgressUpdates++
      } else if (mediaProgress.lastUpdate > localProgress.lastUpdate) {
        const updateTimeDifference = mediaProgress.lastUpdate - localProgress.lastUpdate
        Logger.debug(`[MeController] syncLocalMediaProgress server progress is more recent by ${updateTimeDifference}ms - ${mediaProgress.id}`)

        for (const key in localProgress) {
          // Local media progress ID uses the local library item id and server media progress uses the library item id
          if (key !== 'id' && mediaProgress[key] != undefined && localProgress[key] !== mediaProgress[key]) {
            // Logger.debug(`[MeController] syncLocalMediaProgress key ${key} changed from ${localProgress[key]} to ${mediaProgress[key]} - ${mediaProgress.id}`)
            localProgress[key] = mediaProgress[key]
          }
        }
        updatedLocalMediaProgress.push(localProgress)
      } else {
        Logger.debug(`[MeController] syncLocalMediaProgress server and local are in sync - ${mediaProgress.id}`)
      }
    }

    Logger.debug(`[MeController] syncLocalMediaProgress server updates = ${numServerProgressUpdates}, local updates = ${updatedLocalMediaProgress.length}`)
    if (numServerProgressUpdates > 0) {
      SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.user.toJSONForBrowser())
    }

    res.json({
      numServerProgressUpdates,
      localProgressUpdates: updatedLocalMediaProgress, // Array of LocalMediaProgress that were updated from server (server more recent)
      serverProgressUpdates: updatedServerMediaProgress // Array of MediaProgress that made updates to server (local more recent)
    })
  }

  // GET: api/me/items-in-progress
  async getAllLibraryItemsInProgress(req, res) {
    const limit = !isNaN(req.query.limit) ? Number(req.query.limit) || 25 : 25

    let itemsInProgress = []
    // TODO: More efficient to do this in a single query
    for (const mediaProgress of req.user.mediaProgress) {
      if (!mediaProgress.isFinished && (mediaProgress.progress > 0 || mediaProgress.ebookProgress > 0)) {
        const libraryItem = await Database.libraryItemModel.getOldById(mediaProgress.libraryItemId)
        if (libraryItem) {
          if (mediaProgress.episodeId && libraryItem.mediaType === 'podcast') {
            const episode = libraryItem.media.episodes.find((ep) => ep.id === mediaProgress.episodeId)
            if (episode) {
              const libraryItemWithEpisode = {
                ...libraryItem.toJSONMinified(),
                recentEpisode: episode.toJSON(),
                progressLastUpdate: mediaProgress.lastUpdate
              }
              itemsInProgress.push(libraryItemWithEpisode)
            }
          } else if (!mediaProgress.episodeId) {
            itemsInProgress.push({
              ...libraryItem.toJSONMinified(),
              progressLastUpdate: mediaProgress.lastUpdate
            })
          }
        }
      }
    }

    itemsInProgress = sort(itemsInProgress)
      .desc((li) => li.progressLastUpdate)
      .slice(0, limit)
    res.json({
      libraryItems: itemsInProgress
    })
  }

  // GET: api/me/series/:id/remove-from-continue-listening
  async removeSeriesFromContinueListening(req, res) {
    const series = await Database.seriesModel.getOldById(req.params.id)
    if (!series) {
      Logger.error(`[MeController] removeSeriesFromContinueListening: Series ${req.params.id} not found`)
      return res.sendStatus(404)
    }

    const hasUpdated = req.user.addSeriesToHideFromContinueListening(req.params.id)
    if (hasUpdated) {
      await Database.updateUser(req.user)
      SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.user.toJSONForBrowser())
    }
    res.json(req.user.toJSONForBrowser())
  }

  // GET: api/me/series/:id/readd-to-continue-listening
  async readdSeriesFromContinueListening(req, res) {
    const series = await Database.seriesModel.getOldById(req.params.id)
    if (!series) {
      Logger.error(`[MeController] readdSeriesFromContinueListening: Series ${req.params.id} not found`)
      return res.sendStatus(404)
    }

    const hasUpdated = req.user.removeSeriesFromHideFromContinueListening(req.params.id)
    if (hasUpdated) {
      await Database.updateUser(req.user)
      SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.user.toJSONForBrowser())
    }
    res.json(req.user.toJSONForBrowser())
  }

  // GET: api/me/progress/:id/remove-from-continue-listening
  async removeItemFromContinueListening(req, res) {
    const mediaProgress = req.user.mediaProgress.find((mp) => mp.id === req.params.id)
    if (!mediaProgress) {
      return res.sendStatus(404)
    }
    const hasUpdated = req.user.removeProgressFromContinueListening(req.params.id)
    if (hasUpdated) {
      await Database.mediaProgressModel.update(
        {
          hideFromContinueListening: true
        },
        {
          where: {
            id: mediaProgress.id
          }
        }
      )
      SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.user.toJSONForBrowser())
    }
    res.json(req.user.toJSONForBrowser())
  }

  /**
   * GET: /api/me/stats/year/:year
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async getStatsForYear(req, res) {
    const year = Number(req.params.year)
    if (isNaN(year) || year < 2000 || year > 9999) {
      Logger.error(`[MeController] Invalid year "${year}"`)
      return res.status(400).send('Invalid year')
    }
    const data = await userStats.getStatsForYear(req.user, year)
    res.json(data)
  }
}
module.exports = new MeController()
