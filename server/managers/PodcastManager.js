const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')
const Watcher = require('../Watcher')

const fs = require('../libs/fsExtra')

const { getPodcastFeed } = require('../utils/podcastUtils')
const { removeFile, downloadFile, sanitizeFilename, filePathToPOSIX, getFileTimestampsWithIno } = require('../utils/fileUtils')
const { levenshteinDistance } = require('../utils/index')
const opmlParser = require('../utils/parsers/parseOPML')
const opmlGenerator = require('../utils/generators/opmlGenerator')
const prober = require('../utils/prober')
const ffmpegHelpers = require('../utils/ffmpegHelpers')

const TaskManager = require('./TaskManager')
const CoverManager = require('../managers/CoverManager')
const NotificationManager = require('../managers/NotificationManager')

const LibraryFile = require('../objects/files/LibraryFile')
const PodcastEpisodeDownload = require('../objects/PodcastEpisodeDownload')
const PodcastEpisode = require('../objects/entities/PodcastEpisode')
const AudioFile = require('../objects/files/AudioFile')
const LibraryItem = require('../objects/LibraryItem')

class PodcastManager {
  constructor() {
    /** @type {PodcastEpisodeDownload[]} */
    this.downloadQueue = []
    /** @type {PodcastEpisodeDownload} */
    this.currentDownload = null

    this.failedCheckMap = {}
    this.MaxFailedEpisodeChecks = 24
  }

  getEpisodeDownloadsInQueue(libraryItemId) {
    return this.downloadQueue.filter((d) => d.libraryItemId === libraryItemId)
  }

  clearDownloadQueue(libraryItemId = null) {
    if (!this.downloadQueue.length) return

    if (!libraryItemId) {
      Logger.info(`[PodcastManager] Clearing all downloads in queue (${this.downloadQueue.length})`)
      this.downloadQueue = []
    } else {
      var itemDownloads = this.getEpisodeDownloadsInQueue(libraryItemId)
      Logger.info(`[PodcastManager] Clearing downloads in queue for item "${libraryItemId}" (${itemDownloads.length})`)
      this.downloadQueue = this.downloadQueue.filter((d) => d.libraryItemId !== libraryItemId)
      SocketAuthority.emitter('episode_download_queue_cleared', libraryItemId)
    }
  }

  async downloadPodcastEpisodes(libraryItem, episodesToDownload, isAutoDownload) {
    let index = Math.max(...libraryItem.media.episodes.filter((ep) => ep.index == null || isNaN(ep.index)).map((ep) => Number(ep.index))) + 1
    for (const ep of episodesToDownload) {
      const newPe = new PodcastEpisode()
      newPe.setData(ep, index++)
      newPe.libraryItemId = libraryItem.id
      newPe.podcastId = libraryItem.media.id
      const newPeDl = new PodcastEpisodeDownload()
      newPeDl.setData(newPe, libraryItem, isAutoDownload, libraryItem.libraryId)
      this.startPodcastEpisodeDownload(newPeDl)
    }
  }

