const uuidv4 = require("uuid").v4
const Logger = require('../Logger')
const { LogLevel } = require('../utils/constants')

class ScanLogger {
  constructor() {
    this.id = null
    this.type = null
    this.name = null
    this.verbose = false

    this.startedAt = null
    this.finishedAt = null
    this.elapsed = null

    /** @type {string[]} */
    this.authorsRemovedFromBooks = []
    /** @type {string[]} */
    this.seriesRemovedFromBooks = []

    this.logs = []
  }

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

  setData(type, name) {
    this.id = uuidv4()
    this.type = type
    this.name = name
    this.startedAt = Date.now()
  }

  setComplete() {
    this.finishedAt = Date.now()
    this.elapsed = this.finishedAt - this.startedAt
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
      timestamp: (new Date()).toISOString(),
      message: args.join(' '),
      levelName: this.getLogLevelString(level),
      level
    }

    if (this.verbose) {
      Logger.debug(`[Scan] "${this.name}":`, ...args)
    }
    this.logs.push(logObj)
  }
}
module.exports = ScanLogger