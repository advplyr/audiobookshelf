const { CoverDestination } = require('../utils/constants')

class ServerSettings {
  constructor(settings) {
    this.id = 'server-settings'

    this.autoTagNew = false
    this.newTagExpireDays = 15
    this.scannerParseSubtitle = false
    this.coverDestination = CoverDestination.METADATA
    this.saveMetadataFile = false
    this.rateLimitLoginRequests = 10
    this.rateLimitLoginWindow = 10 * 60 * 1000 // 10 Minutes

    if (settings) {
      this.construct(settings)
    }
  }

  construct(settings) {
    this.autoTagNew = settings.autoTagNew
    this.newTagExpireDays = settings.newTagExpireDays
    this.scannerParseSubtitle = settings.scannerParseSubtitle
    this.coverDestination = settings.coverDestination || CoverDestination.METADATA
    this.saveMetadataFile = !!settings.saveMetadataFile
    this.rateLimitLoginRequests = !isNaN(settings.rateLimitLoginRequests) ? Number(settings.rateLimitLoginRequests) : 10
    this.rateLimitLoginWindow = !isNaN(settings.rateLimitLoginWindow) ? Number(settings.rateLimitLoginWindow) : 10 * 60 * 1000 // 10 Minutes
  }

  toJSON() {
    return {
      id: this.id,
      autoTagNew: this.autoTagNew,
      newTagExpireDays: this.newTagExpireDays,
      scannerParseSubtitle: this.scannerParseSubtitle,
      coverDestination: this.coverDestination,
      saveMetadataFile: !!this.saveMetadataFile,
      rateLimitLoginRequests: this.rateLimitLoginRequests,
      rateLimitLoginWindow: this.rateLimitLoginWindow
    }
  }

  update(payload) {
    var hasUpdates = false
    for (const key in payload) {
      if (this[key] !== payload[key]) {
        this[key] = payload[key]
        hasUpdates = true
      }
    }
    return hasUpdates
  }
}
module.exports = ServerSettings