  /**
   *
   * @param {PodcastEpisodeDownload} podcastEpisodeDownload
   * @returns
   */
  async startPodcastEpisodeDownload(podcastEpisodeDownload) {
    if (this.currentDownload) {
      this.downloadQueue.push(podcastEpisodeDownload)
      SocketAuthority.emitter('episode_download_queued', podcastEpisodeDownload.toJSONForClient())
      return
    }

    const taskData = {
      libraryId: podcastEpisodeDownload.libraryId,
      libraryItemId: podcastEpisodeDownload.libraryItemId
    }
    const taskTitleString = {
      text: 'Downloading episode',
      key: 'MessageDownloadingEpisode'
    }
    const taskDescriptionString = {
      text: `Downloading episode "${podcastEpisodeDownload.podcastEpisode.title}".`,
      key: 'MessageTaskDownloadingEpisodeDescription',
      subs: [podcastEpisodeDownload.podcastEpisode.title]
    }
    const task = TaskManager.createAndAddTask('download-podcast-episode', taskTitleString, taskDescriptionString, false, taskData)

    SocketAuthority.emitter('episode_download_started', podcastEpisodeDownload.toJSONForClient())
    this.currentDownload = podcastEpisodeDownload

    // If this file already exists then append the episode id to the filename
    //  e.g. "/tagesschau 20 Uhr.mp3" becomes "/tagesschau 20 Uhr (ep_asdfasdf).mp3"
    //  this handles podcasts where every title is the same (ref https://github.com/advplyr/audiobookshelf/issues/1802)
    if (await fs.pathExists(this.currentDownload.targetPath)) {
      this.currentDownload.appendEpisodeId = true
    }

    // Ignores all added files to this dir
    Watcher.addIgnoreDir(this.currentDownload.libraryItem.path)
    Watcher.ignoreFilePathsDownloading.add(this.currentDownload.targetPath)

    // Make sure podcast library item folder exists
    if (!(await fs.pathExists(this.currentDownload.libraryItem.path))) {
      Logger.warn(`[PodcastManager] Podcast episode download: Podcast folder no longer exists at "${this.currentDownload.libraryItem.path}" - Creating it`)
      await fs.mkdir(this.currentDownload.libraryItem.path)
    }

    let success = false
    if (this.currentDownload.isMp3) {
      // Download episode and tag it
      success = await ffmpegHelpers.downloadPodcastEpisode(this.currentDownload).catch((error) => {
        Logger.error(`[PodcastManager] Podcast Episode download failed`, error)
        return false
      })
    } else {
      // Download episode only
      success = await downloadFile(this.currentDownload.url, this.currentDownload.targetPath)
        .then(() => true)
        .catch((error) => {
          Logger.error(`[PodcastManager] Podcast Episode download failed`, error)
          return false
        })
    }

    if (success) {
      success = await this.scanAddPodcastEpisodeAudioFile()
      if (!success) {
        await fs.remove(this.currentDownload.targetPath)
        this.currentDownload.setFinished(false)
        const taskFailedString = {
          text: 'Failed',
          key: 'MessageTaskFailed'
        }
        task.setFailed(taskFailedString)
      } else {
        Logger.info(`[PodcastManager] Successfully downloaded podcast episode "${this.currentDownload.podcastEpisode.title}"`)
        this.currentDownload.setFinished(true)
        task.setFinished()
      }
    } else {
      const taskFailedString = {
        text: 'Failed',
        key: 'MessageTaskFailed'
      }
      task.setFailed(taskFailedString)
      this.currentDownload.setFinished(false)
    }

    TaskManager.taskFinished(task)

    SocketAuthority.emitter('episode_download_finished', this.currentDownload.toJSONForClient())

    Watcher.removeIgnoreDir(this.currentDownload.libraryItem.path)

    Watcher.ignoreFilePathsDownloading.delete(this.currentDownload.targetPath)
    this.currentDownload = null
    if (this.downloadQueue.length) {
      this.startPodcastEpisodeDownload(this.downloadQueue.shift())
    }
  }

  async scanAddPodcastEpisodeAudioFile() {
    const libraryFile = await this.getLibraryFile(this.currentDownload.targetPath, this.currentDownload.targetRelPath)

    const audioFile = await this.probeAudioFile(libraryFile)
    if (!audioFile) {
      return false
    }

    const libraryItem = await Database.libraryItemModel.getOldById(this.currentDownload.libraryItem.id)
    if (!libraryItem) {
      Logger.error(`[PodcastManager] Podcast Episode finished but library item was not found ${this.currentDownload.libraryItem.id}`)
      return false
    }

    const podcastEpisode = this.currentDownload.podcastEpisode
    podcastEpisode.audioFile = audioFile

    if (audioFile.chapters?.length) {
      podcastEpisode.chapters = audioFile.chapters.map((ch) => ({ ...ch }))
    }

    libraryItem.media.addPodcastEpisode(podcastEpisode)
    if (libraryItem.isInvalid) {
      // First episode added to an empty podcast
      libraryItem.isInvalid = false
    }
    libraryItem.libraryFiles.push(libraryFile)

    if (this.currentDownload.isAutoDownload) {
      // Check setting maxEpisodesToKeep and remove episode if necessary
      if (libraryItem.media.maxEpisodesToKeep && libraryItem.media.episodesWithPubDate.length > libraryItem.media.maxEpisodesToKeep) {
        Logger.info(`[PodcastManager] # of episodes (${libraryItem.media.episodesWithPubDate.length}) exceeds max episodes to keep (${libraryItem.media.maxEpisodesToKeep})`)
        await this.removeOldestEpisode(libraryItem, podcastEpisode.id)
      }
    }

    libraryItem.updatedAt = Date.now()
    await Database.updateLibraryItem(libraryItem)
    SocketAuthority.emitter('item_updated', libraryItem.toJSONExpanded())
    const podcastEpisodeExpanded = podcastEpisode.toJSONExpanded()
    podcastEpisodeExpanded.libraryItem = libraryItem.toJSONExpanded()
    SocketAuthority.emitter('episode_added', podcastEpisodeExpanded)

    if (this.currentDownload.isAutoDownload) {
      // Notifications only for auto downloaded episodes
      NotificationManager.onPodcastEpisodeDownloaded(libraryItem, podcastEpisode)
    }

    return true
  }

