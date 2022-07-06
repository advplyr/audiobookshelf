const Path = require('path')
const date = require('date-and-time')
const fs = require('../libs/fsExtra')
const { readTextFile } = require('../utils/fileUtils')
const Logger = require('../Logger')

class DailyLog {
  constructor() {
    this.id = null
    this.datePretty = null

    this.dailyLogDirPath = null
    this.filename = null
    this.path = null
    this.fullPath = null

    this.createdAt = null

    this.logs = []
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
      datePretty: this.datePretty,
      path: this.path,
      dailyLogDirPath: this.dailyLogDirPath,
      fullPath: this.fullPath,
      filename: this.filename,
      createdAt: this.createdAt
    }
  }

  setData(data) {
    this.id = date.format(new Date(), 'YYYY-MM-DD')
    this.datePretty = date.format(new Date(), 'ddd, MMM D YYYY')

    this.dailyLogDirPath = data.dailyLogDirPath

    this.filename = this.id + '.txt'
    this.path = Path.join('backups', this.filename)
    this.fullPath = Path.join(this.dailyLogDirPath, this.filename)

    this.createdAt = Date.now()
  }

  async appendBufferedLogs() {
    var buffered = [...this.bufferedLogLines]
    this.bufferedLogLines = []

    var oneBigLog = ''
    buffered.forEach((logLine) => {
      oneBigLog += logLine
    })
    this.appendLogLine(oneBigLog)
  }

  async appendLog(logObj) {
    this.logs.push(logObj)
    var line = JSON.stringify(logObj) + '\n'
    this.appendLogLine(line)
  }

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
      this.appendBufferedLogs()
    }
  }

  async loadLogs() {
    var exists = await fs.pathExists(this.fullPath)
    if (!exists) {
      console.error('Daily log does not exist')
      return
    }

    var text = await readTextFile(this.fullPath)

    var hasFailures = false

    var logLines = text.split(/\r?\n/)
    // remove last log if empty
    if (logLines.length && !logLines[logLines.length - 1]) logLines = logLines.slice(0, -1)
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
      var newLogLines = this.logs.map(l => JSON.stringify(l)).join('\n') + '\n'
      await fs.writeFile(this.fullPath, newLogLines)
      console.log('Re-Saved log file to remove bad lines')
    }

    Logger.debug(`[DailyLog] ${this.id}: Loaded ${this.logs.length} Logs`)
  }
}
module.exports = DailyLog