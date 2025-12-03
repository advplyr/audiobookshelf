const Path = require('path')
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
const AudioFile = require('../objects/files/AudioFile')

class PodcastManager {
  constructor() {
    /** @type {PodcastEpisodeDownload[]} */
    this.downloadQueue = []
    /** @type {PodcastEpisodeDownload} */
    this.currentDownload = null

    this.failedCheckMap = {}
    this.MaxFailedEpisodeChecks = global.MaxFailedEpisodeChecks
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

  /**
   *
   * @param {import('../models/LibraryItem')} libraryItem
   * @param {import('../utils/podcastUtils').RssPodcastEpisode[]} episodesToDownload
   * @param {boolean} isAutoDownload - If this download was triggered by auto download
   */
  async downloadPodcastEpisodes(libraryItem, episodesToDownload, isAutoDownload) {
    for (const ep of episodesToDownload) {
      const newPeDl = new PodcastEpisodeDownload()
      newPeDl.setData(ep, libraryItem, isAutoDownload, libraryItem.libraryId)
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
      // Prevent downloading episodes from the same URL for the same library item.
      // Allow downloading for different library items in case of the same podcast existing in multiple libraries (e.g. different folders)
      if (this.downloadQueue.some((d) => d.url === podcastEpisodeDownload.url && d.libraryItem.id === podcastEpisodeDownload.libraryItem.id)) {
        Logger.warn(`[PodcastManager] Episode already in queue: "${this.currentDownload.episodeTitle}"`)
        return
      } else if (this.currentDownload.url === podcastEpisodeDownload.url && this.currentDownload.libraryItem.id === podcastEpisodeDownload.libraryItem.id) {
        Logger.warn(`[PodcastManager] Episode download already in progress for "${podcastEpisodeDownload.episodeTitle}"`)
        return
      }
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
      text: `Downloading episode "${podcastEpisodeDownload.episodeTitle}".`,
      key: 'MessageTaskDownloadingEpisodeDescription',
      subs: [podcastEpisodeDownload.episodeTitle]
    }
    const task = TaskManager.createAndAddTask('download-podcast-episode', taskTitleString, taskDescriptionString, false, taskData)

    SocketAuthority.emitter('episode_download_started', podcastEpisodeDownload.toJSONForClient())
    this.currentDownload = podcastEpisodeDownload

    // If this file already exists then append a uuid to the filename
    //  e.g. "/tagesschau 20 Uhr.mp3" becomes "/tagesschau 20 Uhr (ep_asdfasdf).mp3"
    //  this handles podcasts where every title is the same (ref https://github.com/advplyr/audiobookshelf/issues/1802)
    if (await fs.pathExists(this.currentDownload.targetPath)) {
      this.currentDownload.setAppendRandomId(true)
    }

    // Ignores all added files to this dir
    Watcher.addIgnoreDir(this.currentDownload.libraryItem.path)
    Watcher.ignoreFilePathsDownloading.add(this.currentDownload.targetPath)

    // Make sure podcast library item folder exists
    if (!(await fs.pathExists(this.currentDownload.libraryItem.path))) {
      Logger.warn(`[PodcastManager] Podcast episode download: Podcast folder no longer exists at "${this.currentDownload.libraryItem.path}" - Creating it`)
      await fs.mkdir(this.currentDownload.libraryItem.path)
    }

    // Download episode and tag it
    const ffmpegDownloadResponse = await ffmpegHelpers.downloadPodcastEpisode(this.currentDownload).catch((error) => {
      Logger.error(`[PodcastManager] Podcast Episode download failed`, error)
    })
    let success = !!ffmpegDownloadResponse?.success

    if (success) {
      // Attempt to ffprobe and add podcast episode audio file
      success = await this.scanAddPodcastEpisodeAudioFile()
      if (!success) {
        Logger.error(`[PodcastManager] Failed to scan and add podcast episode audio file - removing file`)
        await fs.remove(this.currentDownload.targetPath)
      }
    }

    // If failed due to ffmpeg or ffprobe error, retry without tagging
    // e.g. RSS feed may have incorrect file extension and file type
    // See https://github.com/advplyr/audiobookshelf/issues/3837
    // e.g. Ffmpeg may be download the file without streams causing the ffprobe to fail
    if (!success && !ffmpegDownloadResponse?.isRequestError) {
      Logger.info(`[PodcastManager] Retrying episode download without tagging`)
      // Download episode only
      success = await downloadFile(this.currentDownload.url, this.currentDownload.targetPath)
        .then(() => true)
        .catch((error) => {
          Logger.error(`[PodcastManager] Podcast Episode download failed`, error)
          return false
        })

      if (success) {
        success = await this.scanAddPodcastEpisodeAudioFile()
        if (!success) {
          Logger.error(`[PodcastManager] Failed to scan and add podcast episode audio file - removing file`)
          await fs.remove(this.currentDownload.targetPath)
        }
      }
    }

    if (success) {
      Logger.info(`[PodcastManager] Successfully downloaded podcast episode "${this.currentDownload.episodeTitle}"`)
      this.currentDownload.setFinished(true)
      task.setFinished()
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

  /**
   * Scans the downloaded audio file, create the podcast episode, remove oldest episode if necessary
   * @returns {Promise<boolean>} - Returns true if added
   */
  async scanAddPodcastEpisodeAudioFile() {
    const libraryFile = new LibraryFile()
    await libraryFile.setDataFromPath(this.currentDownload.targetPath, this.currentDownload.targetRelPath)

    const audioFile = await this.probeAudioFile(libraryFile)
    if (!audioFile) {
      return false
    }

    const libraryItem = await Database.libraryItemModel.getExpandedById(this.currentDownload.libraryItem.id)
    if (!libraryItem) {
      Logger.error(`[PodcastManager] Podcast Episode finished but library item was not found ${this.currentDownload.libraryItem.id}`)
      return false
    }

    const podcastEpisode = await Database.podcastEpisodeModel.createFromRssPodcastEpisode(this.currentDownload.rssPodcastEpisode, libraryItem.media.id, audioFile)

    libraryItem.libraryFiles.push(libraryFile.toJSON())
    // Re-calculating library item size because this wasnt being updated properly for podcasts in v2.20.0 and below
    let libraryItemSize = 0
    libraryItem.libraryFiles.forEach((lf) => {
      if (lf.metadata.size && !isNaN(lf.metadata.size)) {
        libraryItemSize += Number(lf.metadata.size)
      }
    })
    libraryItem.size = libraryItemSize
    libraryItem.changed('libraryFiles', true)

    libraryItem.media.podcastEpisodes.push(podcastEpisode)

    if (this.currentDownload.isAutoDownload) {
      // Check setting maxEpisodesToKeep and remove episode if necessary
      const numEpisodesWithPubDate = libraryItem.media.podcastEpisodes.filter((ep) => !!ep.publishedAt).length
      if (libraryItem.media.maxEpisodesToKeep && numEpisodesWithPubDate > libraryItem.media.maxEpisodesToKeep) {
        Logger.info(`[PodcastManager] # of episodes (${numEpisodesWithPubDate}) exceeds max episodes to keep (${libraryItem.media.maxEpisodesToKeep})`)
        const episodeToRemove = await this.getRemoveOldestEpisode(libraryItem, podcastEpisode.id)
        if (episodeToRemove) {
          // Remove episode from playlists
          await Database.playlistModel.removeMediaItemsFromPlaylists([episodeToRemove.id])
          // Remove media progress for this episode
          await Database.mediaProgressModel.destroy({
            where: {
              mediaItemId: episodeToRemove.id
            }
          })
          await episodeToRemove.destroy()
          libraryItem.media.podcastEpisodes = libraryItem.media.podcastEpisodes.filter((ep) => ep.id !== episodeToRemove.id)

          // Remove library file
          libraryItem.libraryFiles = libraryItem.libraryFiles.filter((lf) => lf.ino !== episodeToRemove.audioFile.ino)
        }
      }
    }

    await libraryItem.save()

    if (libraryItem.media.numEpisodes !== libraryItem.media.podcastEpisodes.length) {
      libraryItem.media.numEpisodes = libraryItem.media.podcastEpisodes.length
      await libraryItem.media.save()
    }

    SocketAuthority.libraryItemEmitter('item_updated', libraryItem)
    const podcastEpisodeExpanded = podcastEpisode.toOldJSONExpanded(libraryItem.id)
    podcastEpisodeExpanded.libraryItem = libraryItem.toOldJSONExpanded()
    SocketAuthority.emitter('episode_added', podcastEpisodeExpanded)

    if (this.currentDownload.isAutoDownload) {
      // Notifications only for auto downloaded episodes
      NotificationManager.onPodcastEpisodeDownloaded(libraryItem, podcastEpisode)
    }

    return true
  }

  /**
   * Find oldest episode publishedAt and delete the audio file
   *
   * @param {import('../models/LibraryItem').LibraryItemExpanded} libraryItem
   * @param {string} episodeIdJustDownloaded
   * @returns {Promise<import('../models/PodcastEpisode')|null>} - Returns the episode to remove
   */
  async getRemoveOldestEpisode(libraryItem, episodeIdJustDownloaded) {
    let smallestPublishedAt = 0
    /** @type {import('../models/PodcastEpisode')} */
    let oldestEpisode = null

    /** @type {import('../models/PodcastEpisode')[]} */
    const podcastEpisodes = libraryItem.media.podcastEpisodes

    for (const ep of podcastEpisodes) {
      if (ep.id === episodeIdJustDownloaded || !ep.publishedAt) continue

      if (!smallestPublishedAt || ep.publishedAt < smallestPublishedAt) {
        smallestPublishedAt = ep.publishedAt
        oldestEpisode = ep
      }
    }

    if (oldestEpisode?.audioFile) {
      Logger.info(`[PodcastManager] Deleting oldest episode "${oldestEpisode.title}"`)
      const successfullyDeleted = await removeFile(oldestEpisode.audioFile.metadata.path)
      if (successfullyDeleted) {
        return oldestEpisode
      } else {
        Logger.warn(`[PodcastManager] Failed to remove oldest episode "${oldestEpisode.title}"`)
      }
    }
    return null
  }

  /**
   *
   * @param {LibraryFile} libraryFile
   * @returns {Promise<AudioFile|null>}
   */
  async probeAudioFile(libraryFile) {
    const path = libraryFile.metadata.path
    const mediaProbeData = await prober.probe(path)
    if (mediaProbeData.error) {
      Logger.error(`[PodcastManager] Podcast Episode downloaded but failed to probe "${path}"`, mediaProbeData.error)
      return null
    }
    const newAudioFile = new AudioFile()
    newAudioFile.setDataFromProbe(libraryFile, mediaProbeData)
    newAudioFile.index = 1
    return newAudioFile
  }

  /**
   *
   * @param {import('../models/LibraryItem')} libraryItem
   * @returns {Promise<boolean>} - Returns false if auto download episodes was disabled (disabled if reaches max failed checks)
   */
  async runEpisodeCheck(libraryItem) {
    const lastEpisodeCheck = libraryItem.media.lastEpisodeCheck?.valueOf() || 0
    const latestEpisodePublishedAt = libraryItem.media.getLatestEpisodePublishedAt()

    Logger.info(`[PodcastManager] runEpisodeCheck: "${libraryItem.media.title}" | Last check: ${new Date(lastEpisodeCheck)} | ${latestEpisodePublishedAt ? `Latest episode pubDate: ${new Date(latestEpisodePublishedAt)}` : 'No latest episode'}`)

    // Use latest episode pubDate if exists OR fallback to using lastEpisodeCheck
    //    lastEpisodeCheck will be the current time when adding a new podcast
    const dateToCheckForEpisodesAfter = latestEpisodePublishedAt || lastEpisodeCheck
    Logger.debug(`[PodcastManager] runEpisodeCheck: "${libraryItem.media.title}" checking for episodes after ${new Date(dateToCheckForEpisodesAfter)}`)

    const newEpisodes = await this.checkPodcastForNewEpisodes(libraryItem, dateToCheckForEpisodesAfter, libraryItem.media.maxNewEpisodesToDownload)
    Logger.debug(`[PodcastManager] runEpisodeCheck: ${newEpisodes?.length || 'N/A'} episodes found`)

    if (!newEpisodes) {
      // Failed
      // Allow up to MaxFailedEpisodeChecks failed attempts before disabling auto download
      if (!this.failedCheckMap[libraryItem.id]) this.failedCheckMap[libraryItem.id] = 0
      this.failedCheckMap[libraryItem.id]++
      if (this.MaxFailedEpisodeChecks !== 0 && this.failedCheckMap[libraryItem.id] >= this.MaxFailedEpisodeChecks) {
        Logger.error(`[PodcastManager] runEpisodeCheck ${this.failedCheckMap[libraryItem.id]} failed attempts at checking episodes for "${libraryItem.media.title}" - disabling auto download`)
        void NotificationManager.onRSSFeedDisabled(libraryItem.media.feedURL, this.failedCheckMap[libraryItem.id], libraryItem.media.title)
        libraryItem.media.autoDownloadEpisodes = false
        delete this.failedCheckMap[libraryItem.id]
      } else {
        Logger.warn(`[PodcastManager] runEpisodeCheck ${this.failedCheckMap[libraryItem.id]} failed attempts at checking episodes for "${libraryItem.media.title}"`)
        void NotificationManager.onRSSFeedFailed(libraryItem.media.feedURL, this.failedCheckMap[libraryItem.id], libraryItem.media.title)
      }
    } else if (newEpisodes.length) {
      delete this.failedCheckMap[libraryItem.id]
      Logger.info(`[PodcastManager] Found ${newEpisodes.length} new episodes for podcast "${libraryItem.media.title}" - starting download`)
      this.downloadPodcastEpisodes(libraryItem, newEpisodes, true)
    } else {
      delete this.failedCheckMap[libraryItem.id]
      Logger.debug(`[PodcastManager] No new episodes for "${libraryItem.media.title}"`)
    }

    libraryItem.media.lastEpisodeCheck = new Date()
    await libraryItem.media.save()

    libraryItem.changed('updatedAt', true)
    await libraryItem.save()

    SocketAuthority.libraryItemEmitter('item_updated', libraryItem)

    return libraryItem.media.autoDownloadEpisodes
  }

  /**
   *
   * @param {import('../models/LibraryItem')} podcastLibraryItem
   * @param {number} dateToCheckForEpisodesAfter - Unix timestamp
   * @param {number} maxNewEpisodes
   * @returns {Promise<import('../utils/podcastUtils').RssPodcastEpisode[]|null>}
   */
  async checkPodcastForNewEpisodes(podcastLibraryItem, dateToCheckForEpisodesAfter, maxNewEpisodes = 3) {
    if (!podcastLibraryItem.media.feedURL) {
      Logger.error(`[PodcastManager] checkPodcastForNewEpisodes no feed url for ${podcastLibraryItem.media.title} (ID: ${podcastLibraryItem.id})`)
      return null
    }
    const feed = await Promise.race([
      getPodcastFeed(podcastLibraryItem.media.feedURL),
      new Promise((_, reject) =>
        // The added second is to make sure that axios can fail first and only falls back later
        setTimeout(() => reject(new Error('Timeout. getPodcastFeed seemed to timeout but not triggering the timeout.')), global.PodcastDownloadTimeout + 1000)
      )
    ]).catch((error) => {
      Logger.error(`[PodcastManager] checkPodcastForNewEpisodes failed to fetch feed for ${podcastLibraryItem.media.title} (ID: ${podcastLibraryItem.id}):`, error)
      return null
    })

    if (!feed?.episodes) {
      Logger.error(`[PodcastManager] checkPodcastForNewEpisodes invalid feed payload for ${podcastLibraryItem.media.title} (ID: ${podcastLibraryItem.id})`, feed)
      return null
    }

    // Filter new and not already has
    let newEpisodes = feed.episodes.filter((ep) => ep.publishedAt > dateToCheckForEpisodesAfter && !podcastLibraryItem.media.checkHasEpisodeByFeedEpisode(ep))

    if (maxNewEpisodes > 0) {
      newEpisodes = newEpisodes.slice(0, maxNewEpisodes)
    }

    return newEpisodes
  }

  /**
   *
   * @param {import('../models/LibraryItem')} libraryItem
   * @param {*} maxEpisodesToDownload
   * @returns {Promise<import('../utils/podcastUtils').RssPodcastEpisode[]>}
   */
  async checkAndDownloadNewEpisodes(libraryItem, maxEpisodesToDownload) {
    const lastEpisodeCheck = libraryItem.media.lastEpisodeCheck?.valueOf() || 0
    const lastEpisodeCheckDate = lastEpisodeCheck > 0 ? libraryItem.media.lastEpisodeCheck : 'Never'
    Logger.info(`[PodcastManager] checkAndDownloadNewEpisodes for "${libraryItem.media.title}" - Last episode check: ${lastEpisodeCheckDate}`)

    const newEpisodes = await this.checkPodcastForNewEpisodes(libraryItem, lastEpisodeCheck, maxEpisodesToDownload)
    if (newEpisodes?.length) {
      Logger.info(`[PodcastManager] Found ${newEpisodes.length} new episodes for podcast "${libraryItem.media.title}" - starting download`)
      this.downloadPodcastEpisodes(libraryItem, newEpisodes, false)
    } else {
      Logger.info(`[PodcastManager] No new episodes found for podcast "${libraryItem.media.title}"`)
    }

    libraryItem.media.lastEpisodeCheck = new Date()
    await libraryItem.media.save()

    libraryItem.changed('updatedAt', true)
    await libraryItem.save()

    SocketAuthority.libraryItemEmitter('item_updated', libraryItem)

    return newEpisodes || []
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

      let newLibraryItem = null
      const transaction = await Database.sequelize.transaction()
      try {
        const libraryItemFolderStats = await getFileTimestampsWithIno(podcastPath)

        const podcastPayload = {
          autoDownloadEpisodes,
          metadata: {
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
        }
        const podcast = await Database.podcastModel.createFromRequest(podcastPayload, transaction)

        newLibraryItem = await Database.libraryItemModel.create(
          {
            ino: libraryItemFolderStats.ino,
            path: podcastPath,
            relPath: podcastFilename,
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
            libraryId: folder.libraryId,
            libraryFolderId: folder.id,
            title: podcast.title,
            titleIgnorePrefix: podcast.titleIgnorePrefix
          },
          { transaction }
        )

        await transaction.commit()
      } catch (error) {
        await transaction.rollback()
        Logger.error(`[PodcastManager] createPodcastsFromFeedUrls: Failed to create podcast library item for "${feed.metadata.title}"`, error)
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
          text: 'Failed to create podcast library item',
          key: 'MessageTaskOpmlImportFeedPodcastFailed'
        }
        TaskManager.createAndEmitFailedTask('opml-import-feed', taskTitleStringFeed, taskDescriptionStringPodcast, taskErrorString)
        continue
      }

      newLibraryItem.media = await newLibraryItem.getMediaExpanded()

      // Download and save cover image
      if (typeof feed.metadata.image === 'string' && feed.metadata.image.startsWith('http')) {
        // Podcast cover will always go into library item folder
        const coverResponse = await CoverManager.downloadCoverFromUrlNew(feed.metadata.image, newLibraryItem.id, newLibraryItem.path, true)
        if (coverResponse.error) {
          Logger.error(`[PodcastManager] Download cover error from "${feed.metadata.image}": ${coverResponse.error}`)
        } else if (coverResponse.cover) {
          const coverImageFileStats = await getFileTimestampsWithIno(coverResponse.cover)
          if (!coverImageFileStats) {
            Logger.error(`[PodcastManager] Failed to get cover image stats for "${coverResponse.cover}"`)
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

      // Turn on podcast auto download cron if not already on
      if (newLibraryItem.media.autoDownloadEpisodes) {
        cronManager.checkUpdatePodcastCron(newLibraryItem)
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
