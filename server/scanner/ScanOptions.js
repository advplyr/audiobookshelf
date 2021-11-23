const { CoverDestination } = require('../utils/constants')

class ScanOptions {
  constructor(options) {
    this.forceRescan = false

    this.metadataPrecedence = [
      {
        id: 'directory',
        include: true
      },
      {
        id: 'reader-desc-txt',
        include: true
      },
      {
        id: 'audio-file-metadata',
        include: true
      },
      {
        id: 'metadata-opf',
        include: true
      },
      {
        id: 'external-source',
        include: false
      }
    ]

    // Server settings
    this.parseSubtitles = false
    this.findCovers = false
    this.coverDestination = CoverDestination.METADATA

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
      coverDestination: this.coverDestination
    }
  }

  setData(options, serverSettings) {
    this.forceRescan = !!options.forceRescan

    this.parseSubtitles = !!serverSettings.scannerParseSubtitle
    this.findCovers = !!serverSettings.scannerFindCovers
    this.coverDestination = serverSettings.coverDestination
  }
}
module.exports = ScanOptions