  async removeOldestEpisode(libraryItem, episodeIdJustDownloaded) {
    var smallestPublishedAt = 0
    var oldestEpisode = null
    libraryItem.media.episodesWithPubDate
      .filter((ep) => ep.id !== episodeIdJustDownloaded)
      .forEach((ep) => {
        if (!smallestPublishedAt || ep.publishedAt < smallestPublishedAt) {
          smallestPublishedAt = ep.publishedAt
          oldestEpisode = ep
        }
      })
    // TODO: Should we check for open playback sessions for this episode?
    // TODO: remove all user progress for this episode
    if (oldestEpisode?.audioFile) {
      Logger.info(`[PodcastManager] Deleting oldest episode "${oldestEpisode.title}"`)
      const successfullyDeleted = await removeFile(oldestEpisode.audioFile.metadata.path)
      if (successfullyDeleted) {
        libraryItem.media.removeEpisode(oldestEpisode.id)
        libraryItem.removeLibraryFile(oldestEpisode.audioFile.ino)
        return true
      } else {
        Logger.warn(`[PodcastManager] Failed to remove oldest episode "${oldestEpisode.title}"`)
      }
    }
    return false
  }

  async getLibraryFile(path, relPath) {
    var newLibFile = new LibraryFile()
    await newLibFile.setDataFromPath(path, relPath)
    return newLibFile
  }

  async probeAudioFile(libraryFile) {
    const path = libraryFile.metadata.path
    const mediaProbeData = await prober.probe(path)
    if (mediaProbeData.error) {
      Logger.error(`[PodcastManager] Podcast Episode downloaded but failed to probe "${path}"`, mediaProbeData.error)
      return false
    }
    const newAudioFile = new AudioFile()
    newAudioFile.setDataFromProbe(libraryFile, mediaProbeData)
    newAudioFile.index = 1
    return newAudioFile
  }

  // Returns false if auto download episodes was disabled (disabled if reaches max failed checks)
  async runEpisodeCheck(libraryItem) {
    const lastEpisodeCheckDate = new Date(libraryItem.media.lastEpisodeCheck || 0)
    const latestEpisodePublishedAt = libraryItem.media.latestEpisodePublished
    Logger.info(`[PodcastManager] runEpisodeCheck: "${libraryItem.media.metadata.title}" | Last check: ${lastEpisodeCheckDate} | ${latestEpisodePublishedAt ? `Latest episode pubDate: ${new Date(latestEpisodePublishedAt)}` : 'No latest episode'}`)

    // Use latest episode pubDate if exists OR fallback to using lastEpisodeCheckDate
    //    lastEpisodeCheckDate will be the current time when adding a new podcast
    const dateToCheckForEpisodesAfter = latestEpisodePublishedAt || lastEpisodeCheckDate
    Logger.debug(`[PodcastManager] runEpisodeCheck: "${libraryItem.media.metadata.title}" checking for episodes after ${new Date(dateToCheckForEpisodesAfter)}`)

    var newEpisodes = await this.checkPodcastForNewEpisodes(libraryItem, dateToCheckForEpisodesAfter, libraryItem.media.maxNewEpisodesToDownload)
    Logger.debug(`[PodcastManager] runEpisodeCheck: ${newEpisodes?.length || 'N/A'} episodes found`)

    if (!newEpisodes) {
      // Failed
      // Allow up to MaxFailedEpisodeChecks failed attempts before disabling auto download
      if (!this.failedCheckMap[libraryItem.id]) this.failedCheckMap[libraryItem.id] = 0
      this.failedCheckMap[libraryItem.id]++
      if (this.failedCheckMap[libraryItem.id] >= this.MaxFailedEpisodeChecks) {
        Logger.error(`[PodcastManager] runEpisodeCheck ${this.failedCheckMap[libraryItem.id]} failed attempts at checking episodes for "${libraryItem.media.metadata.title}" - disabling auto download`)
        libraryItem.media.autoDownloadEpisodes = false
        delete this.failedCheckMap[libraryItem.id]
      } else {
        Logger.warn(`[PodcastManager] runEpisodeCheck ${this.failedCheckMap[libraryItem.id]} failed attempts at checking episodes for "${libraryItem.media.metadata.title}"`)
      }
    } else if (newEpisodes.length) {
      delete this.failedCheckMap[libraryItem.id]
      Logger.info(`[PodcastManager] Found ${newEpisodes.length} new episodes for podcast "${libraryItem.media.metadata.title}" - starting download`)
      this.downloadPodcastEpisodes(libraryItem, newEpisodes, true)
    } else {
      delete this.failedCheckMap[libraryItem.id]
      Logger.debug(`[PodcastManager] No new episodes for "${libraryItem.media.metadata.title}"`)
    }

    libraryItem.media.lastEpisodeCheck = Date.now()
    libraryItem.updatedAt = Date.now()
    await Database.updateLibraryItem(libraryItem)
    SocketAuthority.emitter('item_updated', libraryItem.toJSONExpanded())
    return libraryItem.media.autoDownloadEpisodes
  }

