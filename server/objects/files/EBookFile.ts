import FileMetadata from '../metadata/FileMetadata'

type FileMetadataJSON = ReturnType<FileMetadata['toJSON']>

interface EBookFileData {
  ino: string | null | undefined
  metadata: FileMetadataJSON
  ebookFormat: string | null
  addedAt: number | null | undefined
  updatedAt: number | null | undefined
}

/** A library file with a metadata that can be read by the ebook reader */
interface EBookSourceFile {
  ino: string | null | undefined
  metadata: FileMetadata
}

class EBookFile {
  ino: string | null | undefined = null
  metadata: FileMetadata | null = null
  ebookFormat: string | null = null
  addedAt: number | null | undefined = null
  updatedAt: number | null | undefined = null

  constructor(file?: Partial<EBookFileData> | null) {
    if (file) {
      this.construct(file)
    }
  }

  construct(file: Partial<EBookFileData>) {
    this.ino = file.ino
    this.metadata = new FileMetadata(file.metadata)
    this.ebookFormat = file.ebookFormat || this.metadata.format
    this.addedAt = file.addedAt
    this.updatedAt = file.updatedAt
  }

  // Requires initialized metadata, as in the original JavaScript implementation.
  toJSON(): EBookFileData {
    return {
      ino: this.ino,
      metadata: this.metadata!.toJSON(),
      ebookFormat: this.ebookFormat,
      addedAt: this.addedAt,
      updatedAt: this.updatedAt
    }
  }

  get isEpub(): boolean {
    return this.ebookFormat === 'epub'
  }

  setData(libraryFile: EBookSourceFile) {
    this.ino = libraryFile.ino
    this.metadata = libraryFile.metadata.clone()
    this.ebookFormat = libraryFile.metadata.format
    this.addedAt = Date.now()
    this.updatedAt = Date.now()
  }

  /** @returns true if updates were made */
  updateFromLibraryFile(libraryFile: Pick<EBookSourceFile, 'metadata'>): boolean {
    let hasUpdated = false

    if (this.metadata!.update(libraryFile.metadata)) {
      hasUpdated = true
    }

    if (this.ebookFormat !== libraryFile.metadata.format) {
      this.ebookFormat = libraryFile.metadata.format
      hasUpdated = true
    }

    return hasUpdated
  }
}

export = EBookFile
