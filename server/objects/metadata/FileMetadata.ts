interface FileMetadataData {
  filename: string | null
  ext: string | null
  path: string | null
  relPath: string | null
  size: number | null
  mtimeMs: number | null
  ctimeMs: number | null
  birthtimeMs: number | null
}

class FileMetadata implements FileMetadataData {
  filename: string | null = null
  ext: string | null = null
  path: string | null = null
  relPath: string | null = null
  size: number | null = null
  mtimeMs: number | null = null
  ctimeMs: number | null = null
  birthtimeMs: number | null = null

  /** Temp flag used in scans */
  wasModified: boolean

  constructor(metadata?: FileMetadataData | null) {
    if (metadata) {
      this.construct(metadata)
    }

    this.wasModified = false
  }

  construct(metadata: FileMetadataData) {
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
    return (this.filename as string).replace(this.ext as string, '')
  }

  /**
   * Copy over keys that already exist on this object
   *
   * @returns true if any value changed
   */
  update(payload: Partial<FileMetadataData>): boolean {
    let hasUpdates = false
    for (const key in payload) {
      const metadataKey = key as keyof FileMetadataData
      if (this[metadataKey] !== undefined && this[metadataKey] !== payload[metadataKey]) {
        assignField(this, metadataKey, payload[metadataKey] as FileMetadataData[typeof metadataKey])
        hasUpdates = true
      }
    }
    return hasUpdates
  }

  setData(payload: Partial<FileMetadataData>) {
    for (const key in payload) {
      const metadataKey = key as keyof FileMetadataData
      if (this[metadataKey] !== undefined) {
        assignField(this, metadataKey, payload[metadataKey] as FileMetadataData[typeof metadataKey])
      }
    }
  }
}

function assignField<K extends keyof FileMetadataData>(target: FileMetadataData, key: K, value: FileMetadataData[K]) {
  target[key] = value
}

export = FileMetadata
