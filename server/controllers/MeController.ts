import type { Request, Response } from 'express'
import type User from '../models/User'
import type Auth from '../Auth'
import type EmailSettings from '../objects/settings/EmailSettings'
import type LibraryItem from '../models/LibraryItem'
import type Podcast from '../models/Podcast'
import type PodcastEpisode from '../models/PodcastEpisode'
import { Op } from 'sequelize'
import Logger from '../Logger'
import SocketAuthority from '../SocketAuthority'
import Database from '../Database'
import { sort } from '../libs/fastSort'
import { toNumber, isNullOrNaN, isUUID } from '../utils/index'
import userStats from '../utils/queries/userStats'
import parseUserAgent from '../utils/parsers/parseUserAgent'

type MeRequest<Body = unknown> = Request<Record<string, string>, unknown, Body, { page?: string; itemsPerPage?: string; limit?: string }> & { user: User }
type BookmarkBody = { time: number; title?: string }
type EReaderDevice = Parameters<EmailSettings['checkUserCanAccessDevice']>[0]
type ListeningSessions = Exclude<Awaited<ReturnType<typeof Database.getPlaybackSessions>>, false>
type ListeningContext = {
  getUserListeningSessionsHelper(userId: string): Promise<ListeningSessions>
  getUserItemListeningSessionsHelper(userId: string, mediaItemId: string | null): Promise<ListeningSessions>
  getUserListeningStatsHelpers(userId: string): Promise<unknown>
}
type InProgressItem = LibraryItem.MinifiedJSON & { recentEpisode?: ReturnType<PodcastEpisode['toOldJSON']>; progressLastUpdate: number }

class MeController {
  constructor() {}

  /**
   * GET: /api/me
   */
  getCurrentUser(req: MeRequest, res: Response) {
    res.json(req.user.toOldJSONForBrowser())
  }

  /**
   * GET: /api/me/sessions
   */
  async getSessions(req: MeRequest, res: Response) {
    const page = Math.max(0, toNumber(req.query.page, 0))
    const itemsPerPage = Math.max(1, toNumber(req.query.itemsPerPage, 10))

    if (req.user.isGuest) {
      return res.json({ sessions: [], total: 0, numPages: 0, page, itemsPerPage })
    }

    const refreshToken = (req.cookies as { refresh_token?: string }).refresh_token || req.headers['x-refresh-token']
    const { rows, count } = await Database.sessionModel.findAndCountAll({
      where: {
        userId: req.user.id,
        expiresAt: { [Op.gt]: new Date() }
      },
      order: [['updatedAt', 'DESC']],
      limit: itemsPerPage,
      offset: itemsPerPage * page
    })

    res.json({
      total: count,
      numPages: Math.ceil(count / itemsPerPage),
      page,
      itemsPerPage,
      sessions: rows.map((session) => ({
        id: session.id,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        // For display convenience
        deviceInfo: parseUserAgent(session.userAgent),
        createdAt: session.createdAt?.valueOf() ?? null,
        updatedAt: session.updatedAt?.valueOf() ?? null,
        current: !!refreshToken && (session.refreshToken === refreshToken || session.lastRefreshToken === refreshToken)
      }))
    })
  }

