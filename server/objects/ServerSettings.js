const { BookCoverAspectRatio, BookshelfView } = require('../utils/constants')
const Logger = require('../Logger')

class ServerSettings {
  constructor(settings) {
    this.id = 'server-settings'

    // Misc/Unused
    this.autoTagNew = false
    this.newTagExpireDays = 15

    // Scanner
    this.scannerParseSubtitle = false
    this.scannerFindCovers = false
    this.scannerCoverProvider = 'google'
    this.scannerPreferAudioMetadata = false
    this.scannerPreferOpfMetadata = false
    this.scannerDisableWatcher = false

    // Metadata
    this.storeCoverWithBook = false
    this.storeMetadataWithBook = false

    // Security/Rate limits
    this.rateLimitLoginRequests = 10
    this.rateLimitLoginWindow = 10 * 60 * 1000 // 10 Minutes

    // Backups
    // this.backupSchedule = '0 1 * * *' // If false then auto-backups are disabled (default every day at 1am)
    this.backupSchedule = false
    this.backupsToKeep = 2
    this.backupMetadataCovers = true

    // Logger
    this.loggerDailyLogsToKeep = 7
    this.loggerScannerLogsToKeep = 2

    // Cover
    this.coverAspectRatio = BookCoverAspectRatio.SQUARE
    this.bookshelfView = BookshelfView.STANDARD

    this.sortingIgnorePrefix = false
    this.chromecastEnabled = false
    this.logLevel = Logger.logLevel
    this.version = null

    if (settings) {
      this.construct(settings)
    }
  }

  construct(settings) {
    this.autoTagNew = settings.autoTagNew
    this.newTagExpireDays = settings.newTagExpireDays
    this.scannerFindCovers = !!settings.scannerFindCovers
    this.scannerCoverProvider = settings.scannerCoverProvider || 'google'
    this.scannerParseSubtitle = settings.scannerParseSubtitle
    this.scannerPreferAudioMetadata = !!settings.scannerPreferAudioMetadata
    this.scannerPreferOpfMetadata = !!settings.scannerPreferOpfMetadata
    this.scannerDisableWatcher = !!settings.scannerDisableWatcher

    this.storeCoverWithBook = settings.storeCoverWithBook
    if (this.storeCoverWithBook == undefined) { // storeCoverWithBook added in 1.7.1 to replace coverDestination
      this.storeCoverWithBook = !!settings.coverDestination
    }
    this.storeMetadataWithBook = !!settings.storeCoverWithBook

    this.rateLimitLoginRequests = !isNaN(settings.rateLimitLoginRequests) ? Number(settings.rateLimitLoginRequests) : 10
    this.rateLimitLoginWindow = !isNaN(settings.rateLimitLoginWindow) ? Number(settings.rateLimitLoginWindow) : 10 * 60 * 1000 // 10 Minutes

    this.backupSchedule = settings.backupSchedule || false
    this.backupsToKeep = settings.backupsToKeep || 2
    this.backupMetadataCovers = settings.backupMetadataCovers !== false

    this.loggerDailyLogsToKeep = settings.loggerDailyLogsToKeep || 7
    this.loggerScannerLogsToKeep = settings.loggerScannerLogsToKeep || 2

    this.coverAspectRatio = !isNaN(settings.coverAspectRatio) ? settings.coverAspectRatio : BookCoverAspectRatio.SQUARE
    this.bookshelfView = settings.bookshelfView || BookshelfView.STANDARD

    this.sortingIgnorePrefix = !!settings.sortingIgnorePrefix
    this.chromecastEnabled = !!settings.chromecastEnabled
    this.logLevel = settings.logLevel || Logger.logLevel
    this.version = settings.version || null

    if (this.logLevel !== Logger.logLevel) {
      Logger.setLogLevel(this.logLevel)
    }
  }

  toJSON() {
    return {
      id: this.id,
      autoTagNew: this.autoTagNew,
      newTagExpireDays: this.newTagExpireDays,
      scannerFindCovers: this.scannerFindCovers,
      scannerCoverProvider: this.scannerCoverProvider,
      scannerParseSubtitle: this.scannerParseSubtitle,
      scannerPreferAudioMetadata: this.scannerPreferAudioMetadata,
      scannerPreferOpfMetadata: this.scannerPreferOpfMetadata,
      scannerDisableWatcher: this.scannerDisableWatcher,
      storeCoverWithBook: this.storeCoverWithBook,
      storeMetadataWithBook: this.storeMetadataWithBook,
      rateLimitLoginRequests: this.rateLimitLoginRequests,
      rateLimitLoginWindow: this.rateLimitLoginWindow,
      backupSchedule: this.backupSchedule,
      backupsToKeep: this.backupsToKeep,
      backupMetadataCovers: this.backupMetadataCovers,
      loggerDailyLogsToKeep: this.loggerDailyLogsToKeep,
      loggerScannerLogsToKeep: this.loggerScannerLogsToKeep,
      coverAspectRatio: this.coverAspectRatio,
      bookshelfView: this.bookshelfView,
      sortingIgnorePrefix: this.sortingIgnorePrefix,
      chromecastEnabled: this.chromecastEnabled,
      logLevel: this.logLevel,
      version: this.version
    }
  }

  update(payload) {
    var hasUpdates = false
    for (const key in payload) {
      if (this[key] !== payload[key]) {
        if (key === 'logLevel') {
          Logger.setLogLevel(payload[key])
        }
        this[key] = payload[key]
        hasUpdates = true
      }
    }
    return hasUpdates
  }
}
module.exports = ServerSettings