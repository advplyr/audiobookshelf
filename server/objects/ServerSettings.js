class ServerSettings {
  constructor(settings) {
    this.id = 'server-settings'
    this.autoTagNew = false
    this.newTagExpireDays = 15
    this.scannerParseSubtitle = false

    if (settings) {
      this.construct(settings)
    }
  }

  construct(settings) {
    this.autoTagNew = settings.autoTagNew
    this.newTagExpireDays = settings.newTagExpireDays
    this.scannerParseSubtitle = settings.scannerParseSubtitle
  }

  toJSON() {
    return {
      id: this.id,
      autoTagNew: this.autoTagNew,
      newTagExpireDays: this.newTagExpireDays,
      scannerParseSubtitle: this.scannerParseSubtitle
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