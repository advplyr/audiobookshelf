import Path from 'path'
import FileMetadata from '../metadata/FileMetadata'
import globals from '../../utils/globals'
import { getFileTimestampsWithIno, filePathToPOSIX } from '../../utils/fileUtils'

type FileMetadataJSON = ReturnType<FileMetadata['toJSON']>

type LibraryFileType = 'image' | 'audio' | 'ebook' | 'text' | 'metadata' | 'unknown'

interface LibraryFileData {
  ino: string | null | undefined
  metadata: FileMetadataJSON
  isSupplementary: boolean | null
  addedAt: number | null | undefined
  updatedAt: number | null | undefined
  fileType: LibraryFileType
}

type LibraryFileInput = Partial<Omit<LibraryFileData, 'metadata'>> & { metadata?: Partial<FileMetadataJSON> }

class LibraryFile {
  ino: string | null | undefined = null
  metadata: FileMetadata | null = null
  isSupplementary: boolean | null = null
  addedAt: number | null | undefined = null
  updatedAt: number | null | undefined = null

  constructor(file?: LibraryFileInput | null) {
    if (file) {
      this.construct(file)
    }
  }

  construct(file: LibraryFileInput) {
    this.ino = file.ino
    this.metadata = new FileMetadata(file.metadata)
    this.isSupplementary = file.isSupplementary === undefined ? null : file.isSupplementary
    this.addedAt = file.addedAt
    this.updatedAt = file.updatedAt
  }

  // Requires initialized metadata, as in the original JavaScript implementation.
  toJSON(): LibraryFileData {
    return {
      ino: this.ino,
      metadata: this.metadata!.toJSON(),
      isSupplementary: this.isSupplementary,
      addedAt: this.addedAt,
      updatedAt: this.updatedAt,
      fileType: this.fileType
    }
  }

  clone(): LibraryFile {
    return new LibraryFile(this.toJSON())
  }

  get fileType(): LibraryFileType {
    const format = this.metadata!.format
    if (globals.SupportedImageTypes.includes(format)) return 'image'
    if (globals.SupportedAudioTypes.includes(format)) return 'audio'
    if (globals.SupportedEbookTypes.includes(format)) return 'ebook'
    if (globals.TextFileTypes.includes(format)) return 'text'
    if (globals.MetadataFileTypes.includes(format)) return 'metadata'
    return 'unknown'
  }

  get isMediaFile(): boolean {
    return this.fileType === 'audio' || this.fileType === 'ebook'
  }

  get isEBookFile(): boolean {
    return this.fileType === 'ebook'
  }

  get isOPFFile(): boolean {
    return this.metadata!.ext === '.opf'
  }

  async setDataFromPath(path: string, relPath: string) {
    const fileTsData = await getFileTimestampsWithIno(path)
    const fileMetadata = new FileMetadata()
    // getFileTimestampsWithIno returns false when the file cannot be read
    if (fileTsData) fileMetadata.setData(fileTsData)
    fileMetadata.filename = Path.basename(relPath)
    fileMetadata.path = filePathToPOSIX(path)
    fileMetadata.relPath = filePathToPOSIX(relPath)
    fileMetadata.ext = Path.extname(relPath)
    this.ino = fileTsData ? fileTsData.ino : undefined
    this.metadata = fileMetadata
    this.addedAt = Date.now()
    this.updatedAt = Date.now()
  }
}

export = LibraryFile
