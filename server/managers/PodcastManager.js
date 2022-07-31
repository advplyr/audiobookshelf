const fs = require('../libs/fsExtra')
const cron = require('../libs/nodeCron')
const axios = require('axios')

const { parsePodcastRssFeedXml } = require('../utils/podcastUtils')
const Logger = require('../Logger')

const { downloadFile } = require('../utils/fileUtils')
const { levenshteinDistance } = require('../utils/index')
const opmlParser = require('../utils/parsers/parseOPML')
const prober = require('../utils/prober')
const LibraryFile = require('../objects/files/LibraryFile')
const PodcastEpisodeDownload = require('../objects/PodcastEpisodeDownload')
const PodcastEpisode = require('../objects/entities/PodcastEpisode')
const AudioFile = require('../objects/files/AudioFile')

class PodcastManager {
  constructor(db, watcher, emitter) {
    this.db = db
    this.watcher = watcher
    this.emitter = emitter

    this.downloadQueue = []
    this.currentDownload = null

    this.episodeScheduleTask = null
    this.failedCheckMap = {},
      this.MaxFailedEpisodeChecks = 24
  }

  get serverSettings() {
    return this.db.serverSettings || {}
  }

  init() {
    var podcastsWithAutoDownload = this.db.libraryItems.some(li => li.mediaType === 'podcast' && li.media.autoDownloadEpisodes)
    if (podcastsWithAutoDownload) {
      this.schedulePodcastEpisodeCron()
    }
  }

  getEpisodeDownloadsInQueue(libraryItemId) {
    return this.downloadQueue.filter(d => d.libraryItemId === libraryItemId)
  }

  clearDownloadQueue(libraryItemId = null) {
    if (!this.downloadQueue.length) return

    if (!libraryItemId) {
      Logger.info(`[PodcastManager] Clearing all downloads in queue (${this.downloadQueue.length})`)
      this.downloadQueue = []
    } else {
      var itemDownloads = this.getEpisodeDownloadsInQueue(libraryItemId)
      Logger.info(`[PodcastManager] Clearing downloads in queue for item "${libraryItemId}" (${itemDownloads.length})`)
      this.downloadQueue = this.downloadQueue.filter(d => d.libraryItemId !== libraryItemId)
    }
  }

  async downloadPodcastEpisodes(libraryItem, episodesToDownload) {
    var index = libraryItem.media.episodes.length + 1
    episodesToDownload.forEach((ep) => {
      var newPe = new PodcastEpisode()
      newPe.setData(ep, index++)
      newPe.libraryItemId = libraryItem.id
      var newPeDl = new PodcastEpisodeDownload()
      newPeDl.setData(newPe, libraryItem)
      this.startPodcastEpisodeDownload(newPeDl)
    })
  }

  async startPodcastEpisodeDownload(podcastEpisodeDownload) {
    if (this.currentDownload) {
      this.downloadQueue.push(podcastEpisodeDownload)
      this.emitter('episode_download_queued', podcastEpisodeDownload.toJSONForClient())
      return
    }

    this.emitter('episode_download_started', podcastEpisodeDownload.toJSONForClient())
    this.currentDownload = podcastEpisodeDownload

    // Ignores all added files to this dir
    this.watcher.addIgnoreDir(this.currentDownload.libraryItem.path)

    var success = await downloadFile(this.currentDownload.url, this.currentDownload.targetPath).then(() => true).catch((error) => {
      Logger.error(`[PodcastManager] Podcast Episode download failed`, error)
      return false
    })
    if (success) {
      success = await this.scanAddPodcastEpisodeAudioFile()
      if (!success) {
        await fs.remove(this.currentDownload.targetPath)
        this.currentDownload.setFinished(false)
      } else {
        Logger.info(`[PodcastManager] Successfully downloaded podcast episode "${this.currentDownload.podcastEpisode.title}"`)
        this.currentDownload.setFinished(true)
      }
    } else {
      this.currentDownload.setFinished(false)
    }

    this.emitter('episode_download_finished', this.currentDownload.toJSONForClient())

    this.watcher.removeIgnoreDir(this.currentDownload.libraryItem.path)
    this.currentDownload = null
    if (this.downloadQueue.length) {
      this.startPodcastEpisodeDownload(this.downloadQueue.shift())
    }
  }

