import { v4 as uuidv4 } from 'uuid'
import Logger from '../Logger'

interface ScanLogEntry {
  timestamp: string
  message: string
  levelName: string
  level: number
}

class ScanLogger {
  id: string | null = null
  type: string | null = null
  name: string | null = null
  verbose = false

  startedAt: number | null = null
  finishedAt: number | null = null
  elapsed: number | null = null

  authorsRemovedFromBooks: string[] = []
  authorsNumBooksChangedIds: Set<string> = new Set()
  seriesRemovedFromBooks: string[] = []

  logs: ScanLogEntry[] = []

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      elapsed: this.elapsed
    }
  }

  setData(type: string, name: string) {
    this.id = uuidv4()
    this.type = type
    this.name = name
    this.startedAt = Date.now()
  }

  setComplete() {
    this.finishedAt = Date.now()
    this.elapsed = this.finishedAt - (this.startedAt ?? 0)
  }

  addLog(level: number, ...args: unknown[]) {
    const logObj = {
      timestamp: new Date().toISOString(),
      message: args.join(' '),
      levelName: Logger.getLogLevelString(level),
      level
    }

    if (this.verbose) {
      Logger.debug(`[Scan] "${this.name}":`, ...args)
    }
    this.logs.push(logObj)
  }
}

export = ScanLogger
