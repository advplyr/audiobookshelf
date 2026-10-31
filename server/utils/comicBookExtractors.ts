import Path from 'path'
import os from 'os'
import * as unrar from 'node-unrar-js'
import Logger from '../Logger'
import * as fs from '../libs/fsExtra'
import StreamZip from '../libs/nodeStreamZip'
import ArchiveRuntime from '../libs/libarchive/archive'
import { isWritable } from './fileUtils'
import { sanitizePath } from '../libs/archiver/archiverUtils'

// Describe only the worker operations consumed here, keeping its JS in the build.
type LibArchive = {
  getFilesArray(): Promise<Array<{ file: { _path: string } | string; path: string }>>
  extractSingleFile(path: string): Promise<{ fileData: Uint8Array } | undefined>
  close(): void
}
// The runtime forwards even null buffers to its worker; its JSDoc omits that case.
const Archive: { open(buffer: Buffer | null): unknown } = ArchiveRuntime

/**
 * Sanitize a path from an archive
 *
 * @param {string} filename
 * @returns {string}
 */
function sanitizeArchivePath(filename: string): string {
  const sanitizedPath = Path.normalize(sanitizePath(filename))
  if (!sanitizedPath || sanitizedPath === '.' || sanitizedPath === '..' || sanitizedPath.startsWith(`..${Path.sep}`) || Path.isAbsolute(sanitizedPath)) {
    throw new Error(`[CbrComicBookExtractor] Unsafe archive path "${filename}"`)
  }
  return sanitizedPath
}

class AbstractComicBookExtractor {
  comicPath: string

  constructor(comicPath: string) {
    this.comicPath = comicPath
  }

  async getBuffer(): Promise<Buffer | null> {
    if (!(await fs.pathExists(this.comicPath))) {
      Logger.error(`[parseComicMetadata] Comic path does not exist "${this.comicPath}"`)
      return null
    }
    try {
      return fs.readFile(this.comicPath)
    } catch (error) {
      Logger.error(`[parseComicMetadata] Failed to read comic at "${this.comicPath}"`, error)
      return null
    }
  }

  open(): Promise<void> {
    return Promise.reject(new Error('Not implemented'))
  }

  getFilePaths(): Promise<Array<string | undefined> | null> {
    return Promise.reject(new Error('Not implemented'))
  }

  extractToFile(filePath: string, outputFilePath: string): Promise<boolean> {
    void filePath
    void outputFilePath
    return Promise.reject(new Error('Not implemented'))
  }

  extractToBuffer(filePath: string): Promise<Buffer | Uint8Array | null | undefined> {
    void filePath
    return Promise.reject(new Error('Not implemented'))
  }

  close() {
    throw new Error('Not implemented')
  }
}

class CbrComicBookExtractor extends AbstractComicBookExtractor {
  archive: Awaited<ReturnType<typeof unrar.createExtractorFromFile>> | null
  tmpDir: string | null

  constructor(comicPath: string) {
    super(comicPath)
    this.archive = null
    this.tmpDir = null
  }

  async open() {
    this.tmpDir = global.MetadataPath ? Path.join(global.MetadataPath, 'tmp') : os.tmpdir()
    await fs.ensureDir(this.tmpDir)
    if (!(await isWritable(this.tmpDir))) throw new Error(`[CbrComicBookExtractor] Temp directory "${this.tmpDir}" is not writable`)
    this.archive = await unrar.createExtractorFromFile({
      filepath: this.comicPath,
      targetPath: this.tmpDir,
      filenameTransform: sanitizeArchivePath
    })
    Logger.debug(`[CbrComicBookExtractor] Opened comic book "${this.comicPath}". Using temp directory "${this.tmpDir}" for extraction.`)
  }

  getFilePaths(): Promise<string[] | null> {
    // Keep synchronous archive errors as promise rejections, as with the original async method.
    return new Promise((resolve) => {
      if (!this.archive) return resolve(null)
      const list = this.archive.getFileList()
      const fileHeaders = [...list.fileHeaders]
      const filePaths = fileHeaders.filter((fh) => !fh.flags.directory).map((fh) => fh.name)
      Logger.debug(`[CbrComicBookExtractor] Found ${filePaths.length} files in comic book "${this.comicPath}"`)
      resolve(filePaths)
    })
  }

  async removeEmptyParentDirs(file: string): Promise<void> {
    let dir = Path.dirname(file)
    while (dir !== '.') {
      // open() sets tmpDir before creating the archive used for extraction.
      const fullDirPath = Path.join(this.tmpDir!, dir)
      const files = await fs.readdir(fullDirPath)
      if (files.length > 0) break
      await fs.remove(fullDirPath)
      dir = Path.dirname(dir)
    }
  }

  getExtractedFilePath(file: string): { filePath: string; relativePath: string } {
    const sanitizedFile = sanitizeArchivePath(file)
    return {
      filePath: Path.join(this.tmpDir!, sanitizedFile),
      relativePath: sanitizedFile
    }
  }

  async extractToBuffer(file: string): Promise<Buffer | null> {
    if (!this.archive) return null
    const extracted = this.archive.extract({ files: [file] })
    const files = [...extracted.files]
    const { filePath, relativePath } = this.getExtractedFilePath(files[0].fileHeader.name)
    const fileData = await fs.readFile(filePath)
    await fs.remove(filePath)
    await this.removeEmptyParentDirs(relativePath)
    Logger.debug(`[CbrComicBookExtractor] Extracted file "${file}" from comic book "${this.comicPath}" to buffer, size: ${fileData.length}`)
    return fileData
  }

