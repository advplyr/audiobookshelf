const Path = require('path')
const { Request, Response, NextFunction } = require('express')
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')

const fs = require('../libs/fsExtra')

const { getPodcastFeed, findMatchingEpisodes } = require('../utils/podcastUtils')
const { getFileTimestampsWithIno, filePathToPOSIX } = require('../utils/fileUtils')
const { validateUrl } = require('../utils/index')
const htmlSanitizer = require('../utils/htmlSanitizer')

const Scanner = require('../scanner/Scanner')
const CoverManager = require('../managers/CoverManager')

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 *
 * @typedef RequestEntityObject
 * @property {import('../models/LibraryItem')} libraryItem
 *
 * @typedef {RequestWithUser & RequestEntityObject} RequestWithLibraryItem
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
    if (!payload.media || !payload.media.metadata) {
      return res.status(400).send('Invalid request body. "media" and "media.metadata" are required')
    }

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

    let newLibraryItem = null
    const transaction = await Database.sequelize.transaction()
    try {
      const podcast = await Database.podcastModel.createFromRequest(payload.media, transaction)

      newLibraryItem = await Database.libraryItemModel.create(
        {
          ino: libraryItemFolderStats.ino,
          path: podcastPath,
          relPath,
          mediaId: podcast.id,
          mediaType: 'podcast',
          isFile: false,
          isMissing: false,
          isInvalid: false,
          mtime: libraryItemFolderStats.mtimeMs || 0,
          ctime: libraryItemFolderStats.ctimeMs || 0,
          birthtime: libraryItemFolderStats.birthtimeMs || 0,
          size: 0,
          libraryFiles: [],
          extraData: {},
          libraryId: library.id,
          libraryFolderId: folder.id,
          title: podcast.title,
          titleIgnorePrefix: podcast.titleIgnorePrefix
        },
        { transaction }
      )

      await transaction.commit()
    } catch (error) {
      Logger.error(`[PodcastController] Failed to create podcast: ${error}`)
      await transaction.rollback()
      return res.status(500).send('Failed to create podcast')
    }

    newLibraryItem.media = await newLibraryItem.getMediaExpanded()

    // Download and save cover image
    if (typeof payload.media.metadata.imageUrl === 'string' && payload.media.metadata.imageUrl.startsWith('http')) {
      // Podcast cover will always go into library item folder
      const coverResponse = await CoverManager.downloadCoverFromUrlNew(payload.media.metadata.imageUrl, newLibraryItem.id, newLibraryItem.path, true)
      if (coverResponse.error) {
        Logger.error(`[PodcastController] Download cover error from "${payload.media.metadata.imageUrl}": ${coverResponse.error}`)
      } else if (coverResponse.cover) {
        const coverImageFileStats = await getFileTimestampsWithIno(coverResponse.cover)
        if (!coverImageFileStats) {
          Logger.error(`[PodcastController] Failed to get cover image stats for "${coverResponse.cover}"`)
        } else {
          // Add libraryFile to libraryItem and coverPath to podcast
          const newLibraryFile = {
            ino: coverImageFileStats.ino,
            fileType: 'image',
            addedAt: Date.now(),
            updatedAt: Date.now(),
            metadata: {
              filename: Path.basename(coverResponse.cover),
              ext: Path.extname(coverResponse.cover).slice(1),
              path: coverResponse.cover,
              relPath: Path.basename(coverResponse.cover),
              size: coverImageFileStats.size,
              mtimeMs: coverImageFileStats.mtimeMs || 0,
              ctimeMs: coverImageFileStats.ctimeMs || 0,
              birthtimeMs: coverImageFileStats.birthtimeMs || 0
            }
          }
          newLibraryItem.libraryFiles.push(newLibraryFile)
          newLibraryItem.changed('libraryFiles', true)
          await newLibraryItem.save()

          newLibraryItem.media.coverPath = coverResponse.cover
          await newLibraryItem.media.save()
        }
      }
    }

    SocketAuthority.libraryItemEmitter('item_added', newLibraryItem)

    res.json(newLibraryItem.toOldJSONExpanded())

    // Turn on podcast auto download cron if not already on
    if (newLibraryItem.media.autoDownloadEpisodes) {
      this.cronManager.checkUpdatePodcastCron(newLibraryItem)
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
   * @param {RequestWithLibraryItem} req
   * @param {Response} res
   */
  async checkNewEpisodes(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[PodcastController] Non-admin user "${req.user.username}" attempted to check/download episodes`)
      return res.sendStatus(403)
    }

    if (!req.libraryItem.media.feedURL) {
      Logger.error(`[PodcastController] checkNewEpisodes no feed url for item ${req.libraryItem.id}`)
      return res.status(400).send('Podcast has no rss feed url')
    }

    const maxEpisodesToDownload = !isNaN(req.query.limit) ? Number(req.query.limit) : 3

    const newEpisodes = await this.podcastManager.checkAndDownloadNewEpisodes(req.libraryItem, maxEpisodesToDownload)
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
   * @param {RequestWithLibraryItem} req
   * @param {Response} res
   */
  getEpisodeDownloads(req, res) {
    const downloadsInQueue = this.podcastManager.getEpisodeDownloadsInQueue(req.libraryItem.id)
    res.json({
      downloads: downloadsInQueue.map((d) => d.toJSONForClient())
    })
  }

  /**
   * GET: /api/podcasts/:id/search-episode
   * Search for an episode in a podcast
   *
   * @param {RequestWithLibraryItem} req
   * @param {Response} res
   */
  async findEpisode(req, res) {
    const rssFeedUrl = req.libraryItem.media.feedURL
    if (!rssFeedUrl) {
      Logger.error(`[PodcastController] findEpisode: Podcast has no feed url`)
      return res.status(400).send('Podcast does not have an RSS feed URL')
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
   * @param {RequestWithLibraryItem} req
   * @param {Response} res
   */
  async downloadEpisodes(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[PodcastController] Non-admin user "${req.user.username}" attempted to download episodes`)
      return res.sendStatus(403)
    }

    const episodes = req.body
    if (!Array.isArray(episodes) || !episodes.length) {
      return res.sendStatus(400)
    }

    this.podcastManager.downloadPodcastEpisodes(req.libraryItem, episodes)
    res.sendStatus(200)
  }

  /**
   * POST: /api/podcasts/:id/match-episodes
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {RequestWithLibraryItem} req
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
      SocketAuthority.libraryItemEmitter('item_updated', req.libraryItem)
    }

    res.json({
      numEpisodesUpdated: episodesUpdated
    })
  }

  /**
   * PATCH: /api/podcasts/:id/episode/:episodeId
   *
   * @param {RequestWithLibraryItem} req
   * @param {Response} res
   */
  async updateEpisode(req, res) {
    /** @type {import('../models/PodcastEpisode')} */
    const episode = req.libraryItem.media.podcastEpisodes.find((ep) => ep.id === req.params.episodeId)
    if (!episode) {
      return res.status(404).send('Episode not found')
    }

    const updatePayload = {}
    const supportedStringKeys = ['title', 'subtitle', 'description', 'pubDate', 'episode', 'season', 'episodeType']
    for (const key in req.body) {
      if (supportedStringKeys.includes(key) && typeof req.body[key] === 'string') {
        // Sanitize description HTML
        if (key === 'description' && req.body[key]) {
          const sanitizedDescription = htmlSanitizer.sanitize(req.body[key])
          if (sanitizedDescription !== req.body[key]) {
            Logger.debug(`[PodcastController] Sanitized description from "${req.body[key]}" to "${sanitizedDescription}"`)
            req.body[key] = sanitizedDescription
          }
        }

        updatePayload[key] = req.body[key]
      } else if (key === 'chapters' && Array.isArray(req.body[key]) && req.body[key].every((ch) => typeof ch === 'object' && ch.title && ch.start)) {
        updatePayload[key] = req.body[key]
      } else if (key === 'publishedAt' && typeof req.body[key] === 'number') {
        updatePayload[key] = req.body[key]
      }
    }

    if (Object.keys(updatePayload).length) {
      episode.set(updatePayload)
      if (episode.changed()) {
        Logger.info(`[PodcastController] Updated episode "${episode.title}" keys`, episode.changed())
        await episode.save()

        SocketAuthority.libraryItemEmitter('item_updated', req.libraryItem)
      } else {
        Logger.info(`[PodcastController] No changes to episode "${episode.title}"`)
      }
    }

    res.json(req.libraryItem.toOldJSONExpanded())
  }

  /**
   * GET: /api/podcasts/:id/episode/:episodeId
   *
   * @param {RequestWithLibraryItem} req
   * @param {Response} res
   */
  async getEpisode(req, res) {
    const episodeId = req.params.episodeId

    /** @type {import('../models/PodcastEpisode')} */
    const episode = req.libraryItem.media.podcastEpisodes.find((ep) => ep.id === episodeId)
    if (!episode) {
      Logger.error(`[PodcastController] getEpisode episode ${episodeId} not found for item ${req.libraryItem.id}`)
      return res.sendStatus(404)
    }

    res.json(episode.toOldJSON(req.libraryItem.id))
  }

  /**
   * DELETE: /api/podcasts/:id/episode/:episodeId
   *
   * @param {RequestWithLibraryItem} req
   * @param {Response} res
   */
  async removeEpisode(req, res) {
    const episodeId = req.params.episodeId
    const hardDelete = req.query.hard === '1'

    /** @type {import('../models/PodcastEpisode')} */
    const episode = req.libraryItem.media.podcastEpisodes.find((ep) => ep.id === episodeId)
    if (!episode) {
      Logger.error(`[PodcastController] removeEpisode episode ${episodeId} not found for item ${req.libraryItem.id}`)
      return res.sendStatus(404)
    }

    // Remove it from the podcastEpisodes array
    req.libraryItem.media.podcastEpisodes = req.libraryItem.media.podcastEpisodes.filter((ep) => ep.id !== episodeId)

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

    // Remove episode from playlists
    await Database.playlistModel.removeMediaItemsFromPlaylists([episodeId])

    // Remove media progress for this episode
    const mediaProgressRemoved = await Database.mediaProgressModel.destroy({
      where: {
        mediaItemId: episode.id
      }
    })
    if (mediaProgressRemoved) {
      Logger.info(`[PodcastController] Removed ${mediaProgressRemoved} media progress for episode ${episode.id}`)
    }

    // Remove episode
    await episode.destroy()

    // Remove library file
    req.libraryItem.libraryFiles = req.libraryItem.libraryFiles.filter((file) => file.ino !== episode.audioFile.ino)
    req.libraryItem.changed('libraryFiles', true)
    await req.libraryItem.save()

    // update number of episodes
    req.libraryItem.media.numEpisodes = req.libraryItem.media.podcastEpisodes.length
    await req.libraryItem.media.save()

    SocketAuthority.libraryItemEmitter('item_updated', req.libraryItem)
    res.json(req.libraryItem.toOldJSON())
  }

  /**
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   * @param {NextFunction} next
   */
  async middleware(req, res, next) {
    const libraryItem = await Database.libraryItemModel.getExpandedById(req.params.id)
    if (!libraryItem?.media) return res.sendStatus(404)

    if (!libraryItem.isPodcast) {
      return res.sendStatus(500)
    }

    // Check user can access this library item
    if (!req.user.checkCanAccessLibraryItem(libraryItem)) {
      return res.sendStatus(403)
    }

    if (req.method == 'DELETE' && !req.user.canDelete) {
      Logger.warn(`[PodcastController] User "${req.user.username}" attempted to delete without permission`)
      return res.sendStatus(403)
    } else if ((req.method == 'PATCH' || req.method == 'POST') && !req.user.canUpdate) {
      Logger.warn(`[PodcastController] User "${req.user.username}" attempted to update without permission`)
      return res.sendStatus(403)
    }

    req.libraryItem = libraryItem
    next()
  }
}
module.exports = new PodcastController()
