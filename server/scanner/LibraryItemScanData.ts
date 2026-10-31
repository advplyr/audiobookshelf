import { version } from '../../package.json'
import { LogLevel } from '../utils/constants'
import type LibraryItem from '../models/LibraryItem'
import type Book from '../models/Book'
import globals from '../utils/globals'
import type LibraryFile from '../objects/files/LibraryFile'
import type FileMetadata from '../objects/metadata/FileMetadata'
import type LibraryScan from './LibraryScan'
import type { BookFilenameMetadata, LibraryItemFilenameMetadata } from '../types/scandir'

/** A library file saved on the library item */
type StoredLibraryFile = NonNullable<LibraryItem['libraryFiles']>[number]

/** A library file found by the scanner. Its metadata is always filled in from the file path */
type ScannedFileMetadata = FileMetadata & { filename: string; ext: string; path: string; relPath: string; size: number }
type ScannedLibraryFile = LibraryFile & { metadata: ScannedFileMetadata }

interface LibraryFileModifiedObject {
  old: StoredLibraryFile
  new: StoredLibraryFile
}

interface LibraryItemScanDataInput {
  libraryFolderId: string
  libraryId: string
  mediaType: string
  ino: string
  mtimeMs: number
  ctimeMs: number
  birthtimeMs: number
  path: string
  relPath: string
  isFile: boolean
  mediaMetadata: LibraryItemFilenameMetadata
  libraryFiles: ScannedLibraryFile[]
}

class LibraryItemScanData {
  libraryFolderId: string
  libraryId: string
  mediaType: string
  ino: string
  mtimeMs: number
  ctimeMs: number
  birthtimeMs: number
  path: string
  relPath: string
  isFile: boolean
  mediaMetadata: LibraryItemFilenameMetadata
  libraryFiles: ScannedLibraryFile[]

  // Set after check
  declare hasChanges?: boolean
  declare hasPathChange?: boolean
  libraryFilesRemoved: StoredLibraryFile[] = []
  libraryFilesAdded: ScannedLibraryFile[] = []
  libraryFilesModified: LibraryFileModifiedObject[] = []

  constructor(data: LibraryItemScanDataInput) {
    this.libraryFolderId = data.libraryFolderId
    this.libraryId = data.libraryId
    this.mediaType = data.mediaType
    this.ino = data.ino
    this.mtimeMs = data.mtimeMs
    this.ctimeMs = data.ctimeMs
    this.birthtimeMs = data.birthtimeMs
    this.path = data.path
    this.relPath = data.relPath
    this.isFile = data.isFile
    this.mediaMetadata = data.mediaMetadata
    this.libraryFiles = data.libraryFiles
  }

  /**
   * Used to create a library item
   */
  get libraryItemObject() {
    let size = 0
    this.libraryFiles.forEach((lf) => {
      const fileSize = Number(lf.metadata.size)
      size += !isNaN(fileSize) ? fileSize : 0
    })
    return {
      ino: this.ino,
      path: this.path,
      relPath: this.relPath,
      mediaType: this.mediaType,
      isFile: this.isFile,
      mtime: this.mtimeMs,
      ctime: this.ctimeMs,
      birthtime: this.birthtimeMs,
      lastScan: Date.now(),
      lastScanVersion: version,
      libraryFiles: this.libraryFiles,
      libraryId: this.libraryId,
      libraryFolderId: this.libraryFolderId,
      size
    }
  }

  get hasLibraryFileChanges(): number {
    return this.libraryFilesRemoved.length + this.libraryFilesModified.length + this.libraryFilesAdded.length
  }

  get hasAudioFileChanges(): boolean {
    return this.audioLibraryFilesRemoved.length + this.audioLibraryFilesAdded.length + this.audioLibraryFilesModified.length > 0
  }

  get audioLibraryFilesModified() {
    return this.libraryFilesModified.filter((lf) => globals.SupportedAudioTypes.includes(lf.old.metadata.ext?.slice(1).toLowerCase() || ''))
  }

