const uuidv4 = require("uuid").v4

class Folder {
  constructor(folder = null) {
    this.id = null
    this.fullPath = null
    this.libraryId = null
    this.addedAt = null

    if (folder) {
      this.construct(folder)
    }
  }

  construct(folder) {
    this.id = folder.id
    this.fullPath = folder.fullPath
    this.libraryId = folder.libraryId
    this.addedAt = folder.addedAt
  }

  toJSON() {
    return {
      id: this.id,
      fullPath: this.fullPath,
      libraryId: this.libraryId,
      addedAt: this.addedAt
    }
  }

  setData(data) {
    this.id = data.id || uuidv4()
    this.fullPath = data.fullPath
    this.libraryId = data.libraryId
    this.addedAt = Date.now()
  }
}
module.exports = Folder