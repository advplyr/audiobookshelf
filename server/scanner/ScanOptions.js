class ScanOptions {
  constructor() {
    this.forceRescan = false

    // Server settings
    this.parseSubtitles = false
    this.findCovers = false
    this.storeCoverWithItem = false
    this.preferAudioMetadata = false
    this.preferOpfMetadata = false
    this.preferMatchedMetadata = false
    this.preferOverdriveMediaMarker = false
  }

  toJSON() {
    return {
      forceRescan: this.forceRescan,
      parseSubtitles: this.parseSubtitles,
      findCovers: this.findCovers,
      storeCoverWithItem: this.storeCoverWithItem,
      preferAudioMetadata: this.preferAudioMetadata,
      preferOpfMetadata: this.preferOpfMetadata,
      preferMatchedMetadata: this.preferMatchedMetadata,
      preferOverdriveMediaMarker: this.preferOverdriveMediaMarker
    }
  }

  setData(options, serverSettings) {
    this.forceRescan = !!options.forceRescan

    this.parseSubtitles = !!serverSettings.scannerParseSubtitle
    this.findCovers = !!serverSettings.scannerFindCovers
    this.storeCoverWithItem = serverSettings.storeCoverWithItem
    this.preferAudioMetadata = serverSettings.scannerPreferAudioMetadata
    this.preferOpfMetadata = serverSettings.scannerPreferOpfMetadata
    this.scannerPreferMatchedMetadata = serverSettings.scannerPreferMatchedMetadata
    this.preferOverdriveMediaMarker = serverSettings.scannerPreferOverdriveMediaMarker
  }
}
module.exports = ScanOptions