  get audioLibraryFilesRemoved() {
    return this.libraryFilesRemoved.filter((lf) => globals.SupportedAudioTypes.includes(lf.metadata.ext?.slice(1).toLowerCase() || ''))
  }

  get audioLibraryFilesAdded() {
    return this.libraryFilesAdded.filter((lf) => globals.SupportedAudioTypes.includes(lf.metadata.ext?.slice(1).toLowerCase() || ''))
  }

  get audioLibraryFiles() {
    return this.libraryFiles.filter((lf) => globals.SupportedAudioTypes.includes(lf.metadata.ext?.slice(1).toLowerCase() || ''))
  }

  get imageLibraryFilesModified() {
    return this.libraryFilesModified.filter((lf) => globals.SupportedImageTypes.includes(lf.old.metadata.ext?.slice(1).toLowerCase() || ''))
  }

  get imageLibraryFilesRemoved() {
    return this.libraryFilesRemoved.filter((lf) => globals.SupportedImageTypes.includes(lf.metadata.ext?.slice(1).toLowerCase() || ''))
  }

  get imageLibraryFilesAdded() {
    return this.libraryFilesAdded.filter((lf) => globals.SupportedImageTypes.includes(lf.metadata.ext?.slice(1).toLowerCase() || ''))
  }

  get imageLibraryFiles() {
    return this.libraryFiles.filter((lf) => globals.SupportedImageTypes.includes(lf.metadata.ext?.slice(1).toLowerCase() || ''))
  }

  get ebookLibraryFilesModified() {
    return this.libraryFilesModified.filter((lf) => globals.SupportedEbookTypes.includes(lf.old.metadata.ext?.slice(1).toLowerCase() || ''))
  }

  get ebookLibraryFilesRemoved() {
    return this.libraryFilesRemoved.filter((lf) => globals.SupportedEbookTypes.includes(lf.metadata.ext?.slice(1).toLowerCase() || ''))
  }

  get ebookLibraryFilesAdded() {
    return this.libraryFilesAdded.filter((lf) => globals.SupportedEbookTypes.includes(lf.metadata.ext?.slice(1).toLowerCase() || ''))
  }

  get ebookLibraryFiles() {
    return this.libraryFiles.filter((lf) => globals.SupportedEbookTypes.includes(lf.metadata.ext?.slice(1).toLowerCase() || ''))
  }

  get descTxtLibraryFile() {
    return this.libraryFiles.find((lf) => lf.metadata.filename === 'desc.txt')
  }

  get readerTxtLibraryFile() {
    return this.libraryFiles.find((lf) => lf.metadata.filename === 'reader.txt')
  }

  get metadataAbsLibraryFile() {
    return this.libraryFiles.find((lf) => lf.metadata.filename === 'metadata.abs')
  }

  get metadataJsonLibraryFile() {
    return this.libraryFiles.find((lf) => lf.metadata.filename === 'metadata.json')
  }

  get metadataOpfLibraryFile() {
    return this.libraryFiles.find((lf) => lf.metadata.ext.toLowerCase() === '.opf')
  }

  get metadataNfoLibraryFile() {
    return this.libraryFiles.find((lf) => lf.metadata.ext.toLowerCase() === '.nfo')
  }