  async scanAddPodcastEpisodeAudioFile() {
    var libraryFile = await this.getLibraryFile(this.currentDownload.targetPath, this.currentDownload.targetRelPath)

    // TODO: Set meta tags on new audio file

    var audioFile = await this.probeAudioFile(libraryFile)
    if (!audioFile) {
      return false
    }

    var libraryItem = this.db.libraryItems.find(li => li.id === this.currentDownload.libraryItem.id)
    if (!libraryItem) {
      Logger.error(`[PodcastManager] Podcast Episode finished but library item was not found ${this.currentDownload.libraryItem.id}`)
      return false
    }

    var podcastEpisode = this.currentDownload.podcastEpisode
    podcastEpisode.audioFile = audioFile
    libraryItem.media.addPodcastEpisode(podcastEpisode)
    if (libraryItem.isInvalid) {
      // First episode added to an empty podcast
      libraryItem.isInvalid = false
    }
    libraryItem.libraryFiles.push(libraryFile)
    libraryItem.updatedAt = Date.now()
    await this.db.updateLibraryItem(libraryItem)
    this.emitter('item_updated', libraryItem.toJSONExpanded())
    return true
  }

  async getLibraryFile(path, relPath) {
    var newLibFile = new LibraryFile()
    await newLibFile.setDataFromPath(path, relPath)
    return newLibFile
  }

  async probeAudioFile(libraryFile) {
    var path = libraryFile.metadata.path
    var mediaProbeData = await prober.probe(path)
    if (mediaProbeData.error) {
      Logger.error(`[PodcastManager] Podcast Episode downloaded but failed to probe "${path}"`, mediaProbeData.error)
      return false
    }
    var newAudioFile = new AudioFile()
    newAudioFile.setDataFromProbe(libraryFile, mediaProbeData)
    return newAudioFile
  }

  schedulePodcastEpisodeCron() {
    try {
      Logger.debug(`[PodcastManager] Scheduled podcast episode check cron "${this.serverSettings.podcastEpisodeSchedule}"`)
      this.episodeScheduleTask = cron.schedule(this.serverSettings.podcastEpisodeSchedule, () => {
        Logger.debug(`[PodcastManager] Running cron`)
        this.checkForNewEpisodes()
      })
    } catch (error) {
      Logger.error(`[PodcastManager] Failed to schedule podcast cron ${this.serverSettings.podcastEpisodeSchedule}`, error)
    }
  }

  cancelCron() {
    Logger.debug(`[PodcastManager] Canceled new podcast episode check cron`)
    if (this.episodeScheduleTask) {
      this.episodeScheduleTask.destroy()
      this.episodeScheduleTask = null
    }
  }

  async checkForNewEpisodes() {
    var podcastsWithAutoDownload = this.db.libraryItems.filter(li => li.mediaType === 'podcast' && li.media.autoDownloadEpisodes)
    if (!podcastsWithAutoDownload.length) {
      Logger.info(`[PodcastManager] checkForNewEpisodes - No podcasts with auto download set`)
      this.cancelCron()
      return
    }
    Logger.debug(`[PodcastManager] checkForNewEpisodes - Checking ${podcastsWithAutoDownload.length} Podcasts`)

    for (const libraryItem of podcastsWithAutoDownload) {
      const lastEpisodeCheckDate = new Date(libraryItem.media.lastEpisodeCheck || 0)
      const latestEpisodePublishedAt = libraryItem.media.latestEpisodePublished
      Logger.info(`[PodcastManager] checkForNewEpisodes: "${libraryItem.media.metadata.title}" | Last check: ${lastEpisodeCheckDate} | ${latestEpisodePublishedAt ? `Latest episode pubDate: ${new Date(latestEpisodePublishedAt)}` : 'No latest episode'}`)

      // Use latest episode pubDate if exists OR fallback to using lastEpisodeCheckDate
      //    lastEpisodeCheckDate will be the current time when adding a new podcast
      const dateToCheckForEpisodesAfter = latestEpisodePublishedAt || lastEpisodeCheckDate
      Logger.debug(`[PodcastManager] checkForNewEpisodes: "${libraryItem.media.metadata.title}" checking for episodes after ${new Date(dateToCheckForEpisodesAfter)}`)

      var newEpisodes = await this.checkPodcastForNewEpisodes(libraryItem, dateToCheckForEpisodesAfter)
      Logger.debug(`[PodcastManager] checkForNewEpisodes checked result ${newEpisodes ? newEpisodes.length : 'N/A'}`)

      if (!newEpisodes) { // Failed
        // Allow up to 3 failed attempts before disabling auto download
        if (!this.failedCheckMap[libraryItem.id]) this.failedCheckMap[libraryItem.id] = 0
        this.failedCheckMap[libraryItem.id]++
        if (this.failedCheckMap[libraryItem.id] >= this.MaxFailedEpisodeChecks) {
          Logger.error(`[PodcastManager] checkForNewEpisodes ${this.failedCheckMap[libraryItem.id]} failed attempts at checking episodes for "${libraryItem.media.metadata.title}" - disabling auto download`)
          libraryItem.media.autoDownloadEpisodes = false
          delete this.failedCheckMap[libraryItem.id]
        } else {
          Logger.warn(`[PodcastManager] checkForNewEpisodes ${this.failedCheckMap[libraryItem.id]} failed attempts at checking episodes for "${libraryItem.media.metadata.title}"`)
        }
      } else if (newEpisodes.length) {
        delete this.failedCheckMap[libraryItem.id]
        Logger.info(`[PodcastManager] Found ${newEpisodes.length} new episodes for podcast "${libraryItem.media.metadata.title}" - starting download`)
        this.downloadPodcastEpisodes(libraryItem, newEpisodes)
      } else {
        delete this.failedCheckMap[libraryItem.id]
        Logger.debug(`[PodcastManager] No new episodes for "${libraryItem.media.metadata.title}"`)
      }

      libraryItem.media.lastEpisodeCheck = Date.now()
      libraryItem.updatedAt = Date.now()
      await this.db.updateLibraryItem(libraryItem)
      this.emitter('item_updated', libraryItem.toJSONExpanded())
    }
  }