  async checkPodcastForNewEpisodes(podcastLibraryItem, dateToCheckForEpisodesAfter, maxNewEpisodes = 3) {
    if (!podcastLibraryItem.media.metadata.feedUrl) {
      Logger.error(`[PodcastManager] checkPodcastForNewEpisodes no feed url for ${podcastLibraryItem.media.metadata.title} (ID: ${podcastLibraryItem.id})`)
      return false
    }
    const feed = await getPodcastFeed(podcastLibraryItem.media.metadata.feedUrl)
    if (!feed?.episodes) {
      Logger.error(`[PodcastManager] checkPodcastForNewEpisodes invalid feed payload for ${podcastLibraryItem.media.metadata.title} (ID: ${podcastLibraryItem.id})`, feed)
      return false
    }

    // Filter new and not already has
    let newEpisodes = feed.episodes.filter((ep) => ep.publishedAt > dateToCheckForEpisodesAfter && !podcastLibraryItem.media.checkHasEpisodeByFeedEpisode(ep))

    if (maxNewEpisodes > 0) {
      newEpisodes = newEpisodes.slice(0, maxNewEpisodes)
    }

    return newEpisodes
  }

  async checkAndDownloadNewEpisodes(libraryItem, maxEpisodesToDownload) {
    const lastEpisodeCheckDate = new Date(libraryItem.media.lastEpisodeCheck || 0)
    Logger.info(`[PodcastManager] checkAndDownloadNewEpisodes for "${libraryItem.media.metadata.title}" - Last episode check: ${lastEpisodeCheckDate}`)
    var newEpisodes = await this.checkPodcastForNewEpisodes(libraryItem, libraryItem.media.lastEpisodeCheck, maxEpisodesToDownload)
    if (newEpisodes.length) {
      Logger.info(`[PodcastManager] Found ${newEpisodes.length} new episodes for podcast "${libraryItem.media.metadata.title}" - starting download`)
      this.downloadPodcastEpisodes(libraryItem, newEpisodes, false)
    } else {
      Logger.info(`[PodcastManager] No new episodes found for podcast "${libraryItem.media.metadata.title}"`)
    }

    libraryItem.media.lastEpisodeCheck = Date.now()
    libraryItem.updatedAt = Date.now()
    await Database.updateLibraryItem(libraryItem)
    SocketAuthority.emitter('item_updated', libraryItem.toJSONExpanded())

    return newEpisodes
  }

  async findEpisode(rssFeedUrl, searchTitle) {
    const feed = await getPodcastFeed(rssFeedUrl).catch(() => {
      return null
    })
    if (!feed || !feed.episodes) {
      return null
    }

    const matches = []
    feed.episodes.forEach((ep) => {
      if (!ep.title) return

      const epTitle = ep.title.toLowerCase().trim()
      if (epTitle === searchTitle) {
        matches.push({
          episode: ep,
          levenshtein: 0
        })
      } else {
        const levenshtein = levenshteinDistance(searchTitle, epTitle, true)
        if (levenshtein <= 6 && epTitle.length > levenshtein) {
          matches.push({
            episode: ep,
            levenshtein
          })
        }
      }
    })
    return matches.sort((a, b) => a.levenshtein - b.levenshtein)
  }

