const FileMetadata = require('../metadata/FileMetadata')

class LibraryFile {
  constructor(file) {
    this.ino = null
    this.metadata = null
    this.addedAt = null
    this.updatedAt = null

    if (file) {
      this.construct(file)
    }
  }

  construct(file) {
    this.ino = file.ino
    this.metadata = new FileMetadata(file.metadata)
    this.addedAt = file.addedAt
    this.updatedAt = file.updatedAt
  }

  toJSON() {
    return {
      ino: this.ino,
      metadata: this.metadata.toJSON(),
      addedAt: this.addedAt,
      updatedAt: this.updatedAt
    }
  }
}
module.exports = LibraryFile