  async extractToFile(file: string, outputFilePath: string): Promise<boolean> {
    if (!this.archive) return false
    const extracted = this.archive.extract({ files: [file] })
    const files = [...extracted.files]
    const { filePath: extractedFilePath, relativePath } = this.getExtractedFilePath(files[0].fileHeader.name)
    await fs.move(extractedFilePath, outputFilePath, { overwrite: true })
    await this.removeEmptyParentDirs(relativePath)
    Logger.debug(`[CbrComicBookExtractor] Extracted file "${file}" from comic book "${this.comicPath}" to "${outputFilePath}"`)
    return true
  }

  close() {
    Logger.debug(`[CbrComicBookExtractor] Closed comic book "${this.comicPath}"`)
  }
}

class CbzComicBookExtractor extends AbstractComicBookExtractor {
  archive: LibArchive | null

  constructor(comicPath: string) {
    super(comicPath)
    this.archive = null
  }

  async open() {
    const buffer = await this.getBuffer()
    // The embedded JS documents a synchronous return, but open() resolves a worker-backed archive.
    const archive: unknown = await Archive.open(buffer)
    this.archive = archive as LibArchive
    Logger.debug(`[CbzComicBookExtractor] Opened comic book "${this.comicPath}"`)
  }

  async getFilePaths() {
    if (!this.archive) return null
    const list = await this.archive.getFilesArray()
    // Legacy directory placeholders are strings and have no _path property.
    const fileNames = list.map((fo) => (typeof fo.file === 'string' ? undefined : fo.file._path))
    Logger.debug(`[CbzComicBookExtractor] Found ${fileNames.length} files in comic book "${this.comicPath}"`)
    return fileNames
  }

  async extractToBuffer(file: string): Promise<Uint8Array | null | undefined> {
    if (!this.archive) return null
    const extracted = await this.archive.extractSingleFile(file)
    Logger.debug(`[CbzComicBookExtractor] Extracted file "${file}" from comic book "${this.comicPath}" to buffer, size: ${extracted?.fileData.length}`)
    return extracted?.fileData
  }

  async extractToFile(file: string, outputFilePath: string): Promise<boolean> {
    const data = await this.extractToBuffer(file)
    if (!data) return false
    await fs.writeFile(outputFilePath, data)
    Logger.debug(`[CbzComicBookExtractor] Extracted file "${file}" from comic book "${this.comicPath}" to "${outputFilePath}"`)
    return true
  }

  close() {
    this.archive?.close()
    Logger.debug(`[CbzComicBookExtractor] Closed comic book "${this.comicPath}"`)
  }
}

class CbzStreamZipComicBookExtractor extends AbstractComicBookExtractor {
  archive: StreamZip.async | null

  constructor(comicPath: string) {
    super(comicPath)
    this.archive = null
  }

  open(): Promise<void> {
    // Opening remains eager; ZIP readiness is awaited by the subsequent archive operations.
    return new Promise((resolve) => {
      this.archive = new StreamZip.async({ file: this.comicPath })
      Logger.debug(`[CbzStreamZipComicBookExtractor] Opened comic book "${this.comicPath}"`)
      resolve()
    })
  }

  async getFilePaths() {
    if (!this.archive) return null
    const entries = await this.archive.entries()
    const fileNames = Object.keys(entries).filter((entry) => !entries[entry].isDirectory)
    Logger.debug(`[CbzStreamZipComicBookExtractor] Found ${fileNames.length} files in comic book "${this.comicPath}"`)
    return fileNames
  }

  async extractToBuffer(file: string): Promise<Buffer | null> {
    if (!this.archive) return null
    const extracted = await this.archive?.entryData(file)
    Logger.debug(`[CbzStreamZipComicBookExtractor] Extracted file "${file}" from comic book "${this.comicPath}" to buffer, size: ${extracted.length}`)
    return extracted
  }

  async extractToFile(file: string, outputFilePath: string): Promise<boolean> {
    if (!this.archive) return false
    try {
      await this.archive.extract(file, outputFilePath)
      Logger.debug(`[CbzStreamZipComicBookExtractor] Extracted file "${file}" from comic book "${this.comicPath}" to "${outputFilePath}"`)
      return true
    } catch (error) {
      Logger.error(`[CbzStreamZipComicBookExtractor] Failed to extract file "${file}" to "${outputFilePath}"`, error)
      return false
    }
  }

  close() {
    void this.archive
      ?.close()
      .then(() => {
        Logger.debug(`[CbzStreamZipComicBookExtractor] Closed comic book "${this.comicPath}"`)
      })
      .catch((error) => {
        Logger.error(`[CbzStreamZipComicBookExtractor] Failed to close comic book "${this.comicPath}"`, error)
      })
  }
}

type ComicBookExtractor = CbrComicBookExtractor | CbzComicBookExtractor | CbzStreamZipComicBookExtractor

export function createComicBookExtractor(comicPath: string): ComicBookExtractor {
  const ext = Path.extname(comicPath).toLowerCase()
  if (ext === '.cbr') {
    return new CbrComicBookExtractor(comicPath)
  } else if (ext === '.cbz') {
    return new CbzStreamZipComicBookExtractor(comicPath)
  } else {
    throw new Error(`Unsupported comic book format "${ext}"`)
  }
}
