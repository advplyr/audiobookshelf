const Sequelize = require('sequelize')
const cron = require('../libs/nodeCron')
const Logger = require('../Logger')
const Database = require('../Database')
const LibraryScanner = require('../scanner/LibraryScanner')

class CronManager {
  constructor(podcastManager) {
    this.podcastManager = podcastManager

    this.libraryScanCrons = []
    this.podcastCrons = []

    this.podcastCronExpressionsExecuting = []
  }

  /**
   * Initialize library scan crons & podcast download crons
   * @param {oldLibrary[]} libraries 
   */
  async init(libraries) {
    this.initLibraryScanCrons(libraries)
    await this.initPodcastCrons()
  }

  /**
   * Initialize library scan crons
   * @param {oldLibrary[]} libraries 
   */
  initLibraryScanCrons(libraries) {
    for (const library of libraries) {
      if (library.settings.autoScanCronExpression) {
        this.startCronForLibrary(library)
      }
    }
  }

  startCronForLibrary(library) {
    Logger.debug(`[CronManager] Init library scan cron for ${library.name} on schedule ${library.settings.autoScanCronExpression}`)
    const libScanCron = cron.schedule(library.settings.autoScanCronExpression, () => {
      Logger.debug(`[CronManager] Library scan cron executing for ${library.name}`)
      LibraryScanner.scan(library)
    })
    this.libraryScanCrons.push({
      libraryId: library.id,
      expression: library.settings.autoScanCronExpression,
      task: libScanCron
    })
  }

  removeCronForLibrary(library) {
    Logger.debug(`[CronManager] Removing library scan cron for ${library.name}`)
    this.libraryScanCrons = this.libraryScanCrons.filter(lsc => lsc.libraryId !== library.id)
  }

  updateLibraryScanCron(library) {
    const expression = library.settings.autoScanCronExpression
    const existingCron = this.libraryScanCrons.find(lsc => lsc.libraryId === library.id)

    if (!expression && existingCron) {
      if (existingCron.task.stop) existingCron.task.stop()

      this.removeCronForLibrary(library)
    } else if (!existingCron && expression) {
      this.startCronForLibrary(library)
    } else if (existingCron && existingCron.expression !== expression) {
      if (existingCron.task.stop) existingCron.task.stop()

      this.removeCronForLibrary(library)
      this.startCronForLibrary(library)
    }
  }

  /**
   * Init cron jobs for auto-download podcasts
   */
  async initPodcastCrons() {
    const cronExpressionMap = {}

    const podcastsWithAutoDownload = await Database.podcastModel.findAll({
      where: {
        autoDownloadEpisodes: true,
        autoDownloadSchedule: {
          [Sequelize.Op.not]: null
        }
      },
      include: {
        model: Database.libraryItemModel
      }
    })

    for (const podcast of podcastsWithAutoDownload) {
      if (!cronExpressionMap[podcast.autoDownloadSchedule]) {
        cronExpressionMap[podcast.autoDownloadSchedule] = {
          expression: podcast.autoDownloadSchedule,
          libraryItemIds: []
        }
      }
      cronExpressionMap[podcast.autoDownloadSchedule].libraryItemIds.push(podcast.libraryItem.id)
    }

    if (!Object.keys(cronExpressionMap).length) return

    Logger.debug(`[CronManager] Found ${Object.keys(cronExpressionMap).length} podcast episode schedules to start`)
    for (const expression in cronExpressionMap) {
      this.startPodcastCron(expression, cronExpressionMap[expression].libraryItemIds)
    }
  }

  startPodcastCron(expression, libraryItemIds) {
    try {
      Logger.debug(`[CronManager] Scheduling podcast episode check cron "${expression}" for ${libraryItemIds.length} item(s)`)
      const task = cron.schedule(expression, () => {
        if (this.podcastCronExpressionsExecuting.includes(expression)) {
          Logger.warn(`[CronManager] Podcast cron "${expression}" is already executing`)
        } else {
          this.executePodcastCron(expression, libraryItemIds)
        }
      })
      this.podcastCrons.push({
        libraryItemIds,
        expression,
        task
      })
    } catch (error) {
      Logger.error(`[PodcastManager] Failed to schedule podcast cron ${this.serverSettings.podcastEpisodeSchedule}`, error)
    }
  }

  async executePodcastCron(expression, libraryItemIds) {
    Logger.debug(`[CronManager] Start executing podcast cron ${expression} for ${libraryItemIds.length} item(s)`)
    const podcastCron = this.podcastCrons.find(cron => cron.expression === expression)
    if (!podcastCron) {
      Logger.error(`[CronManager] Podcast cron not found for expression ${expression}`)
      return
    }
    this.podcastCronExpressionsExecuting.push(expression)

    // Get podcast library items to check
    const libraryItems = []
    for (const libraryItemId of libraryItemIds) {
      const libraryItem = await Database.libraryItemModel.getOldById(libraryItemId)
      if (!libraryItem) {
        Logger.error(`[CronManager] Library item ${libraryItemId} not found for episode check cron ${expression}`)
        podcastCron.libraryItemIds = podcastCron.libraryItemIds.filter(lid => lid !== libraryItemId) // Filter it out
      } else {
        libraryItems.push(libraryItem)
      }
    }

    // Run episode checks
    for (const libraryItem of libraryItems) {
      const keepAutoDownloading = await this.podcastManager.runEpisodeCheck(libraryItem)
      if (!keepAutoDownloading) { // auto download was disabled
        podcastCron.libraryItemIds = podcastCron.libraryItemIds.filter(lid => lid !== libraryItem.id) // Filter it out
      }
    }

    // Stop and remove cron if no more library items
    if (!podcastCron.libraryItemIds.length) {
      this.removePodcastEpisodeCron(podcastCron)
      return
    }

    Logger.debug(`[CronManager] Finished executing podcast cron ${expression} for ${libraryItems.length} item(s)`)
    this.podcastCronExpressionsExecuting = this.podcastCronExpressionsExecuting.filter(exp => exp !== expression)
  }

  removePodcastEpisodeCron(podcastCron) {
    Logger.info(`[CronManager] Stopping & removing podcast episode cron for ${podcastCron.expression}`)
    if (podcastCron.task) podcastCron.task.stop()
    this.podcastCrons = this.podcastCrons.filter(pc => pc.expression !== podcastCron.expression)
  }

  checkUpdatePodcastCron(libraryItem) {
    // Remove from old cron by library item id
    const existingCron = this.podcastCrons.find(pc => pc.libraryItemIds.includes(libraryItem.id))
    if (existingCron) {
      existingCron.libraryItemIds = existingCron.libraryItemIds.filter(lid => lid !== libraryItem.id)
      if (!existingCron.libraryItemIds.length) {
        this.removePodcastEpisodeCron(existingCron)
      }
    }

    // Add to cron or start new cron
    if (libraryItem.media.autoDownloadEpisodes && libraryItem.media.autoDownloadSchedule) {
      const cronMatchingExpression = this.podcastCrons.find(pc => pc.expression === libraryItem.media.autoDownloadSchedule)
      if (cronMatchingExpression) {
        cronMatchingExpression.libraryItemIds.push(libraryItem.id)
        Logger.info(`[CronManager] Added podcast "${libraryItem.media.metadata.title}" to auto dl episode cron "${cronMatchingExpression.expression}"`)
      } else {
        this.startPodcastCron(libraryItem.media.autoDownloadSchedule, [libraryItem.id])
      }
    }
  }
}
module.exports = CronManager