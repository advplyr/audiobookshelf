const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')

const fs = require('../libs/fsExtra')

const { getPodcastFeed, findMatchingEpisodes } = require('../utils/podcastUtils')
const { getFileTimestampsWithIno, filePathToPOSIX } = require('../utils/fileUtils')
const filePerms = require('../utils/filePerms')

const LibraryItem = require('../objects/LibraryItem')

class PodcastController {

  async create(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[PodcastController] Non-admin user attempted to create podcast`, req.user)
      return res.sendStatus(403)
    }
    const payload = req.body

    const library = this.db.libraries.find(lib => lib.id === payload.libraryId)
    if (!library) {
      Logger.error(`[PodcastController] Create: Library not found "${payload.libraryId}"`)
      return res.status(404).send('Library not found')
    }

    const folder = library.folders.find(fold => fold.id === payload.folderId)
    if (!folder) {
      Logger.error(`[PodcastController] Create: Folder not found "${payload.folderId}"`)
      return res.status(404).send('Folder not found')
    }

    const podcastPath = filePathToPOSIX(payload.path)
    if (await fs.pathExists(podcastPath)) {
      Logger.error(`[PodcastController] Podcast folder already exists "${podcastPath}"`)
      return res.status(400).send('Podcast already exists')
    }

    var success = await fs.ensureDir(podcastPath).then(() => true).catch((error) => {
      Logger.error(`[PodcastController] Failed to ensure podcast dir "${podcastPath}"`, error)
      return false
    })
    if (!success) return res.status(400).send('Invalid podcast path')
    await filePerms.setDefault(podcastPath)

    var libraryItemFolderStats = await getFileTimestampsWithIno(podcastPath)

    var relPath = payload.path.replace(folder.fullPath, '')
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

    var libraryItem = new LibraryItem()
    libraryItem.setData('podcast', libraryItemPayload)

    // Download and save cover image
    if (payload.media.metadata.imageUrl) {
      // TODO: Scan cover image to library files
      // Podcast cover will always go into library item folder
      var coverResponse = await this.coverManager.downloadCoverFromUrl(libraryItem, payload.media.metadata.imageUrl, true)
      if (coverResponse) {
        if (coverResponse.error) {
          Logger.error(`[PodcastController] Download cover error from "${payload.media.metadata.imageUrl}": ${coverResponse.error}`)
        } else if (coverResponse.cover) {
          libraryItem.media.coverPath = coverResponse.cover
        }
      }
    }

    await this.db.insertLibraryItem(libraryItem)
    SocketAuthority.emitter('item_added', libraryItem.toJSONExpanded())

    res.json(libraryItem.toJSONExpanded())

    if (payload.episodesToDownload && payload.episodesToDownload.length) {
      Logger.info(`[PodcastController] Podcast created now starting ${payload.episodesToDownload.length} episode downloads`)
      this.podcastManager.downloadPodcastEpisodes(libraryItem, payload.episodesToDownload)
    }

    // Turn on podcast auto download cron if not already on
    if (libraryItem.media.autoDownloadEpisodes) {
      this.cronManager.checkUpdatePodcastCron(libraryItem)
    }
  }

  async getPodcastFeed(req, res) {
    var url = req.body.rssFeed
    if (!url) {
      return res.status(400).send('Bad request')
    }

    const podcast = await getPodcastFeed(url)
    if (!podcast) {
      return res.status(404).send('Podcast RSS feed request failed or invalid response data')
    }
    res.json({ podcast })
  }

  async getOPMLFeeds(req, res) {
    if (!req.body.opmlText) {
      return res.sendStatus(400)
    }

    const rssFeedsData = await this.podcastManager.getOPMLFeeds(req.body.opmlText)
    res.json(rssFeedsData)
  }

  async checkNewEpisodes(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[PodcastController] Non-admin user attempted to check/download episodes`, req.user)
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

