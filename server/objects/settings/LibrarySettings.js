const { BookCoverAspectRatio } = require('../../utils/constants')

class LibrarySettings {
  constructor(settings) {
    this.coverAspectRatio = BookCoverAspectRatio.SQUARE
    this.disableWatcher = false
    this.skipMatchingMediaWithAsin = false
    this.skipMatchingMediaWithIsbn = false
    this.autoScanCronExpression = null
    this.audiobooksOnly = false
    this.hideSingleBookSeries = false // Do not show series that only have 1 book
    this.onlyShowLaterBooksInContinueSeries = false // Skip showing books that are earlier than the max sequence read
    this.metadataPrecedence = ['folderStructure', 'audioMetatags', 'nfoFile', 'txtFiles', 'opfFile', 'absMetadata']
    this.podcastSearchRegion = 'us'

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
    this.audiobooksOnly = !!settings.audiobooksOnly
    this.hideSingleBookSeries = !!settings.hideSingleBookSeries
    this.onlyShowLaterBooksInContinueSeries = !!settings.onlyShowLaterBooksInContinueSeries
    if (settings.metadataPrecedence) {
      this.metadataPrecedence = [...settings.metadataPrecedence]
    } else {
      // Added in v2.4.5
      this.metadataPrecedence = ['folderStructure', 'audioMetatags', 'nfoFile', 'txtFiles', 'opfFile', 'absMetadata']
    }
    this.podcastSearchRegion = settings.podcastSearchRegion || 'us'
  }

  toJSON() {
    return {
      coverAspectRatio: this.coverAspectRatio,
      disableWatcher: this.disableWatcher,
      skipMatchingMediaWithAsin: this.skipMatchingMediaWithAsin,
      skipMatchingMediaWithIsbn: this.skipMatchingMediaWithIsbn,
      autoScanCronExpression: this.autoScanCronExpression,
      audiobooksOnly: this.audiobooksOnly,
      hideSingleBookSeries: this.hideSingleBookSeries,
      onlyShowLaterBooksInContinueSeries: this.onlyShowLaterBooksInContinueSeries,
      metadataPrecedence: [...this.metadataPrecedence],
      podcastSearchRegion: this.podcastSearchRegion
    }
  }

  update(payload) {
    let hasUpdates = false
    for (const key in payload) {
      if (key === 'metadataPrecedence') {
        if (payload[key] && Array.isArray(payload[key]) && payload[key].join() !== this[key].join()) {
          this[key] = payload[key]
          hasUpdates = true
        }
      } else if (this[key] !== payload[key]) {
        this[key] = payload[key]
        hasUpdates = true
      }
    }
    return hasUpdates
  }
}
module.exports = LibrarySettings