  /**
   * DELETE: /api/me/sessions/:id
   */
  async deleteSession(req: MeRequest, res: Response) {
    if (req.user.isGuest) {
      return res.sendStatus(403)
    }

    if (!isUUID(req.params.id)) {
      return res.sendStatus(400)
    }

    const session = await Database.sessionModel.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    })

    if (!session) {
      return res.sendStatus(404)
    }

    await Database.sessionModel.destroy({ where: { id: session.id } })
    Logger.info(`[MeController] User ${req.user.username} deleted auth session ${session.id}`)

    res.sendStatus(200)
  }

  /**
   * GET: /api/me/progress
   */
  getAllMediaProgress(req: MeRequest, res: Response) {
    const mediaProgress = req.user.mediaProgresses?.map((mp) => mp.getOldMediaProgress()) || []
    res.json({ mediaProgress })
  }

  /**
   * GET: /api/me/bookmarks
   */
  getAllBookmarks(req: MeRequest, res: Response) {
    const bookmarks = req.user.bookmarks?.map((bookmark) => ({ ...bookmark })) || []
    res.json({ bookmarks })
  }

  /**
   * GET: /api/me/bookmarks/:libraryItemId
   */
  async getBookmarksForLibraryItem(req: MeRequest, res: Response) {
    const libraryItem = await Database.libraryItemModel.getExpandedById(req.params.libraryItemId)
    if (!libraryItem) {
      return res.sendStatus(404)
    }

    if (!req.user.checkCanAccessLibraryItem(libraryItem)) {
      Logger.error(`[MeController] User "${req.user.username}" attempted to access bookmarks for library item "${req.params.libraryItemId}" without access`)
      return res.sendStatus(403)
    }

    const bookmarks = req.user.bookmarks?.filter((bookmark) => bookmark.libraryItemId === libraryItem.id).map((bookmark) => ({ ...bookmark })) || []
    res.json({ bookmarks })
  }

  /**
   * GET: /api/me/listening-sessions
   */
  async getListeningSessions(this: ListeningContext, req: MeRequest, res: Response) {
    const listeningSessions = await this.getUserListeningSessionsHelper(req.user.id)

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
   */
  async getItemListeningSessions(this: ListeningContext, req: MeRequest, res: Response) {
    const libraryItem = await Database.libraryItemModel.getExpandedById(req.params.libraryItemId)
    const episode = await Database.podcastEpisodeModel.findByPk(req.params.episodeId)

    if (!libraryItem || (libraryItem.isPodcast && !episode)) {
      Logger.error(`[MeController] Media item not found for library item id "${req.params.libraryItemId}"`)
      return res.sendStatus(404)
    }

    // Check if user has access to this library item
    if (!req.user.checkCanAccessLibraryItem(libraryItem)) {
      Logger.error(`[MeController] User "${req.user.username}" attempted to access listening sessions for library item "${req.params.libraryItemId}" without access`)
      return res.sendStatus(403)
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

  /**
   * GET: /api/me/listening-stats
   */
  async getListeningStats(this: ListeningContext, req: MeRequest, res: Response) {
    const listeningStats = await this.getUserListeningStatsHelpers(req.user.id)
    res.json(listeningStats)
  }

  /**
   * GET: /api/me/progress/:id/:episodeId?
   */
  async getMediaProgress(req: MeRequest, res: Response) {
    const mediaProgress = req.user.getOldMediaProgress(req.params.id, req.params.episodeId || null)
    if (!mediaProgress) {
      return res.sendStatus(404)
    }
    res.json(mediaProgress)
    return Promise.resolve()
  }

  /**
   * DELETE: /api/me/progress/:id
   */
  async removeMediaProgress(req: MeRequest, res: Response) {
    // Verify the media progress belongs to the current user
    const mediaProgress = req.user.mediaProgresses!.find((mp) => mp.id === req.params.id)
    if (!mediaProgress) {
      Logger.error(`[MeController] Media progress not found or does not belong to user "${req.user.username}"`)
      return res.sendStatus(404)
    }

    await Database.mediaProgressModel.removeById(req.params.id)
    req.user.mediaProgresses = req.user.mediaProgresses!.filter((mp) => mp.id !== req.params.id)

    SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.user.toOldJSONForBrowser())
    res.sendStatus(200)
  }

  /**
   * PATCH: /api/me/progress/:libraryItemId/:episodeId?
   * TODO: Update to use mediaItemId and mediaItemType
   */
  async createUpdateMediaProgress(req: MeRequest<Partial<User.ProgressUpdatePayload>>, res: Response) {
    const progressUpdatePayload = {
      ...req.body,
      libraryItemId: req.params.libraryItemId,
      episodeId: req.params.episodeId
    }
    const mediaProgressResponse = await req.user.createUpdateMediaProgressFromPayload(progressUpdatePayload)
    if (mediaProgressResponse.error) {
      return res.status(mediaProgressResponse.statusCode || 400).send(mediaProgressResponse.error)
    }

    SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.user.toOldJSONForBrowser())
    res.sendStatus(200)
  }

  /**
   * PATCH: /api/me/progress/batch/update
   * TODO: Update to use mediaItemId and mediaItemType
   */
  async batchUpdateMediaProgress(req: MeRequest<User.ProgressUpdatePayload[]>, res: Response) {
    const itemProgressPayloads = req.body
    if (!itemProgressPayloads?.length) {
      return res.status(400).send('Missing request payload')
    }

    let hasUpdated = false
    for (const itemProgress of itemProgressPayloads) {
      const mediaProgressResponse = await req.user.createUpdateMediaProgressFromPayload(itemProgress)
      if (mediaProgressResponse.error) {
        Logger.error(`[MeController] batchUpdateMediaProgress: ${mediaProgressResponse.error}`)
        continue
      } else {
        hasUpdated = true
      }
    }

    if (hasUpdated) {
      SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.user.toOldJSONForBrowser())
    }

    res.sendStatus(200)
  }

  /**
   * POST: /api/me/item/:id/bookmark
   */
  async createBookmark(req: MeRequest<BookmarkBody>, res: Response) {
    const libraryItem = await Database.libraryItemModel.getExpandedById(req.params.id)
    if (!libraryItem) {
      return res.sendStatus(404)
    }

    // Check if user has access to this library item
    if (!req.user.checkCanAccessLibraryItem(libraryItem)) {
      Logger.error(`[MeController] User "${req.user.username}" attempted to create bookmark for library item "${req.params.id}" without access`)
      return res.sendStatus(403)
    }

    const { time, title } = req.body
    if (isNullOrNaN(time)) {
      Logger.error(`[MeController] createBookmark invalid time`, time)
      return res.status(400).send('Invalid time')
    }
    if (!title || typeof title !== 'string') {
      Logger.error(`[MeController] createBookmark invalid title`, title)
      return res.status(400).send('Invalid title')
    }

    const bookmark = await req.user.createBookmark(req.params.id, time, title)
    SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.user.toOldJSONForBrowser())
    res.json(bookmark)
  }

  /**
   * PATCH: /api/me/item/:id/bookmark
   */
  async updateBookmark(req: MeRequest<BookmarkBody>, res: Response) {
    const libraryItem = await Database.libraryItemModel.getExpandedById(req.params.id)
    if (!libraryItem) {
      return res.sendStatus(404)
    }

    // Check if user has access to this library item
    if (!req.user.checkCanAccessLibraryItem(libraryItem)) {
      Logger.error(`[MeController] User "${req.user.username}" attempted to update bookmark for library item "${req.params.id}" without access`)
      return res.sendStatus(403)
    }

    const { time, title } = req.body
    if (isNullOrNaN(time)) {
      Logger.error(`[MeController] updateBookmark invalid time`, time)
      return res.status(400).send('Invalid time')
    }
    if (!title || typeof title !== 'string') {
      Logger.error(`[MeController] updateBookmark invalid title`, title)
      return res.status(400).send('Invalid title')
    }

    const bookmark = await req.user.updateBookmark(req.params.id, time, title)
    if (!bookmark) {
      Logger.error(`[MeController] updateBookmark not found for library item id "${req.params.id}" and time "${time}"`)
      return res.sendStatus(404)
    }

    SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.user.toOldJSONForBrowser())
    res.json(bookmark)
  }

  /**
   * DELETE: /api/me/item/:id/bookmark/:time
   */
  async removeBookmark(req: MeRequest, res: Response) {
    const libraryItem = await Database.libraryItemModel.getExpandedById(req.params.id)
    if (!libraryItem) {
      return res.sendStatus(404)
    }

    // Check if user has access to this library item
    if (!req.user.checkCanAccessLibraryItem(libraryItem)) {
      Logger.error(`[MeController] User "${req.user.username}" attempted to remove bookmark for library item "${req.params.id}" without access`)
      return res.sendStatus(403)
    }

    const time = Number(req.params.time)
    if (isNaN(time)) {
      return res.status(400).send('Invalid time')
    }

    if (!req.user.findBookmark(req.params.id, time)) {
      Logger.error(`[MeController] removeBookmark not found`)
      return res.sendStatus(404)
    }

    await req.user.removeBookmark(req.params.id, time)

    SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.user.toOldJSONForBrowser())
    res.sendStatus(200)
  }

  /**
   * PATCH: /api/me/password
   * User change password. Requires current password.
   * Guest users cannot change password.
   *
   * Invalidates all other JWT sessions for the user. If using x-refresh-token, returns new tokens for the current session.
   */
  async updatePassword(this: { auth: Auth }, req: MeRequest<{ password?: string; newPassword?: string }>, res: Response) {
    if (req.user.isGuest) {
      Logger.error(`[MeController] Guest user "${req.user.username}" attempted to change password`)
      return res.sendStatus(403)
    }

    const { password, newPassword } = req.body
    if ((typeof password !== 'string' && password !== null) || (typeof newPassword !== 'string' && newPassword !== null)) {
      return res.status(400).send('Missing or invalid password or new password')
    }

    const result = await this.auth.localAuthStrategy.changePassword(req.user, password, newPassword)

    if ('error' in result && result.error) {
      return res.status(400).send(result.error)
    }

    const shouldReturnTokens = !!req.headers['x-refresh-token']
    const newTokens = await this.auth.invalidateJwtSessionsForUser(req.user, req, res)

    if (newTokens?.accessToken) {
      Logger.info(`[MeController] Invalidated other JWT sessions for user ${req.user.username} after password change`)
      if (shouldReturnTokens) {
        return res.json({
          success: true,
          user: {
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken
          }
        })
      }
    } else {
      Logger.info(`[MeController] Invalidated all JWT sessions for user ${req.user.username} after password change`)
    }

    res.sendStatus(200)
  }

  /**
   * GET: /api/me/items-in-progress
   * Pull items in progress for all libraries
   * Used in Android Auto in progress list since there is no easy library selection
   * TODO: Update to use mediaItemId and mediaItemType. Use sort & limit in query
   */
  async getAllLibraryItemsInProgress(req: MeRequest, res: Response) {
    const limit = !isNaN(Number(req.query.limit)) ? Number(req.query.limit) || 25 : 25

    const mediaProgressesInProgress = req.user.mediaProgresses!.filter((mp) => !mp.isFinished && (mp.currentTime! > 0 || mp.ebookProgress! > 0))

    const libraryItemsIds = [...new Set(mediaProgressesInProgress.map((mp) => mp.extraData?.libraryItemId).filter((id): id is string => Boolean(id)))]
    const libraryItems = await Database.libraryItemModel.findAllExpandedWhere({ id: libraryItemsIds })

    let itemsInProgress: InProgressItem[] = []

    for (const mediaProgress of mediaProgressesInProgress) {
      const oldMediaProgress = mediaProgress.getOldMediaProgress()
      const libraryItem = libraryItems.find((li) => li.id === oldMediaProgress.libraryItemId)
      if (libraryItem) {
        if (oldMediaProgress.episodeId && libraryItem.isPodcast) {
          const episode = (libraryItem.media as Podcast.PodcastExpanded).podcastEpisodes.find((ep) => ep.id === oldMediaProgress.episodeId)
          if (episode) {
            const libraryItemWithEpisode = {
              ...libraryItem.toOldJSONMinified(),
              recentEpisode: episode.toOldJSON(libraryItem.id),
              progressLastUpdate: oldMediaProgress.lastUpdate
            }
            itemsInProgress.push(libraryItemWithEpisode)
          }
        } else if (!oldMediaProgress.episodeId) {
          itemsInProgress.push({
            ...libraryItem.toOldJSONMinified(),
            progressLastUpdate: oldMediaProgress.lastUpdate
          })
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

  /**
   * GET: /api/me/series/:id/remove-from-continue-listening
   */
  async removeSeriesFromContinueListening(req: MeRequest, res: Response) {
    if (!(await Database.seriesModel.checkExistsById(req.params.id))) {
      Logger.error(`[MeController] removeSeriesFromContinueListening: Series ${req.params.id} not found`)
      return res.sendStatus(404)
    }

    const hasUpdated = await req.user.addSeriesToHideFromContinueListening(req.params.id)
    if (hasUpdated) {
      SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.user.toOldJSONForBrowser())
    }
    res.json(req.user.toOldJSONForBrowser())
  }

  /**
   * GET: api/me/series/:id/readd-to-continue-listening
   */
  async readdSeriesFromContinueListening(req: MeRequest, res: Response) {
    if (!(await Database.seriesModel.checkExistsById(req.params.id))) {
      Logger.error(`[MeController] readdSeriesFromContinueListening: Series ${req.params.id} not found`)
      return res.sendStatus(404)
    }

    const hasUpdated = await req.user.removeSeriesFromHideFromContinueListening(req.params.id)
    if (hasUpdated) {
      SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.user.toOldJSONForBrowser())
    }
    res.json(req.user.toOldJSONForBrowser())
  }

  /**
   * GET: api/me/progress/:id/remove-from-continue-listening
   */
  async removeItemFromContinueListening(req: MeRequest, res: Response) {
    const mediaProgress = req.user.mediaProgresses!.find((mp) => mp.id === req.params.id)
    if (!mediaProgress) {
      return res.sendStatus(404)
    }

    // Already hidden
    if (mediaProgress.hideFromContinueListening) {
      return res.json(req.user.toOldJSONForBrowser())
    }

    mediaProgress.hideFromContinueListening = true
    await mediaProgress.save()

    SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.user.toOldJSONForBrowser())

    res.json(req.user.toOldJSONForBrowser())
  }

  /**
   * POST: /api/me/ereader-devices
   */
  async updateUserEReaderDevices(req: MeRequest<{ ereaderDevices?: EReaderDevice[] }>, res: Response) {
    if (!req.body.ereaderDevices || !Array.isArray(req.body.ereaderDevices)) {
      return res.status(400).send('Invalid payload. ereaderDevices array required')
    }

    const userEReaderDevices = req.body.ereaderDevices
    for (const device of userEReaderDevices) {
      if (!device.name || !device.email) {
        return res.status(400).send('Invalid payload. ereaderDevices array items must have name and email')
      } else if (device.availabilityOption !== 'specificUsers' || device.users?.length !== 1 || device.users[0] !== req.user.id) {
        return res.status(400).send('Invalid payload. ereaderDevices array items must have availabilityOption "specificUsers" and only the current user')
      }
    }

    const otherDevices = Database.emailSettings!.ereaderDevices.filter((device) => {
      return !Database.emailSettings!.checkUserCanAccessDevice(device, req.user) || device.users?.length !== 1
    })

    const ereaderDevices = otherDevices.concat(userEReaderDevices)

    // Check for duplicate names
    const nameSet = new Set()
    const hasDupes = ereaderDevices.some((device) => {
      if (nameSet.has(device.name)) {
        return true // Duplicate found
      }
      nameSet.add(device.name)
      return false
    })

    if (hasDupes) {
      return res.status(400).send('Invalid payload. Duplicate "name" field found.')
    }

    const updated = Database.emailSettings!.update({ ereaderDevices })
    if (updated) {
      await Database.updateSetting(Database.emailSettings!)
      SocketAuthority.clientEmitter(req.user.id, 'ereader-devices-updated', {
        ereaderDevices: Database.emailSettings!.getEReaderDevices(req.user)
      })
    }
    res.json({
      ereaderDevices: Database.emailSettings!.getEReaderDevices(req.user)
    })
  }

  /**
   * GET: /api/me/stats/year/:year
   */
  async getStatsForYear(req: MeRequest, res: Response) {
    const year = Number(req.params.year)
    if (isNaN(year) || year < 2000 || year > 9999) {
      Logger.error(`[MeController] Invalid year "${year}"`)
      return res.status(400).send('Invalid year')
    }
    const data = await userStats.getStatsForYear(req.user.id, year)
    res.json(data)
  }
}
export = new MeController()