  clearEpisodeDownloadQueue(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[PodcastController] Non-admin user attempting to clear download queue "${req.user.username}"`)
      return res.sendStatus(403)
    }
    this.podcastManager.clearDownloadQueue(req.params.id)
    res.sendStatus(200)
  }

  getEpisodeDownloads(req, res) {
    var libraryItem = req.libraryItem

    var downloadsInQueue = this.podcastManager.getEpisodeDownloadsInQueue(libraryItem.id)
    res.json({
      downloads: downloadsInQueue.map(d => d.toJSONForClient())
    })
  }

  async findEpisode(req, res) {
    const rssFeedUrl = req.libraryItem.media.metadata.feedUrl
    if (!rssFeedUrl) {
      Logger.error(`[PodcastController] findEpisode: Podcast has no feed url`)
      return res.status(500).send('Podcast does not have an RSS feed URL')
    }

    var searchTitle = req.query.title
    if (!searchTitle) {
      return res.sendStatus(500)
    }
    const episodes = await findMatchingEpisodes(rssFeedUrl, searchTitle)
    res.json({
      episodes: episodes || []
    })
  }

  async downloadEpisodes(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[PodcastController] Non-admin user attempted to download episodes`, req.user)
      return res.sendStatus(403)
    }
    var libraryItem = req.libraryItem

    var episodes = req.body
    if (!episodes || !episodes.length) {
      return res.sendStatus(400)
    }

    this.podcastManager.downloadPodcastEpisodes(libraryItem, episodes)
    res.sendStatus(200)
  }

  // POST: api/podcasts/:id/match-episodes
  async quickMatchEpisodes(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[PodcastController] Non-admin user attempted to download episodes`, req.user)
      return res.sendStatus(403)
    }

    const overrideDetails = req.query.override === '1'
    const episodesUpdated = await this.scanner.quickMatchPodcastEpisodes(req.libraryItem, { overrideDetails })
    if (episodesUpdated) {
      await this.db.updateLibraryItem(req.libraryItem)
      SocketAuthority.emitter('item_updated', req.libraryItem.toJSONExpanded())
    }

    res.json({
      numEpisodesUpdated: episodesUpdated
    })
  }

  async updateEpisode(req, res) {
    const libraryItem = req.libraryItem

    var episodeId = req.params.episodeId
    if (!libraryItem.media.checkHasEpisode(episodeId)) {
      return res.status(404).send('Episode not found')
    }

    var wasUpdated = libraryItem.media.updateEpisode(episodeId, req.body)
    if (wasUpdated) {
      await this.db.updateLibraryItem(libraryItem)
      SocketAuthority.emitter('item_updated', libraryItem.toJSONExpanded())
    }

    res.json(libraryItem.toJSONExpanded())
  }

  // DELETE: api/podcasts/:id/episode/:episodeId
  async removeEpisode(req, res) {
    var episodeId = req.params.episodeId
    var libraryItem = req.libraryItem
    var hardDelete = req.query.hard === '1'

    var episode = libraryItem.media.episodes.find(ep => ep.id === episodeId)
    if (!episode) {
      Logger.error(`[PodcastController] removeEpisode episode ${episodeId} not found for item ${libraryItem.id}`)
      return res.sendStatus(404)
    }

    if (hardDelete) {
      var audioFile = episode.audioFile
      // TODO: this will trigger the watcher. should maybe handle this gracefully
      await fs.remove(audioFile.metadata.path).then(() => {
        Logger.info(`[PodcastController] Hard deleted episode file at "${audioFile.metadata.path}"`)
      }).catch((error) => {
        Logger.error(`[PodcastController] Failed to hard delete episode file at "${audioFile.metadata.path}"`, error)
      })
    }

    // Remove episode from Podcast and library file
    const episodeRemoved = libraryItem.media.removeEpisode(episodeId)
    if (episodeRemoved && episodeRemoved.audioFile) {
      libraryItem.removeLibraryFile(episodeRemoved.audioFile.ino)
    }

    await this.db.updateLibraryItem(libraryItem)
    SocketAuthority.emitter('item_updated', libraryItem.toJSONExpanded())
    res.json(libraryItem.toJSON())
  }

  middleware(req, res, next) {
    const item = this.db.libraryItems.find(li => li.id === req.params.id)
    if (!item || !item.media) return res.sendStatus(404)

    if (!item.isPodcast) {
      return res.sendStatus(500)
    }

    // Check user can access this library item
    if (!req.user.checkCanAccessLibraryItem(item)) {
      return res.sendStatus(403)
    }

    if (req.method == 'DELETE' && !req.user.canDelete) {
      Logger.warn(`[PodcastController] User attempted to delete without permission`, req.user.username)
      return res.sendStatus(403)
    } else if ((req.method == 'PATCH' || req.method == 'POST') && !req.user.canUpdate) {
      Logger.warn('[PodcastController] User attempted to update without permission', req.user.username)
      return res.sendStatus(403)
    }

    req.libraryItem = item
    next()
  }
}
module.exports = new PodcastController()