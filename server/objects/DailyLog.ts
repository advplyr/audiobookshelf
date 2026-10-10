const Path = require('path')
const date = require('../libs/dateAndTime')
const fs = require('../libs/fsExtra')
const fileUtils = require('../utils/fileUtils')
const Logger = require('../Logger')

class DailyLog {
  /**
   * 
   * @param {string} dailyLogDirPath Path to daily logs /metadata/logs/daily
   */
  constructor(dailyLogDirPath) {
    this.id = date.format(new Date(), 'YYYY-MM-DD')

    this.dailyLogDirPath = dailyLogDirPath
    this.filename = this.id + '.txt'
    this.fullPath = Path.join(this.dailyLogDirPath, this.filename)

    this.createdAt = Date.now()

    /** @type {import('../managers/LogManager').LogObject[]} */
    this.logs = []
    /** @type {string[]} */
    this.bufferedLogLines = []

    this.locked = false
  }

  static getCurrentDailyLogFilename() {
    return date.format(new Date(), 'YYYY-MM-DD') + '.txt'
  }

  static getCurrentDateString() {
    return date.format(new Date(), 'YYYY-MM-DD')
  }

  toJSON() {
    return {
      id: this.id,
      dailyLogDirPath: this.dailyLogDirPath,
      fullPath: this.fullPath,
      filename: this.filename,
      createdAt: this.createdAt
    }
  }

  /**
   * Append all buffered lines to daily log file
   */
  appendBufferedLogs() {
    let buffered = [...this.bufferedLogLines]
    this.bufferedLogLines = []

    let oneBigLog = ''
    buffered.forEach((logLine) => {
      oneBigLog += logLine
    })
    return this.appendLogLine(oneBigLog)
  }

  /**
   * 
   * @param {import('../managers/LogManager').LogObject} logObj 
   */
  appendLog(logObj) {
    this.logs.push(logObj)
    return this.appendLogLine(JSON.stringify(logObj) + '\n')
  }

  /**
   * Append log to daily log file
   * 
   * @param {string} line 
   */
  async appendLogLine(line) {
    if (this.locked) {
      this.bufferedLogLines.push(line)
      return
    }
    this.locked = true

    await fs.writeFile(this.fullPath, line, { flag: "a+" }).catch((error) => {
      console.log('[DailyLog] Append log failed', error)
    })

    this.locked = false
    if (this.bufferedLogLines.length) {
      await this.appendBufferedLogs()
    }
  }

  /**
   * Load all logs from file
   * Parses lines and re-saves the file if bad lines are removed
   */
  async loadLogs() {
    if (!await fs.pathExists(this.fullPath)) {
      console.error('Daily log does not exist')
      return
    }

    const text = await fileUtils.readTextFile(this.fullPath)

    let hasFailures = false

    let logLines = text.split(/\r?\n/)
    // remove last log if empty
    if (logLines.length && !logLines[logLines.length - 1]) logLines = logLines.slice(0, -1)

    // JSON parse log lines
    this.logs = logLines.map(t => {
      if (!t) {
        hasFailures = true
        return null
      }
      try {
        return JSON.parse(t)
      } catch (err) {
        console.error('Failed to parse log line', t, err)
        hasFailures = true
        return null
      }
    }).filter(l => !!l)

    // Rewrite log file to remove errors
    if (hasFailures) {
      const newLogLines = this.logs.map(l => JSON.stringify(l)).join('\n') + '\n'
      await fs.writeFile(this.fullPath, newLogLines)
      console.log('Re-Saved log file to remove bad lines')
    }

    Logger.debug(`[DailyLog] ${this.id}: Loaded ${this.logs.length} Logs`)
  }
}
module.exports = DailyLog