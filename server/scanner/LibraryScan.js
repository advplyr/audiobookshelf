const Folder = require('../objects/Folder')

const { getId } = require('../utils/index')

class LibraryScan {
  constructor() {
    this.id = null
    this.libraryId = null
    this.libraryName = null
    this.folders = null

    this.scanOptions = null

    this.startedAt = null
    this.finishedAt = null

    this.folderScans = []
  }

  get _scanOptions() { return this.scanOptions || {} }
  get forceRescan() { return !!this._scanOptions.forceRescan }

  setData(library, scanOptions) {
    this.id = getId('lscan')
    this.libraryId = library.id
    this.libraryName = library.name
    this.folders = library.folders.map(folder => Folder(folder.toJSON()))

    this.scanOptions = scanOptions

    this.startedAt = Date.now()
  }
}
module.exports = LibraryScan