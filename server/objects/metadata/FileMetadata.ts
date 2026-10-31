interface FileMetadataData {
  [key: string]: unknown
  filename: string | null | undefined
  ext: string | null | undefined
  path: string | null | undefined
  relPath: string | null | undefined
  size: number | null | undefined
  mtimeMs: number | null | undefined
  ctimeMs: number | null | undefined
  birthtimeMs: number | null | undefined
}

class FileMetadata implements FileMetadataData {
  [key: string]: unknown
  filename: string | null | undefined = null
  ext: string | null | undefined = null
  path: string | null | undefined = null
  relPath: string | null | undefined = null
  size: number | null | undefined = null
  mtimeMs: number | null | undefined = null
  ctimeMs: number | null | undefined = null
  birthtimeMs: number | null | undefined = null

  /** Temp flag used in scans */
  wasModified: boolean

  constructor(metadata?: Partial<FileMetadataData> | null) {
    if (metadata) {
      this.construct(metadata)
    }

    this.wasModified = false
  }

  construct(metadata: Partial<FileMetadataData>) {
    this.filename = metadata.filename
    this.ext = metadata.ext
    this.path = metadata.path
    this.relPath = metadata.relPath
    this.size = metadata.size
    this.mtimeMs = metadata.mtimeMs
    this.ctimeMs = metadata.ctimeMs
    this.birthtimeMs = metadata.birthtimeMs
  }

  toJSON(): FileMetadataData {
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

  clone(): FileMetadata {
    return new FileMetadata(this.toJSON())
  }

  get format(): string {
    if (!this.ext) return ''
    return this.ext.slice(1).toLowerCase()
  }

  get filenameNoExt(): string {
    // Like the original getter, this requires a filename and throws when it is absent.
    return this.filename!.replace(String(this.ext), '')
  }

  /**
   * Copy over keys that already exist on this object
   *
   * @returns true if any value changed
   */
  update(payload: Partial<FileMetadataData>): boolean {
    let hasUpdates = false
    for (const key in payload) {
      if (this[key] !== undefined && this[key] !== payload[key]) {
        this[key] = payload[key]
        hasUpdates = true
      }
    }
    return hasUpdates
  }

  setData(payload: Partial<FileMetadataData> | false) {
    // Failed file stats produced no enumerable fields in the original loop.
    if (payload === false) return
    for (const key in payload) {
      if (this[key] !== undefined) {
        this[key] = payload[key]
      }
    }
  }
}

export = FileMetadata
