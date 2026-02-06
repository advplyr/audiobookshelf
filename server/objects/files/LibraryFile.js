const Path = require('path')
const fileUtils = require('../../utils/fileUtils')
const globals = require('../../utils/globals')
const FileMetadata = require('../metadata/FileMetadata')

class LibraryFile {
  /**
   * @param {{ ino: any; deviceId: any; metadata?: { filename: any; ext: any; path: any; relPath: any; size: any; mtimeMs: any; ctimeMs: any; birthtimeMs: any; } | { filename: string; ext: string; path: string; relPath: string; size: number; mtimeMs: number; ctimeMs: number; birthtimeMs: number; } | null; isSupplementary?: any; addedAt?: any; updatedAt?: any; fileType?: string; libraryFolderId?: any; libraryId?: any; mediaType?: any; mtimeMs?: any; ctimeMs?: any; birthtimeMs?: any; path?: any; relPath?: any; isFile?: any; mediaMetadata?: any; libraryFiles?: any; } | undefined} [file]
   */
  constructor(file) {
    this.ino = null
    this.deviceId = null
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
    this.deviceId = file.deviceId
    this.metadata = new FileMetadata(file.metadata)
    this.isSupplementary = file.isSupplementary === undefined ? null : file.isSupplementary
    this.addedAt = file.addedAt
    this.updatedAt = file.updatedAt
  }

  toJSON() {
    return {
      ino: this.ino,
      deviceId: this.deviceId,
      metadata: this.metadata ? this.metadata.toJSON() : null,
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
    if (this.metadata) {
      if (globals.SupportedImageTypes.includes(this.metadata.format)) return 'image'
      if (globals.SupportedAudioTypes.includes(this.metadata.format)) return 'audio'
      if (globals.SupportedEbookTypes.includes(this.metadata.format)) return 'ebook'
      if (globals.TextFileTypes.includes(this.metadata.format)) return 'text'
      if (globals.MetadataFileTypes.includes(this.metadata.format)) return 'metadata'
    }
    return 'unknown'
  }

  get isMediaFile() {
    return this.fileType === 'audio' || this.fileType === 'ebook'
  }

  get isEBookFile() {
    return this.fileType === 'ebook'
  }

  get isOPFFile() {
    return this.metadata.ext === '.opf'
  }

  async setDataFromPath(path, relPath) {
    var fileTsData = await fileUtils.getFileTimestampsWithIno(path)
    var fileMetadata = new FileMetadata()
    fileMetadata.setData(fileTsData)
    fileMetadata.filename = Path.basename(relPath)
    fileMetadata.path = fileUtils.filePathToPOSIX(path)
    fileMetadata.relPath = fileUtils.filePathToPOSIX(relPath)
    fileMetadata.ext = Path.extname(relPath)
    this.ino = fileTsData.ino
    this.deviceId = fileTsData.dev
    this.metadata = fileMetadata
    this.addedAt = Date.now()
    this.updatedAt = Date.now()
  }
}
module.exports = LibraryFile
