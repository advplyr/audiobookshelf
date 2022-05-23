class ScanOptions {
  constructor(options) {
    this.forceRescan = false

    // Server settings
    this.parseSubtitles = false
    this.findCovers = false
    this.storeCoverWithItem = false
    this.preferAudioMetadata = false
    this.preferOpfMetadata = false
    this.preferMatchedMetadata = false

    if (options) {
      this.construct(options)
    }
  }

  construct(options) {
    for (const key in options) {
      if (key === 'metadataPrecedence' && options[key].length) {
        this.metadataPrecedence = [...options[key]]
      } else if (this[key] !== undefined) {
        this[key] = options[key]
      }
    }
  }

  toJSON() {
    return {
      forceRescan: this.forceRescan,
      metadataPrecedence: this.metadataPrecedence,
      parseSubtitles: this.parseSubtitles,
      findCovers: this.findCovers,
      storeCoverWithItem: this.storeCoverWithItem,
      preferAudioMetadata: this.preferAudioMetadata,
      preferOpfMetadata: this.preferOpfMetadata,
      preferOpfMetadata: this.preferMatchedMetadata
    }
  }

  setData(options, serverSettings) {
    this.forceRescan = !!options.forceRescan

    this.parseSubtitles = !!serverSettings.scannerParseSubtitle
    this.findCovers = !!serverSettings.scannerFindCovers
    this.storeCoverWithItem = serverSettings.storeCoverWithItem
    this.preferAudioMetadata = serverSettings.scannerPreferAudioMetadata
    this.preferOpfMetadata = serverSettings.scannerPreferOpfMetadata
    this.preferOpfMetadata = serverSettings.scannerPreferMatchedMetadata
  }
}
module.exports = ScanOptions