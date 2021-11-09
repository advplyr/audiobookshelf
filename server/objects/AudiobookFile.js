class AudiobookFile {
  constructor(data) {
    this.ino = null
    this.filetype = null
    this.filename = null
    this.ext = null
    this.path = null
    this.fullPath = null
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
    this.addedAt = data.addedAt
  }

  setData(data) {
    this.ino = data.ino || null
    this.filetype = data.filetype
    this.filename = data.filename
    this.ext = data.ext
    this.path = data.path
    this.fullPath = data.fullPath
    this.addedAt = Date.now()
  }
}
module.exports = AudiobookFile