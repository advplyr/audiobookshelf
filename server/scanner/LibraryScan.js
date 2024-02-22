const Path = require('path')
const uuidv4 = require("uuid").v4
const fs = require('../libs/fsExtra')
const date = require('../libs/dateAndTime')

const Logger = require('../Logger')
const Library = require('../objects/Library')
const { LogLevel } = require('../utils/constants')
const { secondsToTimestamp, elapsedPretty } = require('../utils/index')

class LibraryScan {
  constructor() {
    this.id = null
    this.type = null
    /** @type {import('../objects/Library')} */
    this.library = null
    this.verbose = false

    this.startedAt = null
    this.finishedAt = null
    this.elapsed = null
    this.error = null

    this.resultsMissing = 0
    this.resultsAdded = 0
    this.resultsUpdated = 0

    /** @type {string[]} */
    this.authorsRemovedFromBooks = []
    /** @type {string[]} */
    this.seriesRemovedFromBooks = []

    this.logs = []
  }

  get libraryId() { return this.library.id }
  get libraryName() { return this.library.name }
  get libraryMediaType() { return this.library.mediaType }
  get folders() { return this.library.folders }

  get timestamp() {
    return (new Date()).toISOString()
  }

  get resultStats() {
    return `${this.resultsAdded} Added | ${this.resultsUpdated} Updated | ${this.resultsMissing} Missing`
  }
  get elapsedTimestamp() {
    return secondsToTimestamp(this.elapsed / 1000)
  }
  get getScanEmitData() {
    return {
      id: this.libraryId,
      type: this.type,
      name: this.libraryName,
      error: this.error,
      results: {
        added: this.resultsAdded,
        updated: this.resultsUpdated,
        missing: this.resultsMissing
      }
    }
  }
  get totalResults() {
    return this.resultsAdded + this.resultsUpdated + this.resultsMissing
  }
  get logFilename() {
    return date.format(new Date(), 'YYYY-MM-DD') + '_' + this.id + '.txt'
  }
  get scanResultsString() {
    if (this.error) return this.error
    const strs = []
    if (this.resultsAdded) strs.push(`${this.resultsAdded} added`)
    if (this.resultsUpdated) strs.push(`${this.resultsUpdated} updated`)
    if (this.resultsMissing) strs.push(`${this.resultsMissing} missing`)
    if (!strs.length) return `Everything was up to date (${elapsedPretty(this.elapsed / 1000)})`
    return strs.join(', ') + ` (${elapsedPretty(this.elapsed / 1000)})`
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      library: this.library.toJSON(),
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      elapsed: this.elapsed,
      error: this.error,
      resultsAdded: this.resultsAdded,
      resultsUpdated: this.resultsUpdated,
      resultsMissing: this.resultsMissing
    }
  }

  setData(library, type = 'scan') {
    this.id = uuidv4()
    this.type = type
    this.library = new Library(library.toJSON()) // clone library

    this.startedAt = Date.now()
  }

  /**
   * 
   * @param {string} error 
   */
  setComplete(error = null) {
    this.finishedAt = Date.now()
    this.elapsed = this.finishedAt - this.startedAt
    this.error = error
  }

  getLogLevelString(level) {
    for (const key in LogLevel) {
      if (LogLevel[key] === level) {
        return key
      }
    }
    return 'UNKNOWN'
  }

  addLog(level, ...args) {
    const logObj = {
      timestamp: this.timestamp,
      message: args.join(' '),
      levelName: this.getLogLevelString(level),
      level
    }

    if (this.verbose) {
      Logger.debug(`[LibraryScan] "${this.libraryName}":`, ...args)
    }
    this.logs.push(logObj)
  }

  async saveLog() {
    const scanLogDir = Path.join(global.MetadataPath, 'logs', 'scans')

    if (!(await fs.pathExists(scanLogDir))) {
      await fs.mkdir(scanLogDir)
    }

    const outputPath = Path.join(scanLogDir, this.logFilename)
    const logLines = [JSON.stringify(this.toJSON())]
    this.logs.forEach(l => {
      logLines.push(JSON.stringify(l))
    })
    await fs.writeFile(outputPath, logLines.join('\n') + '\n')

    Logger.info(`[LibraryScan] Scan log saved "${outputPath}"`)
  }
}
module.exports = LibraryScan