  /**
   * @returns true if changes found
   */
  async checkLibraryItemData(existingLibraryItem: LibraryItem, libraryScan: LibraryScan): Promise<boolean> {
    const keysToCompare = ['libraryFolderId', 'ino', 'path', 'relPath', 'isFile'] as const
    this.hasChanges = false
    this.hasPathChange = false
    for (const key of keysToCompare) {
      if (existingLibraryItem[key] !== this[key]) {
        libraryScan.addLog(LogLevel.DEBUG, `Library item "${existingLibraryItem.relPath}" key "${key}" changed from "${existingLibraryItem[key]}" to "${this[key]}"`)
        Object.assign(existingLibraryItem, { [key]: this[key] })
        this.hasChanges = true

        if (key === 'relPath' || key === 'path') {
          this.hasPathChange = true
        }
      }
    }

    // Check mtime, ctime and birthtime
    if (existingLibraryItem.mtime?.valueOf() !== this.mtimeMs) {
      libraryScan.addLog(LogLevel.DEBUG, `Library item "${existingLibraryItem.relPath}" key "mtime" changed from "${existingLibraryItem.mtime?.valueOf()}" to "${this.mtimeMs}"`)
      existingLibraryItem.mtime = this.mtimeMs
      this.hasChanges = true
    }
    if (existingLibraryItem.birthtime?.valueOf() !== this.birthtimeMs) {
      libraryScan.addLog(LogLevel.DEBUG, `Library item "${existingLibraryItem.relPath}" key "birthtime" changed from "${existingLibraryItem.birthtime?.valueOf()}" to "${this.birthtimeMs}"`)
      existingLibraryItem.birthtime = this.birthtimeMs
      this.hasChanges = true
    }
    if (existingLibraryItem.ctime?.valueOf() !== this.ctimeMs) {
      libraryScan.addLog(LogLevel.DEBUG, `Library item "${existingLibraryItem.relPath}" key "ctime" changed from "${existingLibraryItem.ctime?.valueOf()}" to "${this.ctimeMs}"`)
      existingLibraryItem.ctime = this.ctimeMs
      this.hasChanges = true
    }
    if (existingLibraryItem.isMissing) {
      libraryScan.addLog(LogLevel.DEBUG, `Library item "${existingLibraryItem.relPath}" was missing but now found`)
      existingLibraryItem.isMissing = false
      this.hasChanges = true
    }

    this.libraryFilesRemoved = []
    this.libraryFilesModified = []
    let libraryFilesAdded = this.libraryFiles.map((lf) => lf)

    for (const existingLibraryFile of existingLibraryItem.libraryFiles!) {
      // Find matching library file using path first and fallback to using inode value
      let matchingLibraryFile = this.libraryFiles.find((lf) => lf.metadata.path === existingLibraryFile.metadata.path)
      if (!matchingLibraryFile) {
        matchingLibraryFile = this.libraryFiles.find((lf) => lf.ino === existingLibraryFile.ino)
        if (matchingLibraryFile) {
          libraryScan.addLog(LogLevel.INFO, `Library file with path "${existingLibraryFile.metadata.path}" not found, but found file with matching inode value "${existingLibraryFile.ino}" at path "${matchingLibraryFile.metadata.path}"`)
        }
      }

      if (!matchingLibraryFile) {
        // Library file removed
        libraryScan.addLog(LogLevel.INFO, `Library file "${existingLibraryFile.metadata.path}" was removed from library item "${existingLibraryItem.relPath}"`)
        this.libraryFilesRemoved.push(existingLibraryFile)
        existingLibraryItem.libraryFiles = existingLibraryItem.libraryFiles!.filter((lf) => lf !== existingLibraryFile)
        this.hasChanges = true
      } else {
        libraryFilesAdded = libraryFilesAdded.filter((lf) => lf !== matchingLibraryFile)
        const existingLibraryFileBefore = structuredClone(existingLibraryFile)
        if (this.compareUpdateLibraryFile(existingLibraryItem.path, existingLibraryFile, matchingLibraryFile, libraryScan)) {
          this.libraryFilesModified.push({ old: existingLibraryFileBefore, new: existingLibraryFile })
          this.hasChanges = true
        }
      }
    }

    // Log new library files found
    if (libraryFilesAdded.length) {
      this.hasChanges = true
      for (const libraryFile of libraryFilesAdded) {
        libraryScan.addLog(LogLevel.INFO, `New library file found with path "${libraryFile.metadata.path}" for library item "${existingLibraryItem.relPath}"`)
        if (libraryFile.isEBookFile) {
          // Set all new ebook files as supplementary
          libraryFile.isSupplementary = true
        }
        existingLibraryItem.libraryFiles!.push(libraryFile.toJSON())
      }
    }

    this.libraryFilesAdded = libraryFilesAdded

    if (this.hasChanges) {
      existingLibraryItem.size = 0
      existingLibraryItem.libraryFiles!.forEach((lf) => (existingLibraryItem.size! += lf.metadata.size as number))

      existingLibraryItem.lastScan = Date.now()
      existingLibraryItem.lastScanVersion = version

      const changedKeys = existingLibraryItem.changed()
      libraryScan.addLog(LogLevel.DEBUG, `Library item "${existingLibraryItem.relPath}" changed: [${(changedKeys && changedKeys.join(',')) || ''}]`)

      if (this.hasLibraryFileChanges) {
        existingLibraryItem.changed('libraryFiles', true)
      }
      await existingLibraryItem.save()
      return true
    }

    return false
  }

