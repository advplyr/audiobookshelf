const Path = require('path')
const { getFileTimestampsWithIno, filePathToPOSIX } = require('../../utils/fileUtils')
const globals = require('../../utils/globals')
const FileMetadata = require('../metadata/FileMetadata')

/**
 * @openapi
 * components:
 *   schemas:
 *     libraryFile:
 *       type: object
 *       properties:
 *         ino:
 *           description: The inode of the library file.
 *           type: string
 *           example: '649644248522215260'
 *         metadata:
 *           $ref: '#/components/schemas/fileMetadata'
 *         addedAt:
 *           description: The time (in ms since POSIX epoch) when the library file was added.
 *           type: integer
 *           example: 1650621052494
 *         updatedAt:
 *           description: The time (in ms since POSIX epoch) when the library file was last updated.
 *           type: integer
 *           example: 1650621052494
 *         fileType:
 *           description: The type of file that the library file is (audio, image, etc.).
 *           type: string
 *           example: audio
 */
class LibraryFile {
  constructor(file) {
    this.ino = null
    this.metadata = null
    this.isSupplementary = null
    this.addedAt = null
    this.updatedAt = null

    if (file) {
      this.construct(file)
    }
  }

  construct(file) {
    this.ino = file.ino
    this.metadata = new FileMetadata(file.metadata)
    this.isSupplementary = file.isSupplementary === undefined ? null : file.isSupplementary
    this.addedAt = file.addedAt
    this.updatedAt = file.updatedAt
  }

  toJSON() {
    return {
      ino: this.ino,
      metadata: this.metadata.toJSON(),
      isSupplementary: this.isSupplementary,
      addedAt: this.addedAt,
      updatedAt: this.updatedAt,
      fileType: this.fileType
    }
  }

  clone() {
    return new LibraryFile(this.toJSON())
  }

  get fileType() {
    if (globals.SupportedImageTypes.includes(this.metadata.format)) return 'image'
    if (globals.SupportedAudioTypes.includes(this.metadata.format)) return 'audio'
    if (globals.SupportedEbookTypes.includes(this.metadata.format)) return 'ebook'
    if (globals.SupportedVideoTypes.includes(this.metadata.format)) return 'video'
    if (globals.TextFileTypes.includes(this.metadata.format)) return 'text'
    if (globals.MetadataFileTypes.includes(this.metadata.format)) return 'metadata'
    return 'unknown'
  }

  get isMediaFile() {
    return this.fileType === 'audio' || this.fileType === 'ebook' || this.fileType === 'video'
  }

  get isEBookFile() {
    return this.fileType === 'ebook'
  }

  get isOPFFile() {
    return this.metadata.ext === '.opf'
  }

  async setDataFromPath(path, relPath) {
    var fileTsData = await getFileTimestampsWithIno(path)
    var fileMetadata = new FileMetadata()
    fileMetadata.setData(fileTsData)
    fileMetadata.filename = Path.basename(relPath)
    fileMetadata.path = filePathToPOSIX(path)
    fileMetadata.relPath = filePathToPOSIX(relPath)
    fileMetadata.ext = Path.extname(relPath)
    this.ino = fileTsData.ino
    this.metadata = fileMetadata
    this.addedAt = Date.now()
    this.updatedAt = Date.now()
  }
}
module.exports = LibraryFile