const axios = require('axios')
const fs = require('fs-extra')
const Path = require('path')
const Logger = require('../Logger')
const { parsePodcastRssFeedXml } = require('../utils/podcastUtils')
const LibraryItem = require('../objects/LibraryItem')
const { getFileTimestampsWithIno, sanitizeFilename } = require('../utils/fileUtils')
const filePerms = require('../utils/filePerms')

class PodcastController {

  async create(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[PodcastController] Non-admin user attempted to create podcast`, req.user)
      return res.sendStatus(500)
    }
    const payload = req.body

    const library = this.db.libraries.find(lib => lib.id === payload.libraryId)
    if (!library) {
      Logger.error(`[PodcastController] Create: Library not found "${payload.libraryId}"`)
      return res.status(400).send('Library not found')
    }

    const folder = library.folders.find(fold => fold.id === payload.folderId)
    if (!folder) {
      Logger.error(`[PodcastController] Create: Folder not found "${payload.folderId}"`)
      return res.status(400).send('Folder not found')
    }

    var podcastPath = payload.path.replace(/\\/g, '/')
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
    this.emitter('item_added', libraryItem.toJSONExpanded())

    res.json(libraryItem.toJSONExpanded())

    if (payload.episodesToDownload && payload.episodesToDownload.length) {
      Logger.info(`[PodcastController] Podcast created now starting ${payload.episodesToDownload.length} episode downloads`)
      this.podcastManager.downloadPodcastEpisodes(libraryItem, payload.episodesToDownload)
    }

    // Turn on podcast auto download cron if not already on
    if (libraryItem.media.autoDownloadEpisodes && !this.podcastManager.episodeScheduleTask) {
      this.podcastManager.schedulePodcastEpisodeCron()
    }
  }

  getPodcastFeed(req, res) {
    var url = req.body.rssFeed
    if (!url) {
      return res.status(400).send('Bad request')
    }
    var includeRaw = req.query.raw == 1 // Include raw json

    axios.get(url).then(async (data) => {
      if (!data || !data.data) {
        Logger.error('Invalid podcast feed request response')
        return res.status(500).send('Bad response from feed request')
      }
      Logger.debug(`[PdocastController] Podcast feed size ${(data.data.length / 1024 / 1024).toFixed(2)}MB`)
      var payload = await parsePodcastRssFeedXml(data.data, includeRaw)
      if (!payload) {
        return res.status(500).send('Invalid podcast RSS feed')
      }

      if (!payload.podcast.metadata.feedUrl) {
        // Not every RSS feed will put the feed url in their metadata
        payload.podcast.metadata.feedUrl = url
      }

      res.json(payload)
    }).catch((error) => {
      console.error('Failed', error)
      res.status(500).send(error)
    })
  }

  async checkNewEpisodes(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[PodcastController] Non-admin user attempted to check/download episodes`, req.user)
      return res.sendStatus(500)
    }

    var libraryItem = req.libraryItem
    if (!libraryItem.media.metadata.feedUrl) {
      Logger.error(`[PodcastController] checkNewEpisodes no feed url for item ${libraryItem.id}`)
      return res.status(500).send('Podcast has no rss feed url')
    }

    var newEpisodes = await this.podcastManager.checkAndDownloadNewEpisodes(libraryItem)
    res.json({
      episodes: newEpisodes || []
    })
  }

  clearEpisodeDownloadQueue(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[PodcastController] Non-admin user attempting to clear download queue "${req.user.username}"`)
      return res.sendStatus(500)
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

  async downloadEpisodes(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[PodcastController] Non-admin user attempted to download episodes`, req.user)
      return res.sendStatus(500)
    }
    var libraryItem = req.libraryItem

    var episodes = req.body
    if (!episodes || !episodes.length) {
      return res.sendStatus(400)
    }

    this.podcastManager.downloadPodcastEpisodes(libraryItem, episodes)
    res.sendStatus(200)
  }

  async updateEpisode(req, res) {
    var libraryItem = req.libraryItem

    var episodeId = req.params.episodeId
    if (!libraryItem.media.checkHasEpisode(episodeId)) {
      return res.status(500).send('Episode not found')
    }

    var wasUpdated = libraryItem.media.updateEpisode(episodeId, req.body)
    if (wasUpdated) {
      await this.db.updateLibraryItem(libraryItem)
      this.emitter('item_updated', libraryItem.toJSONExpanded())
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

    libraryItem.media.removeEpisode(episodeId)

    await this.db.updateLibraryItem(libraryItem)
    this.emitter('item_updated', libraryItem.toJSONExpanded())
    res.json(libraryItem.toJSON())
  }

  middleware(req, res, next) {
    var item = this.db.libraryItems.find(li => li.id === req.params.id)
    if (!item || !item.media) return res.sendStatus(404)

    if (!item.isPodcast) {
      return res.sendStatus(500)
    }

    // Check user can access this library
    if (!req.user.checkCanAccessLibrary(item.libraryId)) {
      return res.sendStatus(403)
    }

    // Check user can access this library item
    if (!req.user.checkCanAccessLibraryItemWithTags(item.media.tags)) {
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