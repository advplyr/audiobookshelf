const { CoverDestination } = require('../utils/constants')
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

    // Metadata
    this.coverDestination = CoverDestination.METADATA
    this.saveMetadataFile = false

    // Security/Rate limits
    this.rateLimitLoginRequests = 10
    this.rateLimitLoginWindow = 10 * 60 * 1000 // 10 Minutes

    // Backups
    // this.backupSchedule = '0 1 * * *' // If false then auto-backups are disabled (default every day at 1am)
    this.backupSchedule = false
    this.backupsToKeep = 2
    this.backupMetadataCovers = true

    this.logLevel = Logger.logLevel

    if (settings) {
      this.construct(settings)
    }
  }

  construct(settings) {
    this.autoTagNew = settings.autoTagNew
    this.newTagExpireDays = settings.newTagExpireDays
    this.scannerFindCovers = !!settings.scannerFindCovers
    this.scannerParseSubtitle = settings.scannerParseSubtitle
    this.coverDestination = settings.coverDestination || CoverDestination.METADATA
    this.saveMetadataFile = !!settings.saveMetadataFile
    this.rateLimitLoginRequests = !isNaN(settings.rateLimitLoginRequests) ? Number(settings.rateLimitLoginRequests) : 10
    this.rateLimitLoginWindow = !isNaN(settings.rateLimitLoginWindow) ? Number(settings.rateLimitLoginWindow) : 10 * 60 * 1000 // 10 Minutes

    this.backupSchedule = settings.backupSchedule || false
    this.backupsToKeep = settings.backupsToKeep || 2
    this.backupMetadataCovers = settings.backupMetadataCovers !== false

    this.logLevel = settings.logLevel || Logger.logLevel

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
      scannerParseSubtitle: this.scannerParseSubtitle,
      coverDestination: this.coverDestination,
      saveMetadataFile: !!this.saveMetadataFile,
      rateLimitLoginRequests: this.rateLimitLoginRequests,
      rateLimitLoginWindow: this.rateLimitLoginWindow,
      backupSchedule: this.backupSchedule,
      backupsToKeep: this.backupsToKeep,
      backupMetadataCovers: this.backupMetadataCovers,
      logLevel: this.logLevel
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