  getParsedOPMLFileFeeds(opmlText) {
    return opmlParser.parse(opmlText)
  }

  async getOPMLFeeds(opmlText) {
    const extractedFeeds = opmlParser.parse(opmlText)
    if (!extractedFeeds?.length) {
      Logger.error('[PodcastManager] getOPMLFeeds: No RSS feeds found in OPML')
      return {
        error: 'No RSS feeds found in OPML'
      }
    }

    const rssFeedData = []

    for (let feed of extractedFeeds) {
      const feedData = await getPodcastFeed(feed.feedUrl, true)
      if (feedData) {
        feedData.metadata.feedUrl = feed.feedUrl
        rssFeedData.push(feedData)
      }
    }

    return {
      feeds: rssFeedData
    }
  }

  /**
   * OPML file string for podcasts in a library
   * @param {import('../models/Podcast')[]} podcasts
   * @returns {string} XML string
   */
  generateOPMLFileText(podcasts) {
    return opmlGenerator.generate(podcasts)
  }

  getDownloadQueueDetails(libraryId = null) {
    let _currentDownload = this.currentDownload
    if (libraryId && _currentDownload?.libraryId !== libraryId) _currentDownload = null

    return {
      currentDownload: _currentDownload?.toJSONForClient(),
      queue: this.downloadQueue.filter((item) => !libraryId || item.libraryId === libraryId).map((item) => item.toJSONForClient())
    }
  }

