const Path = require('path')
const os = require('os')
const unrar = require('node-unrar-js')
const Logger = require('../Logger')
const fs = require('../libs/fsExtra')
const StreamZip = require('../libs/nodeStreamZip')
const Archive = require('../libs/libarchive/archive')
const { isWritable } = require('./fileUtils')

class AbstractComicBookExtractor {
  constructor(comicPath) {
    this.comicPath = comicPath
  }

  async getBuffer() {
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

  async open() {
    throw new Error('Not implemented')
  }

  async getFilePaths() {
    throw new Error('Not implemented')
  }

  async extractToFile(filePath, outputFilePath) {
    throw new Error('Not implemented')
  }

  async extractToBuffer(filePath) {
    throw new Error('Not implemented')
  }

  close() {
    throw new Error('Not implemented')
  }
}

class CbrComicBookExtractor extends AbstractComicBookExtractor {
  constructor(comicPath) {
    super(comicPath)
    this.archive = null
    this.tmpDir = null
  }

  async open() {
    this.tmpDir = global.MetadataPath ? Path.join(global.MetadataPath, 'tmp') : os.tmpdir()
    await fs.ensureDir(this.tmpDir)
    if (!(await isWritable(this.tmpDir))) throw new Error(`[CbrComicBookExtractor] Temp directory "${this.tmpDir}" is not writable`)
    this.archive = await unrar.createExtractorFromFile({ filepath: this.comicPath, targetPath: this.tmpDir })
    Logger.debug(`[CbrComicBookExtractor] Opened comic book "${this.comicPath}". Using temp directory "${this.tmpDir}" for extraction.`)
  }

  async getFilePaths() {
    if (!this.archive) return null
    const list = this.archive.getFileList()
    const fileHeaders = [...list.fileHeaders]
    const filePaths = fileHeaders.filter((fh) => !fh.flags.directory).map((fh) => fh.name)
    Logger.debug(`[CbrComicBookExtractor] Found ${filePaths.length} files in comic book "${this.comicPath}"`)
    return filePaths
  }

  async removeEmptyParentDirs(file) {
    let dir = Path.dirname(file)
    while (dir !== '.') {
      const fullDirPath = Path.join(this.tmpDir, dir)
      const files = await fs.readdir(fullDirPath)
      if (files.length > 0) break
      await fs.remove(fullDirPath)
      dir = Path.dirname(dir)
    }
  }

  async extractToBuffer(file) {
    if (!this.archive) return null
    const extracted = this.archive.extract({ files: [file] })
    const files = [...extracted.files]
    const filePath = Path.join(this.tmpDir, files[0].fileHeader.name)
    const fileData = await fs.readFile(filePath)
    await fs.remove(filePath)
    await this.removeEmptyParentDirs(files[0].fileHeader.name)
    Logger.debug(`[CbrComicBookExtractor] Extracted file "${file}" from comic book "${this.comicPath}" to buffer, size: ${fileData.length}`)
    return fileData
  }

  async extractToFile(file, outputFilePath) {
    if (!this.archive) return false
    const extracted = this.archive.extract({ files: [file] })
    const files = [...extracted.files]
    const extractedFilePath = Path.join(this.tmpDir, files[0].fileHeader.name)
    await fs.move(extractedFilePath, outputFilePath, { overwrite: true })
    await this.removeEmptyParentDirs(files[0].fileHeader.name)
    Logger.debug(`[CbrComicBookExtractor] Extracted file "${file}" from comic book "${this.comicPath}" to "${outputFilePath}"`)
    return true
  }

  close() {
    Logger.debug(`[CbrComicBookExtractor] Closed comic book "${this.comicPath}"`)
  }
}

class CbzComicBookExtractor extends AbstractComicBookExtractor {
  constructor(comicPath) {
    super(comicPath)
    this.archive = null
  }

  async open() {
    const buffer = await this.getBuffer()
    this.archive = await Archive.open(buffer)
    Logger.debug(`[CbzComicBookExtractor] Opened comic book "${this.comicPath}"`)
  }

  async getFilePaths() {
    if (!this.archive) return null
    const list = await this.archive.getFilesArray()
    const fileNames = list.map((fo) => fo.file._path)
    Logger.debug(`[CbzComicBookExtractor] Found ${fileNames.length} files in comic book "${this.comicPath}"`)
    return fileNames
  }

  async extractToBuffer(file) {
    if (!this.archive) return null
    const extracted = await this.archive.extractSingleFile(file)
    Logger.debug(`[CbzComicBookExtractor] Extracted file "${file}" from comic book "${this.comicPath}" to buffer, size: ${extracted?.fileData.length}`)
    return extracted?.fileData
  }

  async extractToFile(file, outputFilePath) {
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
  constructor(comicPath) {
    super(comicPath)
    this.archive = null
  }

  async open() {
    this.archive = new StreamZip.async({ file: this.comicPath })
    Logger.debug(`[CbzStreamZipComicBookExtractor] Opened comic book "${this.comicPath}"`)
  }

  async getFilePaths() {
    if (!this.archive) return null
    const entries = await this.archive.entries()
    const fileNames = Object.keys(entries).filter((entry) => !entries[entry].isDirectory)
    Logger.debug(`[CbzStreamZipComicBookExtractor] Found ${fileNames.length} files in comic book "${this.comicPath}"`)
    return fileNames
  }

  async extractToBuffer(file) {
    if (!this.archive) return null
    const extracted = await this.archive?.entryData(file)
    Logger.debug(`[CbzStreamZipComicBookExtractor] Extracted file "${file}" from comic book "${this.comicPath}" to buffer, size: ${extracted.length}`)
    return extracted
  }

  async extractToFile(file, outputFilePath) {
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
    this.archive
      ?.close()
      .then(() => {
        Logger.debug(`[CbzStreamZipComicBookExtractor] Closed comic book "${this.comicPath}"`)
      })
      .catch((error) => {
        Logger.error(`[CbzStreamZipComicBookExtractor] Failed to close comic book "${this.comicPath}"`, error)
      })
  }
}

function createComicBookExtractor(comicPath) {
  const ext = Path.extname(comicPath).toLowerCase()
  if (ext === '.cbr') {
    return new CbrComicBookExtractor(comicPath)
  } else if (ext === '.cbz') {
    return new CbzStreamZipComicBookExtractor(comicPath)
  } else {
    throw new Error(`Unsupported comic book format "${ext}"`)
  }
}
module.exports = { createComicBookExtractor }
