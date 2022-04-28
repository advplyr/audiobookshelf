const { BookCoverAspectRatio } = require('../../utils/constants')
const Logger = require('../../Logger')

class LibrarySettings {
  constructor(settings) {
    this.disableWatcher = false
    this.skipMatchingMediaWithAsin = false
    this.skipMatchingMediaWithIsbn = false

    if (settings) {
      this.construct(settings)
    }
  }

  construct(settings) {
    this.disableWatcher = !!settings.disableWatcher
    this.skipMatchingMediaWithAsin = !!settings.skipMatchingMediaWithAsin
    this.skipMatchingMediaWithIsbn = !!settings.skipMatchingMediaWithIsbn
  }

  toJSON() {
    return {
      disableWatcher: this.disableWatcher,
      skipMatchingMediaWithAsin: this.skipMatchingMediaWithAsin,
      skipMatchingMediaWithIsbn: this.skipMatchingMediaWithIsbn
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