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

    // Temp flag used in scans
    this.wasModified = false
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

  get format() {
    if (!this.ext) return ''
    return this.ext.slice(1).toLowerCase()
  }
  get filenameNoExt() {
    return this.filename.replace(this.ext, '')
  }

  update(payload) {
    var hasUpdates = false
    for (const key in payload) {
      if (this[key] !== undefined && this[key] !== payload[key]) {
        this[key] = payload[key]
        hasUpdates = true
      }
    }
    return hasUpdates
  }

  setData(payload) {
    for (const key in payload) {
      if (this[key] !== undefined) {
        this[key] = payload[key]
      }
    }
  }
}
module.exports = FileMetadata