  /**
   *
   * @param {string[]} rssFeedUrls
   * @param {import('../models/LibraryFolder')} folder
   * @param {boolean} autoDownloadEpisodes
   * @param {import('../managers/CronManager')} cronManager
   */
  async createPodcastsFromFeedUrls(rssFeedUrls, folder, autoDownloadEpisodes, cronManager) {
    const taskTitleString = {
      text: 'OPML import',
      key: 'MessageTaskOpmlImport'
    }
    const taskDescriptionString = {
      text: `Creating podcasts from ${rssFeedUrls.length} RSS feeds`,
      key: 'MessageTaskOpmlImportDescription',
      subs: [rssFeedUrls.length]
    }
    const task = TaskManager.createAndAddTask('opml-import', taskTitleString, taskDescriptionString, true, null)
    let numPodcastsAdded = 0
    Logger.info(`[PodcastManager] createPodcastsFromFeedUrls: Importing ${rssFeedUrls.length} RSS feeds to folder "${folder.path}"`)
    for (const feedUrl of rssFeedUrls) {
      const feed = await getPodcastFeed(feedUrl).catch(() => null)
      if (!feed?.episodes) {
        const taskTitleStringFeed = {
          text: 'OPML import feed',
          key: 'MessageTaskOpmlImportFeed'
        }
        const taskDescriptionStringFeed = {
          text: `Importing RSS feed "${feedUrl}"`,
          key: 'MessageTaskOpmlImportFeedDescription',
          subs: [feedUrl]
        }
        const taskErrorString = {
          text: 'Failed to get podcast feed',
          key: 'MessageTaskOpmlImportFeedFailed'
        }
        TaskManager.createAndEmitFailedTask('opml-import-feed', taskTitleStringFeed, taskDescriptionStringFeed, taskErrorString)
        Logger.error(`[PodcastManager] createPodcastsFromFeedUrls: Failed to get podcast feed for "${feedUrl}"`)
        continue
      }

      const podcastFilename = sanitizeFilename(feed.metadata.title)
      const podcastPath = filePathToPOSIX(`${folder.path}/${podcastFilename}`)
      // Check if a library item with this podcast folder exists already
      const existingLibraryItem =
        (await Database.libraryItemModel.count({
          where: {
            path: podcastPath
          }
        })) > 0
      if (existingLibraryItem) {
        Logger.error(`[PodcastManager] createPodcastsFromFeedUrls: Podcast already exists at path "${podcastPath}"`)
        const taskTitleStringFeed = {
          text: 'OPML import feed',
          key: 'MessageTaskOpmlImportFeed'
        }
        const taskDescriptionStringPodcast = {
          text: `Creating podcast "${feed.metadata.title}"`,
          key: 'MessageTaskOpmlImportFeedPodcastDescription',
          subs: [feed.metadata.title]
        }
        const taskErrorString = {
          text: 'Podcast already exists at path',
          key: 'MessageTaskOpmlImportFeedPodcastExists'
        }
        TaskManager.createAndEmitFailedTask('opml-import-feed', taskTitleStringFeed, taskDescriptionStringPodcast, taskErrorString)
        continue
      }

      const successCreatingPath = await fs
        .ensureDir(podcastPath)
        .then(() => true)
        .catch((error) => {
          Logger.error(`[PodcastManager] Failed to ensure podcast dir "${podcastPath}"`, error)
          return false
        })
      if (!successCreatingPath) {
        Logger.error(`[PodcastManager] createPodcastsFromFeedUrls: Failed to create podcast folder at "${podcastPath}"`)
        const taskTitleStringFeed = {
          text: 'OPML import feed',
          key: 'MessageTaskOpmlImportFeed'
        }
        const taskDescriptionStringPodcast = {
          text: `Creating podcast "${feed.metadata.title}"`,
          key: 'MessageTaskOpmlImportFeedPodcastDescription',
          subs: [feed.metadata.title]
        }
        const taskErrorString = {
          text: 'Failed to create podcast folder',
          key: 'MessageTaskOpmlImportFeedPodcastFailed'
        }
        TaskManager.createAndEmitFailedTask('opml-import-feed', taskTitleStringFeed, taskDescriptionStringPodcast, taskErrorString)
        continue
      }

      const newPodcastMetadata = {
        title: feed.metadata.title,
        author: feed.metadata.author,
        description: feed.metadata.description,
        releaseDate: '',
        genres: [...feed.metadata.categories],
        feedUrl: feed.metadata.feedUrl,
        imageUrl: feed.metadata.image,
        itunesPageUrl: '',
        itunesId: '',
        itunesArtistId: '',
        language: '',
        numEpisodes: feed.numEpisodes
      }

      const libraryItemFolderStats = await getFileTimestampsWithIno(podcastPath)
      const libraryItemPayload = {
        path: podcastPath,
        relPath: podcastFilename,
        folderId: folder.id,
        libraryId: folder.libraryId,
        ino: libraryItemFolderStats.ino,
        mtimeMs: libraryItemFolderStats.mtimeMs || 0,
        ctimeMs: libraryItemFolderStats.ctimeMs || 0,
        birthtimeMs: libraryItemFolderStats.birthtimeMs || 0,
        media: {
          metadata: newPodcastMetadata,
          autoDownloadEpisodes
        }
      }

      const libraryItem = new LibraryItem()
      libraryItem.setData('podcast', libraryItemPayload)

      // Download and save cover image
      if (newPodcastMetadata.imageUrl) {
        // TODO: Scan cover image to library files
        // Podcast cover will always go into library item folder
        const coverResponse = await CoverManager.downloadCoverFromUrl(libraryItem, newPodcastMetadata.imageUrl, true)
        if (coverResponse) {
          if (coverResponse.error) {
            Logger.error(`[PodcastManager] createPodcastsFromFeedUrls: Download cover error from "${newPodcastMetadata.imageUrl}": ${coverResponse.error}`)
          } else if (coverResponse.cover) {
            libraryItem.media.coverPath = coverResponse.cover
          }
        }
      }

      await Database.createLibraryItem(libraryItem)
      SocketAuthority.emitter('item_added', libraryItem.toJSONExpanded())

      // Turn on podcast auto download cron if not already on
      if (libraryItem.media.autoDownloadEpisodes) {
        cronManager.checkUpdatePodcastCron(libraryItem)
      }

      numPodcastsAdded++
    }
    const taskFinishedString = {
      text: `Added ${numPodcastsAdded} podcasts`,
      key: 'MessageTaskOpmlImportFinished',
      subs: [numPodcastsAdded]
    }
    task.setFinished(taskFinishedString)
    TaskManager.taskFinished(task)
    Logger.info(`[PodcastManager] createPodcastsFromFeedUrls: Finished OPML import. Created ${numPodcastsAdded} podcasts out of ${rssFeedUrls.length} RSS feed URLs`)
  }
}
module.exports = PodcastManager
