const Folder = require('../objects/Folder')
const Constants = require('../utils/constants')

const { getId, secondsToTimestamp } = require('../utils/index')

class LibraryScan {
  constructor() {
    this.id = null
    this.libraryId = null
    this.libraryName = null
    this.folders = null

    this.scanOptions = null

    this.startedAt = null
    this.finishedAt = null
    this.elapsed = null

    this.status = Constants.ScanStatus.NOTHING
    this.resultsMissing = 0
    this.resultsAdded = 0
    this.resultsUpdated = 0
  }

  get _scanOptions() { return this.scanOptions || {} }
  get forceRescan() { return !!this._scanOptions.forceRescan }

  get resultStats() {
    return `${this.resultsAdded} Added | ${this.resultsUpdated} Updated | ${this.resultsMissing} Missing`
  }
  get elapsedTimestamp() {
    return secondsToTimestamp(this.elapsed / 1000)
  }
  get getScanEmitData() {
    return {
      id: this.libraryId,
      name: this.libraryName,
      results: {
        added: this.resultsAdded,
        updated: this.resultsUpdated,
        missing: this.resultsMissing
      }
    }
  }

  setData(library, scanOptions) {
    this.id = getId('lscan')
    this.libraryId = library.id
    this.libraryName = library.name
    this.folders = library.folders.map(folder => new Folder(folder.toJSON()))

    this.scanOptions = scanOptions

    this.startedAt = Date.now()
  }

  setComplete() {
    this.finishedAt = Date.now()
    this.elapsed = this.finishedAt - this.startedAt
  }
}
module.exports = LibraryScan