  /**
   * Update existing library file with scanned in library file data
   *
   * @returns false if no changes
   */
  compareUpdateLibraryFile(libraryItemPath: string | null, existingLibraryFile: StoredLibraryFile, scannedLibraryFile: ScannedLibraryFile, libraryScan: LibraryScan): boolean {
    let hasChanges = false

    if (existingLibraryFile.ino !== scannedLibraryFile.ino) {
      existingLibraryFile.ino = scannedLibraryFile.ino
      hasChanges = true
    }

    for (const key in existingLibraryFile.metadata) {
      const field = key as keyof StoredLibraryFile['metadata']
      const oldValue = existingLibraryFile.metadata[field]
      const newValue = scannedLibraryFile.metadata[field]
      if (oldValue !== newValue) {
        if (key !== 'path' && key !== 'relPath') {
          libraryScan.addLog(LogLevel.DEBUG, `Library file "${existingLibraryFile.metadata.relPath}" for library item "${libraryItemPath}" key "${key}" changed from "${String(oldValue)}" to "${String(newValue)}"`)
        } else {
          libraryScan.addLog(LogLevel.DEBUG, `Library file for library item "${libraryItemPath}" key "${key}" changed from "${String(oldValue)}" to "${String(newValue)}"`)
        }
        Object.assign(existingLibraryFile.metadata, { [field]: newValue })
        hasChanges = true
      }
    }

    if (hasChanges) {
      existingLibraryFile.updatedAt = Date.now()
    }

    return hasChanges
  }

  /**
   * Check if existing audio file on Book was removed
   *
   * @returns true if audio file was removed
   */
  checkAudioFileRemoved(existingAudioFile: Book.AudioFileObject): boolean {
    if (!this.audioLibraryFilesRemoved.length) return false
    // First check exact path
    if (this.audioLibraryFilesRemoved.some((af) => af.metadata.path === existingAudioFile.metadata.path)) {
      return true
    }
    // Fallback to check inode value
    return this.audioLibraryFilesRemoved.some((af) => af.ino === existingAudioFile.ino)
  }

  /**
   * Check if existing ebook file on Book was removed
   *
   * @returns true if ebook file was removed
   */
  checkEbookFileRemoved(ebookFile: Book.EBookFileObject): boolean {
    if (!this.ebookLibraryFiles.length) return true

    if (this.ebookLibraryFiles.some((lf) => lf.metadata.path === ebookFile.metadata.path)) {
      return false
    }

    return !this.ebookLibraryFiles.some((lf) => lf.ino === ebookFile.ino)
  }

  /**
   * Set data parsed from filenames
   */
  setBookMetadataFromFilenames(bookMetadata: Record<string, unknown>) {
    const mediaMetadata: Partial<BookFilenameMetadata> = this.mediaMetadata
    const keysToMap = ['title', 'subtitle', 'publishedYear', 'asin']
    for (const key in mediaMetadata) {
      const field = key as keyof BookFilenameMetadata
      if (keysToMap.includes(key) && mediaMetadata[field]) {
        bookMetadata[key] = mediaMetadata[field]
      }
    }

    if (mediaMetadata.authors?.length) {
      bookMetadata.authors = mediaMetadata.authors
    }
    if (mediaMetadata.narrators?.length) {
      bookMetadata.narrators = mediaMetadata.narrators
    }
    if (mediaMetadata.seriesName) {
      bookMetadata.series = [
        {
          name: mediaMetadata.seriesName,
          sequence: mediaMetadata.seriesSequence || null
        }
      ]
    }
  }
}

export = LibraryItemScanData
