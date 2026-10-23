import Path from 'path'
import { v4 as uuidv4 } from 'uuid'
import fs from '../libs/fsExtra'
import date from '../libs/dateAndTime'

import Logger from '../Logger'
import { secondsToTimestamp, elapsedPretty } from '../utils/index'
import type Library from '../models/Library'

interface LibraryScanLogEntry {
  timestamp: string
  message: string
  levelName: string
  level: number
}

class LibraryScan {
  id: string | null = null
  type: string | null = null
  library: Library | null = null
  verbose = false

  startedAt: number | null = null
  finishedAt: number | null = null
  elapsed: number | null = null

  resultsMissing = 0
  resultsAdded = 0
  resultsUpdated = 0

  authorsRemovedFromBooks: string[] = []
  authorsNumBooksChangedIds: Set<string> = new Set()
  seriesRemovedFromBooks: string[] = []

  logs: LibraryScanLogEntry[] = []

  get libraryId() {
    return this.library!.id
  }
  get libraryName() {
    return this.library!.name
  }
  get libraryMediaType() {
    return this.library!.mediaType
  }
  get libraryFolders() {
    return this.library!.libraryFolders
  }

  get timestamp(): string {
    return new Date().toISOString()
  }

  get resultStats(): string {
    return `${this.resultsAdded} Added | ${this.resultsUpdated} Updated | ${this.resultsMissing} Missing`
  }
  get elapsedTimestamp() {
    return secondsToTimestamp((this.elapsed ?? 0) / 1000)
  }
  get logFilename(): string {
    return date.format(new Date(), 'YYYY-MM-DD') + '_' + this.id + '.txt'
  }
  get scanResultsString(): string {
    const strs = []
    if (this.resultsAdded) strs.push(`${this.resultsAdded} added`)
    if (this.resultsUpdated) strs.push(`${this.resultsUpdated} updated`)
    if (this.resultsMissing) strs.push(`${this.resultsMissing} missing`)
    const changesDetected = strs.length > 0 ? strs.join(', ') : 'No changes needed'
    const timeElapsed = `(${elapsedPretty((this.elapsed ?? 0) / 1000)})`
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
      library: this.library!.toJSON(),
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      elapsed: this.elapsed,
      resultsAdded: this.resultsAdded,
      resultsUpdated: this.resultsUpdated,
      resultsMissing: this.resultsMissing
    }
  }

  setData(library: Library, type = 'scan') {
    this.id = uuidv4()
    this.type = type
    this.library = library

    this.startedAt = Date.now()
  }

  setComplete() {
    this.finishedAt = Date.now()
    this.elapsed = this.finishedAt - (this.startedAt ?? 0)
  }

  addLog(level: number, ...args: unknown[]) {
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
    const scanLogDir = Path.join(global.MetadataPath!, 'logs', 'scans')

    if (!(await fs.pathExists(scanLogDir))) {
      await fs.mkdir(scanLogDir)
    }

    const outputPath = Path.join(scanLogDir, this.logFilename)
    const logLines = [JSON.stringify(this.toJSON())]
    this.logs.forEach((l) => {
      logLines.push(JSON.stringify(l))
    })
    await fs.writeFile(outputPath, logLines.join('\n') + '\n')

    Logger.info(`[LibraryScan] Scan log saved "${outputPath}"`)
  }
}

export = LibraryScan
