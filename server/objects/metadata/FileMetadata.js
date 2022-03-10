class FileMetadata {
  constructor(metadata) {
    this.filename = null
    this.ext = null
    this.path = null
    this.relPath = null
    this.size = null
    this.mtimeMs = null
    this.ctimeMs = null
    this.birthtimeMs = null

    if (metadata) {
      this.construct(metadata)
    }
  }

  construct(metadata) {
    this.filename = metadata.filename
    this.ext = metadata.ext
    this.path = metadata.path
    this.relPath = metadata.relPath
    this.size = metadata.size
    this.mtimeMs = metadata.mtimeMs
    this.ctimeMs = metadata.ctimeMs
    this.birthtimeMs = metadata.birthtimeMs
  }

  toJSON() {
    return {
      filename: this.filename,
      ext: this.ext,
      path: this.path,
      relPath: this.relPath,
      size: this.size,
      mtimeMs: this.mtimeMs,
      ctimeMs: this.ctimeMs,
      birthtimeMs: this.birthtimeMs
    }
  }

  clone() {
    return new FileMetadata(this.toJSON())
  }
}
module.exports = FileMetadata