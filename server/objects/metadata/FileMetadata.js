/**
 * @openapi
 * components:
 *   schemas:
 *     fileMetadata:
 *       type: [object, 'null']
 *       properties:
 *         filename:
 *           description: The filename of the file.
 *           type: string
 *           example: Wizards First Rule 01.mp3
 *         ext:
 *           description: The file extension of the file.
 *           type: string
 *           example: .mp3
 *         path:
 *           description: The absolute path on the server of the file.
 *           type: string
 *           example: >-
 *               /audiobooks/Terry Goodkind/Sword of Truth/Wizards First Rule/Terry
 *               Goodkind - SOT Bk01 - Wizards First Rule 01.mp3
 *         relPath:
 *           description: The path of the file, relative to the book's or podcast's folder.
 *           type: string
 *           example: Wizards First Rule 01.mp3
 *         size:
 *           description: The size (in bytes) of the file.
 *           type: integer
 *           example: 48037888
 *         mtimeMs:
 *           description: The time (in ms since POSIX epoch) when the file was last modified on disk.
 *           type: integer
 *           example: 1632223180278
 *         ctimeMs:
 *           description: The time (in ms since POSIX epoch) when the file status was changed on disk.
 *           type: integer
 *           example: 1645978261001
 *         birthtimeMs:
 *           description: The time (in ms since POSIX epoch) when the file was created on disk. Will be 0 if unknown.
 *           type: integer
 *           example: 0
 */
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