const FileMetadata = require('../metadata/FileMetadata')

/**
 * @openapi
 * components:
 *   schemas:
 *     ebookFile:
 *       type: [object, 'null']
 *       properties:
 *         ino:
 *           description: The inode of the ebook file.
 *           type: string
 *           example: '9463162'
 *         metadata:
 *           $ref: '#/components/schemas/fileMetadata'
 *         ebookFormat:
 *           description: The ebook format of the ebook file.
 *           type: string
 *           example: epub
 *         addedAt:
 *           $ref: '#/components/schemas/addedAt'
 *         updatedAt:
 *           $ref: '#/components/schemas/updatedAt'
 */

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
    this.metadata = new FileMetadata(file.metadata)
    this.ebookFormat = file.ebookFormat || this.metadata.format
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

  get isEpub() {
    return this.ebookFormat === 'epub'
  }

  setData(libraryFile) {
    this.ino = libraryFile.ino
    this.metadata = libraryFile.metadata.clone()
    this.ebookFormat = libraryFile.metadata.format
    this.addedAt = Date.now()
    this.updatedAt = Date.now()
  }

  updateFromLibraryFile(libraryFile) {
    var hasUpdated = false

    if (this.metadata.update(libraryFile.metadata)) {
      hasUpdated = true
    }

    if (this.ebookFormat !== libraryFile.metadata.format) {
      this.ebookFormat = libraryFile.metadata.format
      hasUpdated = true
    }

    return hasUpdated
  }
}
module.exports = EBookFile