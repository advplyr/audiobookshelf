const { Request, Response, NextFunction } = require('express')
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')

const fs = require('../libs/fsExtra')

const { getPodcastFeed, findMatchingEpisodes } = require('../utils/podcastUtils')
const { getFileTimestampsWithIno, filePathToPOSIX } = require('../utils/fileUtils')
const { validateUrl } = require('../utils/index')

const Scanner = require('../scanner/Scanner')
const CoverManager = require('../managers/CoverManager')

const LibraryItem = require('../objects/LibraryItem')

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 */

class PodcastController {
  /**
   * POST /api/podcasts
   * Create podcast
   *
   * @this import('../routers/ApiRouter')
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async create(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[PodcastController] Non-admin user "${req.user.username}" attempted to create podcast`)
      return res.sendStatus(403)
    }
    const payload = req.body

    const library = await Database.libraryModel.findByIdWithFolders(payload.libraryId)
    if (!library) {
      Logger.error(`[PodcastController] Create: Library not found "${payload.libraryId}"`)
      return res.status(404).send('Library not found')
    }

    const folder = library.libraryFolders.find((fold) => fold.id === payload.folderId)
    if (!folder) {
      Logger.error(`[PodcastController] Create: Folder not found "${payload.folderId}"`)
      return res.status(404).send('Folder not found')
    }

    const podcastPath = filePathToPOSIX(payload.path)

    // Check if a library item with this podcast folder exists already
    const existingLibraryItem =
      (await Database.libraryItemModel.count({
        where: {
          path: podcastPath
        }
      })) > 0
    if (existingLibraryItem) {
      Logger.error(`[PodcastController] Podcast already exists at path "${podcastPath}"`)
      return res.status(400).send('Podcast already exists')
    }

    const success = await fs
      .ensureDir(podcastPath)
      .then(() => true)
      .catch((error) => {
        Logger.error(`[PodcastController] Failed to ensure podcast dir "${podcastPath}"`, error)
        return false
      })
    if (!success) return res.status(400).send('Invalid podcast path')

    const libraryItemFolderStats = await getFileTimestampsWithIno(podcastPath)

    let relPath = payload.path.replace(folder.fullPath, '')
    if (relPath.startsWith('/')) relPath = relPath.slice(1)

    const libraryItemPayload = {
      path: podcastPath,
      relPath,
      folderId: payload.folderId,
      libraryId: payload.libraryId,
      ino: libraryItemFolderStats.ino,
      mtimeMs: libraryItemFolderStats.mtimeMs || 0,
      ctimeMs: libraryItemFolderStats.ctimeMs || 0,
      birthtimeMs: libraryItemFolderStats.birthtimeMs || 0,
      media: payload.media
    }

    const libraryItem = new LibraryItem()
    libraryItem.setData('podcast', libraryItemPayload)

    // Download and save cover image
    if (payload.media.metadata.imageUrl) {
      // TODO: Scan cover image to library files
      // Podcast cover will always go into library item folder
      const coverResponse = await CoverManager.downloadCoverFromUrl(libraryItem, payload.media.metadata.imageUrl, true)
      if (coverResponse) {
        if (coverResponse.error) {
          Logger.error(`[PodcastController] Download cover error from "${payload.media.metadata.imageUrl}": ${coverResponse.error}`)
        } else if (coverResponse.cover) {
          libraryItem.media.coverPath = coverResponse.cover
        }
      }
    }

    await Database.createLibraryItem(libraryItem)
    SocketAuthority.emitter('item_added', libraryItem.toJSONExpanded())

    res.json(libraryItem.toJSONExpanded())

    if (payload.episodesToDownload?.length) {
      Logger.info(`[PodcastController] Podcast created now starting ${payload.episodesToDownload.length} episode downloads`)
      this.podcastManager.downloadPodcastEpisodes(libraryItem, payload.episodesToDownload)
    }

    // Turn on podcast auto download cron if not already on
    if (libraryItem.media.autoDownloadEpisodes) {
      this.cronManager.checkUpdatePodcastCron(libraryItem)
    }
  }

  /**
   * POST: /api/podcasts/feed
   *
   * @typedef getPodcastFeedReqBody
   * @property {string} rssFeed
   *
   * @param {Request<{}, {}, getPodcastFeedReqBody, {}> & RequestUserObject} req
   * @param {Response} res
   */
  async getPodcastFeed(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[PodcastController] Non-admin user "${req.user.username}" attempted to get podcast feed`)
      return res.sendStatus(403)
    }

    const url = validateUrl(req.body.rssFeed)
    if (!url) {
      return res.status(400).send('Invalid request body. "rssFeed" must be a valid URL')
    }

    const podcast = await getPodcastFeed(url)
    if (!podcast) {
      return res.status(404).send('Podcast RSS feed request failed or invalid response data')
    }
    res.json({ podcast })
  }

  /**
   * POST: /api/podcasts/opml
   *
   * @this import('../routers/ApiRouter')
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getFeedsFromOPMLText(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[PodcastController] Non-admin user "${req.user.username}" attempted to get feeds from opml`)
      return res.sendStatus(403)
    }

    if (!req.body.opmlText) {
      return res.sendStatus(400)
    }

    res.json({
      feeds: this.podcastManager.getParsedOPMLFileFeeds(req.body.opmlText)
    })
  }

  /**
   * POST: /api/podcasts/opml/create
   *
   * @this import('../routers/ApiRouter')
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async bulkCreatePodcastsFromOpmlFeedUrls(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[PodcastController] Non-admin user "${req.user.username}" attempted to bulk create podcasts`)
      return res.sendStatus(403)
    }

    const rssFeeds = req.body.feeds
    if (!Array.isArray(rssFeeds) || !rssFeeds.length || rssFeeds.some((feed) => !validateUrl(feed))) {
      return res.status(400).send('Invalid request body. "feeds" must be an array of RSS feed URLs')
    }

    const libraryId = req.body.libraryId
    const folderId = req.body.folderId
    if (!libraryId || !folderId) {
      return res.status(400).send('Invalid request body. "libraryId" and "folderId" are required')
    }

    const folder = await Database.libraryFolderModel.findByPk(folderId)
    if (!folder || folder.libraryId !== libraryId) {
      return res.status(404).send('Folder not found')
    }
    const autoDownloadEpisodes = !!req.body.autoDownloadEpisodes
    this.podcastManager.createPodcastsFromFeedUrls(rssFeeds, folder, autoDownloadEpisodes, this.cronManager)

    res.sendStatus(200)
  }

  /**
   * GET: /api/podcasts/:id/checknew
   *
   * @this import('../routers/ApiRouter')
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async checkNewEpisodes(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[PodcastController] Non-admin user "${req.user.username}" attempted to check/download episodes`)
      return res.sendStatus(403)
    }

    var libraryItem = req.libraryItem
    if (!libraryItem.media.metadata.feedUrl) {
      Logger.error(`[PodcastController] checkNewEpisodes no feed url for item ${libraryItem.id}`)
      return res.status(500).send('Podcast has no rss feed url')
    }

    const maxEpisodesToDownload = !isNaN(req.query.limit) ? Number(req.query.limit) : 3

    var newEpisodes = await this.podcastManager.checkAndDownloadNewEpisodes(libraryItem, maxEpisodesToDownload)
    res.json({
      episodes: newEpisodes || []
    })
  }

  /**
   * GET: /api/podcasts/:id/clear-queue
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  clearEpisodeDownloadQueue(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[PodcastController] Non-admin user "${req.user.username}" attempting to clear download queue`)
      return res.sendStatus(403)
    }
    this.podcastManager.clearDownloadQueue(req.params.id)
    res.sendStatus(200)
  }

  /**
   * GET: /api/podcasts/:id/downloads
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  getEpisodeDownloads(req, res) {
    var libraryItem = req.libraryItem

    var downloadsInQueue = this.podcastManager.getEpisodeDownloadsInQueue(libraryItem.id)
    res.json({
      downloads: downloadsInQueue.map((d) => d.toJSONForClient())
    })
  }

  async findEpisode(req, res) {
    const rssFeedUrl = req.libraryItem.media.metadata.feedUrl
    if (!rssFeedUrl) {
      Logger.error(`[PodcastController] findEpisode: Podcast has no feed url`)
      return res.status(500).send('Podcast does not have an RSS feed URL')
    }

    const searchTitle = req.query.title
    if (!searchTitle || typeof searchTitle !== 'string') {
      return res.sendStatus(500)
    }
    const episodes = await findMatchingEpisodes(rssFeedUrl, searchTitle)
    res.json({
      episodes: episodes || []
    })
  }

  /**
   * POST: /api/podcasts/:id/download-episodes
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async downloadEpisodes(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[PodcastController] Non-admin user "${req.user.username}" attempted to download episodes`)
      return res.sendStatus(403)
    }
    const libraryItem = req.libraryItem
    const episodes = req.body
    if (!episodes?.length) {
      return res.sendStatus(400)
    }

    this.podcastManager.downloadPodcastEpisodes(libraryItem, episodes)
    res.sendStatus(200)
  }

  /**
   * POST: /api/podcasts/:id/match-episodes
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async quickMatchEpisodes(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[PodcastController] Non-admin user "${req.user.username}" attempted to download episodes`)
      return res.sendStatus(403)
    }

    const overrideDetails = req.query.override === '1'
    const episodesUpdated = await Scanner.quickMatchPodcastEpisodes(req.libraryItem, { overrideDetails })
    if (episodesUpdated) {
      await Database.updateLibraryItem(req.libraryItem)
      SocketAuthority.emitter('item_updated', req.libraryItem.toJSONExpanded())
    }

    res.json({
      numEpisodesUpdated: episodesUpdated
    })
  }

  /**
   * PATCH: /api/podcasts/:id/episode/:episodeId
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async updateEpisode(req, res) {
    const libraryItem = req.libraryItem

    var episodeId = req.params.episodeId
    if (!libraryItem.media.checkHasEpisode(episodeId)) {
      return res.status(404).send('Episode not found')
    }

    if (libraryItem.media.updateEpisode(episodeId, req.body)) {
      await Database.updateLibraryItem(libraryItem)
      SocketAuthority.emitter('item_updated', libraryItem.toJSONExpanded())
    }

    res.json(libraryItem.toJSONExpanded())
  }

  /**
   * GET: /api/podcasts/:id/episode/:episodeId
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getEpisode(req, res) {
    const episodeId = req.params.episodeId
    const libraryItem = req.libraryItem

    const episode = libraryItem.media.episodes.find((ep) => ep.id === episodeId)
    if (!episode) {
      Logger.error(`[PodcastController] getEpisode episode ${episodeId} not found for item ${libraryItem.id}`)
      return res.sendStatus(404)
    }

    res.json(episode)
  }

  /**
   * DELETE: /api/podcasts/:id/episode/:episodeId
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async removeEpisode(req, res) {
    const episodeId = req.params.episodeId
    const libraryItem = req.libraryItem
    const hardDelete = req.query.hard === '1'

    const episode = libraryItem.media.episodes.find((ep) => ep.id === episodeId)
    if (!episode) {
      Logger.error(`[PodcastController] removeEpisode episode ${episodeId} not found for item ${libraryItem.id}`)
      return res.sendStatus(404)
    }

    if (hardDelete) {
      const audioFile = episode.audioFile
      // TODO: this will trigger the watcher. should maybe handle this gracefully
      await fs
        .remove(audioFile.metadata.path)
        .then(() => {
          Logger.info(`[PodcastController] Hard deleted episode file at "${audioFile.metadata.path}"`)
        })
        .catch((error) => {
          Logger.error(`[PodcastController] Failed to hard delete episode file at "${audioFile.metadata.path}"`, error)
        })
    }

    // Remove episode from Podcast and library file
    const episodeRemoved = libraryItem.media.removeEpisode(episodeId)
    if (episodeRemoved?.audioFile) {
      libraryItem.removeLibraryFile(episodeRemoved.audioFile.ino)
    }

    // Update/remove playlists that had this podcast episode
    const playlistMediaItems = await Database.playlistMediaItemModel.findAll({
      where: {
        mediaItemId: episodeId
      },
      include: {
        model: Database.playlistModel,
        include: Database.playlistMediaItemModel
      }
    })
    for (const pmi of playlistMediaItems) {
      const numItems = pmi.playlist.playlistMediaItems.length - 1

      if (!numItems) {
        Logger.info(`[PodcastController] Playlist "${pmi.playlist.name}" has no more items - removing it`)
        const jsonExpanded = await pmi.playlist.getOldJsonExpanded()
        SocketAuthority.clientEmitter(pmi.playlist.userId, 'playlist_removed', jsonExpanded)
        await pmi.playlist.destroy()
      } else {
        await pmi.destroy()
        const jsonExpanded = await pmi.playlist.getOldJsonExpanded()
        SocketAuthority.clientEmitter(pmi.playlist.userId, 'playlist_updated', jsonExpanded)
      }
    }

    // Remove media progress for this episode
    const mediaProgressRemoved = await Database.mediaProgressModel.destroy({
      where: {
        mediaItemId: episode.id
      }
    })
    if (mediaProgressRemoved) {
      Logger.info(`[PodcastController] Removed ${mediaProgressRemoved} media progress for episode ${episode.id}`)
    }

    await Database.updateLibraryItem(libraryItem)
    SocketAuthority.emitter('item_updated', libraryItem.toJSONExpanded())
    res.json(libraryItem.toJSON())
  }

  /**
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   * @param {NextFunction} next
   */
  async middleware(req, res, next) {
    const item = await Database.libraryItemModel.getOldById(req.params.id)
    if (!item?.media) return res.sendStatus(404)

    if (!item.isPodcast) {
      return res.sendStatus(500)
    }

    // Check user can access this library item
    if (!req.user.checkCanAccessLibraryItem(item)) {
      return res.sendStatus(403)
    }

    if (req.method == 'DELETE' && !req.user.canDelete) {
      Logger.warn(`[PodcastController] User "${req.user.username}" attempted to delete without permission`)
      return res.sendStatus(403)
    } else if ((req.method == 'PATCH' || req.method == 'POST') && !req.user.canUpdate) {
      Logger.warn(`[PodcastController] User "${req.user.username}" attempted to update without permission`)
      return res.sendStatus(403)
    }

    req.libraryItem = item
    next()
  }
}
module.exports = new PodcastController()
