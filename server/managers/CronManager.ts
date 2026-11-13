import { Op } from 'sequelize'
import cron from '../libs/nodeCron'
import Logger from '../Logger'
import Database from '../Database'
import LibraryScanner from '../scanner/LibraryScanner'

import ShareManager from './ShareManager'
import type Library from '../models/Library'
import type PodcastManager from './PodcastManager'
import type PlaybackSessionManager from './PlaybackSessionManager'

type ScheduledTask = { stop(): void }

type LibraryScanCron = { libraryId: string; expression: string; task: ScheduledTask }
type PodcastSchedule = { libraryItemIds: string[]; expression: string }
type PodcastCron = PodcastSchedule & { task: ScheduledTask }
type ScheduledPodcastItem = {
  id: string
  media: {
    autoDownloadEpisodes?: boolean | null
    autoDownloadSchedule?: string | null
    title?: string | null
    metadata?: { title?: string | null } | null
  }
}

class CronManager {
  declare podcastManager: PodcastManager
  declare playbackSessionManager: PlaybackSessionManager
  declare libraryScanCrons: LibraryScanCron[]
  declare podcastCrons: PodcastCron[]
  declare podcastCronExpressionsExecuting: string[]

  constructor(podcastManager: PodcastManager, playbackSessionManager: PlaybackSessionManager) {
    this.podcastManager = podcastManager
    this.playbackSessionManager = playbackSessionManager

    this.libraryScanCrons = []
    this.podcastCrons = []

    this.podcastCronExpressionsExecuting = []
  }

  /**
   * Initialize library scan crons & podcast download crons
   *
   */
  async init(libraries: Library[]) {
    this.initOpenSessionCleanupCron()
    this.initLibraryScanCrons(libraries)
    await this.initPodcastCrons()
  }

  /**
   * Initialize open session & auth session cleanup cron
   * Runs every day at 00:30
   * Closes open share sessions that have not been updated in 24 hours
   * Closes open playback sessions that have not been updated in 36 hours
   * Cleans up expired auth sessions
   * Deactivates expired api keys
   * TODO: Clients should re-open the session if it is closed so that stale sessions can be closed sooner
   */
  initOpenSessionCleanupCron() {
    cron.schedule('30 0 * * *', async () => {
      Logger.debug('[CronManager] Open session cleanup cron executing')
      ShareManager.closeStaleOpenShareSessions()
      await this.playbackSessionManager.closeStaleOpenSessions()
      await Database.cleanupExpiredSessions()
      await Database.deactivateExpiredApiKeys()
    })
  }

  /**
   * Initialize library scan crons
   */
  initLibraryScanCrons(libraries: Library[]) {
    for (const library of libraries) {
      if (library.settings!.autoScanCronExpression) {
        this.startCronForLibrary(library)
      }
    }
  }

  /**
   * Start cron schedule for library
   *
   */
  startCronForLibrary(_library: Library) {
    Logger.debug(`[CronManager] Init library scan cron for ${_library.name} on schedule ${_library.settings!.autoScanCronExpression}`)
    const libScanCron = cron.schedule(_library.settings!.autoScanCronExpression!, async () => {
      const library = await Database.libraryModel.findByIdWithFolders(_library.id)
      if (!library) {
        Logger.error(`[CronManager] Library not found for scan cron ${_library.id}`)
      } else {
        Logger.debug(`[CronManager] Library scan cron executing for ${library.name}`)
        void LibraryScanner.scan(library)
      }
    })
    this.libraryScanCrons.push({
      libraryId: _library.id,
      expression: _library.settings!.autoScanCronExpression!,
      task: libScanCron
    })
  }

  removeCronForLibrary(library: Library) {
    Logger.debug(`[CronManager] Removing library scan cron for ${library.name}`)
    this.libraryScanCrons = this.libraryScanCrons.filter((lsc) => lsc.libraryId !== library.id)
  }

  updateLibraryScanCron(library: Library) {
    const expression = library.settings!.autoScanCronExpression
    const existingCron = this.libraryScanCrons.find((lsc) => lsc.libraryId === library.id)

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
    const cronExpressionMap: Record<string, PodcastSchedule> = {}

    const podcastsWithAutoDownload = await Database.podcastModel.findAll({
      where: {
        autoDownloadEpisodes: true,
        autoDownloadSchedule: {
          [Op.not]: null
        }
      },
      include: {
        model: Database.libraryItemModel
      }
    })

    for (const podcast of podcastsWithAutoDownload) {
      // The query filters out null schedules and includes the library item.
      const expression = podcast.autoDownloadSchedule!
      if (!cronExpressionMap[expression]) {
        cronExpressionMap[expression] = {
          expression,
          libraryItemIds: []
        }
      }
      cronExpressionMap[expression].libraryItemIds.push(podcast.libraryItem!.id)
    }

    if (!Object.keys(cronExpressionMap).length) return

    Logger.debug(`[CronManager] Found ${Object.keys(cronExpressionMap).length} podcast episode schedules to start`)
    for (const expression in cronExpressionMap) {
      this.startPodcastCron(expression, cronExpressionMap[expression].libraryItemIds)
    }
  }

