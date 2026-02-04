const Path = require('path')
const uuidv4 = require('uuid').v4
const fs = require('../libs/fsExtra')
const date = require('../libs/dateAndTime')

const Logger = require('../Logger')
const { secondsToTimestamp, elapsedPretty } = require('../utils/index')

class LibraryScan {
  constructor() {
    this.id = null
    this.type = null
    /** @type {import('../models/Library')} */
    this.library = null
    this.verbose = false

    this.startedAt = null
    this.finishedAt = null
    this.elapsed = null

    this.resultsMissing = 0
    this.resultsAdded = 0
    this.resultsUpdated = 0

    /** @type {string[]} */
    this.authorsRemovedFromBooks = []
    /** @type {string[]} */
    this.seriesRemovedFromBooks = []

    this.logs = []
  }

  get loggerScannerLogsToKeep() {
    return global.ServerSettings?.loggerScannerLogsToKeep || 2
  }

  get libraryId() {
    return this.library.id
  }
  get libraryName() {
    return this.library.name
  }
  get libraryMediaType() {
    return this.library.mediaType
  }
  get libraryFolders() {
    return this.library.libraryFolders
  }

  get timestamp() {
    return new Date().toISOString()
  }

  get resultStats() {
    return `${this.resultsAdded} Added | ${this.resultsUpdated} Updated | ${this.resultsMissing} Missing`
  }
  get elapsedTimestamp() {
    return secondsToTimestamp(this.elapsed / 1000)
  }
  get logFilename() {
    return date.format(new Date(), 'YYYY-MM-DD') + '_' + this.id + '.txt'
  }
  get scanResultsString() {
    const strs = []
    if (this.resultsAdded) strs.push(`${this.resultsAdded} added`)
    if (this.resultsUpdated) strs.push(`${this.resultsUpdated} updated`)
    if (this.resultsMissing) strs.push(`${this.resultsMissing} missing`)
    const changesDetected = strs.length > 0 ? strs.join(', ') : 'No changes needed'
    const timeElapsed = `(${elapsedPretty(this.elapsed / 1000)})`
    return `${changesDetected} ${timeElapsed}`
  }

  get scanResults() {
    return {
      added: this.resultsAdded,
      updated: this.resultsUpdated,
      missing: this.resultsMissing,
      elapsed: this.elapsed,
      text: this.scanResultsString
    }
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      library: this.library.toJSON(),
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      elapsed: this.elapsed,
      resultsAdded: this.resultsAdded,
      resultsUpdated: this.resultsUpdated,
      resultsMissing: this.resultsMissing
    }
  }

  /**
   *
   * @param {import('../models/Library')} library
   * @param {string} type
   */
  setData(library, type = 'scan') {
    this.id = uuidv4()
    this.type = type
    this.library = library

    this.startedAt = Date.now()
  }

  setComplete() {
    this.finishedAt = Date.now()
    this.elapsed = this.finishedAt - this.startedAt
  }

  addLog(level, ...args) {
    const logObj = {
      timestamp: this.timestamp,
      message: args.join(' '),
      levelName: Logger.getLogLevelString(level),
      level
    }

    if (this.verbose) {
      Logger.debug(`[LibraryScan] "${this.libraryName}":`, ...args)
    }
    this.logs.push(logObj)
  }

  async saveLog() {
    const scanLogDir = Path.join(global.MetadataPath, 'logs', 'scans')

    await fs.ensureDir(scanLogDir)

    const outputPath = Path.join(scanLogDir, this.logFilename)
    const logLines = [JSON.stringify(this.toJSON())]
    this.logs.forEach((l) => {
      logLines.push(JSON.stringify(l))
    })
    await fs.writeFile(outputPath, logLines.join('\n') + '\n')

    Logger.info(`[LibraryScan] Scan log saved "${outputPath}"`)

    await this.purgeOldScanLogs(scanLogDir)
  }

  /**
   * Keep the most recent N scan logs in metadata/logs/scans.
   * Where N is the server setting `loggerScannerLogsToKeep`.
   *
   * @param {string} scanLogDir
   */
  async purgeOldScanLogs(scanLogDir) {
    const scanLogsToKeep = this.loggerScannerLogsToKeep

    let scanFiles
    try {
      scanFiles = await fs.readdir(scanLogDir)
    } catch (error) {
      Logger.warn(`[LibraryScan] Failed to read scan log dir "${scanLogDir}": ${error.message}`)
      return
    }

    const scanLogFiles = (scanFiles || []).filter((f) => Path.extname(f) === '.txt').sort()
    if (scanLogFiles.length <= scanLogsToKeep) return

    const filesToRemove = scanLogFiles.slice(0, scanLogFiles.length - scanLogsToKeep)
    for (const file of filesToRemove) {
      const fullPath = Path.join(scanLogDir, file)
      try {
        await fs.unlink(fullPath)
        Logger.info(`[LibraryScan] Removed scan log "${fullPath}"`)
      } catch (error) {
        Logger.warn(`[LibraryScan] Failed to remove scan log "${fullPath}": ${error.message}`)
      }
    }
  }
}
module.exports = LibraryScan
