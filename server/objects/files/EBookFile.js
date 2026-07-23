const FileMetadata = require('../metadata/FileMetadata')

class EBookFile {
  /**
   * @param {{ ino: any; deviceId: any; isSupplementary?: boolean; addedAt?: number; updatedAt?: number; metadata?: { filename: string; ext: string; path: string; relPath: string; size: number; mtimeMs: number; ctimeMs: number; birthtimeMs: number; }; libraryFolderId?: any; libraryId?: any; mediaType?: any; mtimeMs?: any; ctimeMs?: any; birthtimeMs?: any; path?: any; relPath?: any; isFile?: any; mediaMetadata?: any; libraryFiles?: any; }} file
   */
  constructor(file) {
    this.ino = null
    this.deviceId = null
    this.metadata = null
    this.ebookFormat = null
    this.addedAt = null
    this.updatedAt = null

    if (file) {
      this.construct(file)
    }
  }

  /**
   * @param {{ ino: any; deviceId: any; isSupplementary?: boolean | undefined; addedAt: any; updatedAt: any; metadata: any; libraryFolderId?: any; libraryId?: any; mediaType?: any; mtimeMs?: any; ctimeMs?: any; birthtimeMs?: any; path?: any; relPath?: any; isFile?: any; mediaMetadata?: any; libraryFiles?: any; ebookFormat?: any; }} file
   */
  construct(file) {
    this.ino = file.ino
    this.deviceId = file.deviceId
    this.metadata = new FileMetadata(file.metadata)
    this.ebookFormat = file.ebookFormat || this.metadata.format
    this.addedAt = file.addedAt
    this.updatedAt = file.updatedAt
  }

  toJSON() {
    return {
      ino: this.ino,
      deviceId: this.deviceId,
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
    this.deviceId = libraryFile.deviceId
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
