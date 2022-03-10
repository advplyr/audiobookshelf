const FileMetadata = require('../metadata/FileMetadata')

class EBookFile {
  constructor(file) {
    this.ino = null
    this.metadata = null
    this.ebookFormat = null
    this.addedAt = null
    this.updatedAt = null

    if (file) {
      this.construct(file)
    }
  }

  construct(file) {
    this.ino = file.ino
    this.metadata = new FileMetadata(file)
    this.ebookFormat = file.ebookFormat
    this.addedAt = file.addedAt
    this.updatedAt = file.updatedAt
  }

  toJSON() {
    return {
      ino: this.ino,
      metadata: this.metadata.toJSON(),
      ebookFormat: this.ebookFormat,
      addedAt: this.addedAt,
      updatedAt: this.updatedAt
    }
  }
}
module.exports = EBookFile