  async checkPodcastForNewEpisodes(podcastLibraryItem, dateToCheckForEpisodesAfter) {
    if (!podcastLibraryItem.media.metadata.feedUrl) {
      Logger.error(`[PodcastManager] checkPodcastForNewEpisodes no feed url for ${podcastLibraryItem.media.metadata.title} (ID: ${podcastLibraryItem.id})`)
      return false
    }
    var feed = await this.getPodcastFeed(podcastLibraryItem.media.metadata.feedUrl)
    if (!feed || !feed.episodes) {
      Logger.error(`[PodcastManager] checkPodcastForNewEpisodes invalid feed payload for ${podcastLibraryItem.media.metadata.title} (ID: ${podcastLibraryItem.id})`, feed)
      return false
    }

    // Filter new and not already has
    var newEpisodes = feed.episodes.filter(ep => ep.publishedAt > dateToCheckForEpisodesAfter && !podcastLibraryItem.media.checkHasEpisodeByFeedUrl(ep.enclosure.url))
    // Max new episodes for safety = 3
    newEpisodes = newEpisodes.slice(0, 3)
    return newEpisodes
  }

  async checkAndDownloadNewEpisodes(libraryItem) {
    const lastEpisodeCheckDate = new Date(libraryItem.media.lastEpisodeCheck || 0)
    Logger.info(`[PodcastManager] checkAndDownloadNewEpisodes for "${libraryItem.media.metadata.title}" - Last episode check: ${lastEpisodeCheckDate}`)
    var newEpisodes = await this.checkPodcastForNewEpisodes(libraryItem, libraryItem.media.lastEpisodeCheck)
    if (newEpisodes.length) {
      Logger.info(`[PodcastManager] Found ${newEpisodes.length} new episodes for podcast "${libraryItem.media.metadata.title}" - starting download`)
      this.downloadPodcastEpisodes(libraryItem, newEpisodes)
    } else {
      Logger.info(`[PodcastManager] No new episodes found for podcast "${libraryItem.media.metadata.title}"`)
    }

    libraryItem.media.lastEpisodeCheck = Date.now()
    libraryItem.updatedAt = Date.now()
    await this.db.updateLibraryItem(libraryItem)
    this.emitter('item_updated', libraryItem.toJSONExpanded())

    return newEpisodes
  }

  async findEpisode(rssFeedUrl, searchTitle) {
    const feed = await this.getPodcastFeed(rssFeedUrl).catch(() => {
      return null
    })
    if (!feed || !feed.episodes) {
      return null
    }

    const matches = []
    feed.episodes.forEach(ep => {
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

  getPodcastFeed(feedUrl, excludeEpisodeMetadata = false) {
    Logger.debug(`[PodcastManager] getPodcastFeed for "${feedUrl}"`)
    return axios.get(feedUrl, { timeout: 5000 }).then(async (data) => {
      if (!data || !data.data) {
        Logger.error('Invalid podcast feed request response')
        return false
      }
      Logger.debug(`[PodcastManager] getPodcastFeed for "${feedUrl}" success - parsing xml`)
      var payload = await parsePodcastRssFeedXml(data.data, excludeEpisodeMetadata)
      if (!payload) {
        return false
      }
      return payload.podcast
    }).catch((error) => {
      Logger.error('[PodcastManager] getPodcastFeed Error', error)
      return false
    })
  }

  async getOPMLFeeds(opmlText) {
    var extractedFeeds = opmlParser.parse(opmlText)
    if (!extractedFeeds || !extractedFeeds.length) {
      Logger.error('[PodcastManager] getOPMLFeeds: No RSS feeds found in OPML')
      return {
        error: 'No RSS feeds found in OPML'
      }
    }

    var rssFeedData = []

    for (let feed of extractedFeeds) {
      var feedData = await this.getPodcastFeed(feed.feedUrl, true)
      if (feedData) {
        feedData.metadata.feedUrl = feed.feedUrl
        rssFeedData.push(feedData)
      }
    }

    return {
      feeds: rssFeedData
    }
  }
}
module.exports = PodcastManager