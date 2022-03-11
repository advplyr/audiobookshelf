class AudiobookFile {
  constructor(data) {
    this.ino = null
    this.filetype = null
    this.filename = null
    this.ext = null
    this.path = null
    this.fullPath = null
    this.size = null
    this.mtimeMs = null
    this.ctimeMs = null
    this.birthtimeMs = null

    this.addedAt = null

    if (data) {
      this.construct(data)
    }
  }

  get isOPFFile() {
    return this.ext ? this.ext.toLowerCase() === '.opf' : false
  }

  toJSON() {
    return {
      ino: this.ino || null,
      filetype: this.filetype,
      filename: this.filename,
      ext: this.ext,
      path: this.path,
      fullPath: this.fullPath,
      size: this.size,
      mtimeMs: this.mtimeMs,
      ctimeMs: this.ctimeMs,
      birthtimeMs: this.birthtimeMs,
      addedAt: this.addedAt
    }
  }

  construct(data) {
    this.ino = data.ino || null
    this.filetype = data.filetype
    this.filename = data.filename
    this.ext = data.ext
    this.path = data.path
    this.fullPath = data.fullPath
    this.size = data.size || 0
    this.mtimeMs = data.mtimeMs || 0
    this.ctimeMs = data.ctimeMs || 0
    this.birthtimeMs = data.birthtimeMs || 0
    this.addedAt = data.addedAt
  }

  setData(data) {
    this.ino = data.ino || null
    this.filetype = data.filetype
    this.filename = data.filename
    this.ext = data.ext
    this.path = data.path
    this.fullPath = data.fullPath
    this.size = data.size || 0
    this.mtimeMs = data.mtimeMs || 0
    this.ctimeMs = data.ctimeMs || 0
    this.birthtimeMs = data.birthtimeMs || 0
    this.addedAt = Date.now()
  }
}
module.exports = AudiobookFile