  startPodcastCron(expression: string, libraryItemIds: string[]) {
    try {
      if (!cron.validate(expression)) {
        Logger.error(`[CronManager] Invalid auto download schedule cron expression "${expression}" - not starting podcast episode check cron`)
        return
      }

      Logger.debug(`[CronManager] Scheduling podcast episode check cron "${expression}" for ${libraryItemIds.length} item(s)`)
      const task = cron.schedule(expression, () => {
        if (this.podcastCronExpressionsExecuting.includes(expression)) {
          Logger.warn(`[CronManager] Podcast cron "${expression}" is already executing`)
        } else {
          void this.executePodcastCron(expression)
        }
      })
      this.podcastCrons.push({
        libraryItemIds,
        expression,
        task
      })
    } catch (error) {
      Logger.error(`[PodcastManager] Failed to schedule podcast cron ${expression}`, error)
    }
  }

  async executePodcastCron(expression: string) {
    const podcastCron = this.podcastCrons.find((cron) => cron.expression === expression)
    if (!podcastCron) {
      Logger.error(`[CronManager] Podcast cron not found for expression ${expression}`)
      return
    }
    this.podcastCronExpressionsExecuting.push(expression)

    const libraryItemIds = podcastCron.libraryItemIds
    Logger.debug(`[CronManager] Start executing podcast cron ${expression} for ${libraryItemIds.length} item(s)`)

    // Get podcast library items to check
    const libraryItems = []
    for (const libraryItemId of libraryItemIds) {
      const libraryItem = await Database.libraryItemModel.getExpandedById(libraryItemId)
      if (!libraryItem) {
        Logger.error(`[CronManager] Library item ${libraryItemId} not found for episode check cron ${expression}`)
        podcastCron.libraryItemIds = podcastCron.libraryItemIds.filter((lid) => lid !== libraryItemId) // Filter it out
      } else {
        libraryItems.push(libraryItem)
      }
    }

    // Run episode checks
    for (const libraryItem of libraryItems) {
      // IDs in this schedule come from podcast items with their episodes loaded.
      const keepAutoDownloading = await this.podcastManager.runEpisodeCheck(libraryItem as Parameters<PodcastManager['runEpisodeCheck']>[0])
      if (!keepAutoDownloading) {
        // auto download was disabled
        podcastCron.libraryItemIds = podcastCron.libraryItemIds.filter((lid) => lid !== libraryItem.id) // Filter it out
      }
    }

    // Stop and remove cron if no more library items
    if (!podcastCron.libraryItemIds.length) {
      this.removePodcastEpisodeCron(podcastCron)
      return
    }

    Logger.debug(`[CronManager] Finished executing podcast cron ${expression} for ${libraryItems.length} item(s)`)
    this.podcastCronExpressionsExecuting = this.podcastCronExpressionsExecuting.filter((exp) => exp !== expression)
  }

  removePodcastEpisodeCron(podcastCron: PodcastCron) {
    Logger.info(`[CronManager] Stopping & removing podcast episode cron for ${podcastCron.expression}`)
    if (podcastCron.task) podcastCron.task.stop()
    this.podcastCrons = this.podcastCrons.filter((pc) => pc.expression !== podcastCron.expression)
  }

  checkUpdatePodcastCron(libraryItem: ScheduledPodcastItem) {
    // Remove from old cron by library item id
    const existingCron = this.podcastCrons.find((pc) => pc.libraryItemIds.includes(libraryItem.id))
    if (existingCron) {
      existingCron.libraryItemIds = existingCron.libraryItemIds.filter((lid) => lid !== libraryItem.id)
      if (!existingCron.libraryItemIds.length) {
        this.removePodcastEpisodeCron(existingCron)
      }
    }

    // Add to cron or start new cron
    if (libraryItem.media.autoDownloadEpisodes && libraryItem.media.autoDownloadSchedule) {
      const cronMatchingExpression = this.podcastCrons.find((pc) => pc.expression === libraryItem.media.autoDownloadSchedule)
      if (cronMatchingExpression) {
        cronMatchingExpression.libraryItemIds.push(libraryItem.id)

        // TODO: Update after old model removed
        const podcastTitle = libraryItem.media.title || libraryItem.media.metadata?.title
        Logger.info(`[CronManager] Added podcast "${podcastTitle}" to auto dl episode cron "${cronMatchingExpression.expression}"`)
      } else {
        this.startPodcastCron(libraryItem.media.autoDownloadSchedule, [libraryItem.id])
      }
    }
  }
}
export = CronManager
