const { BookCoverAspectRatio } = require('../../utils/constants')

class LibrarySettings {
  constructor(settings) {
    this.coverAspectRatio = BookCoverAspectRatio.SQUARE
    this.disableWatcher = false
    this.skipMatchingMediaWithAsin = false
    this.skipMatchingMediaWithIsbn = false
    this.autoScanCronExpression = null

    if (settings) {
      this.construct(settings)
    }
  }

  construct(settings) {
    this.coverAspectRatio = !isNaN(settings.coverAspectRatio) ? settings.coverAspectRatio : BookCoverAspectRatio.SQUARE
    this.disableWatcher = !!settings.disableWatcher
    this.skipMatchingMediaWithAsin = !!settings.skipMatchingMediaWithAsin
    this.skipMatchingMediaWithIsbn = !!settings.skipMatchingMediaWithIsbn
    this.autoScanCronExpression = settings.autoScanCronExpression || null
  }

  toJSON() {
    return {
      coverAspectRatio: this.coverAspectRatio,
      disableWatcher: this.disableWatcher,
      skipMatchingMediaWithAsin: this.skipMatchingMediaWithAsin,
      skipMatchingMediaWithIsbn: this.skipMatchingMediaWithIsbn,
      autoScanCronExpression: this.autoScanCronExpression
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
module.exports = LibrarySettings