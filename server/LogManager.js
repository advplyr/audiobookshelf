const Path = require('path')
const fs = require('fs-extra')

const DailyLog = require('./objects/DailyLog')

const Logger = require('./Logger')

const TAG = '[LogManager]'

class LogManager {
  constructor(MetadataPath, db) {
    this.db = db
    this.MetadataPath = MetadataPath

    this.logDirPath = Path.join(this.MetadataPath, 'logs')
    this.dailyLogDirPath = Path.join(this.logDirPath, 'daily')

    this.currentDailyLog = null
    this.dailyLogBuffer = []
    this.dailyLogFiles = []
  }

  get serverSettings() {
    return this.db.serverSettings || {}
  }

  get loggerDailyLogsToKeep() {
    return this.serverSettings.loggerDailyLogsToKeep || 7
  }

  async init() {
    // Load daily logs
    await this.scanLogFiles()

    // Check remove extra daily logs
    if (this.dailyLogFiles.length > this.loggerDailyLogsToKeep) {
      var dailyLogFilesCopy = [...this.dailyLogFiles]
      for (let i = 0; i < dailyLogFilesCopy.length - this.loggerDailyLogsToKeep; i++) {
        var logFileToRemove = dailyLogFilesCopy[i]
        await this.removeLogFile(logFileToRemove)
      }
    }

    var currentDailyLogFilename = DailyLog.getCurrentDailyLogFilename()
    Logger.info(TAG, `Init current daily log filename: ${currentDailyLogFilename}`)

    this.currentDailyLog = new DailyLog()
    this.currentDailyLog.setData({ dailyLogDirPath: this.dailyLogDirPath })

    if (this.dailyLogFiles.includes(currentDailyLogFilename)) {
      Logger.debug(TAG, `Daily log file already exists - set in Logger`)
      await this.currentDailyLog.loadLogs()
    } else {
      this.dailyLogFiles.push(this.currentDailyLog.filename)
    }

    // Log buffered Logs
    if (this.dailyLogBuffer.length) {
      this.dailyLogBuffer.forEach((logObj) => {
        this.currentDailyLog.appendLog(logObj)
      })
      this.dailyLogBuffer = []
    }
  }

  async scanLogFiles() {
    await fs.ensureDir(this.dailyLogDirPath)
    var dailyFiles = await fs.readdir(this.dailyLogDirPath)
    if (dailyFiles && dailyFiles.length) {
      dailyFiles.forEach((logFile) => {
        if (Path.extname(logFile) === '.txt') {
          Logger.debug('Daily Log file found', logFile)
          this.dailyLogFiles.push(logFile)
        } else {
          Logger.debug(TAG, 'Unknown File in Daily log files dir', logFile)
        }
      })
    }
    this.dailyLogFiles.sort()
  }

  async removeOldestLog() {
    if (!this.dailyLogFiles.length) return
    var oldestLog = this.dailyLogFiles[0]
    return this.removeLogFile(oldestLog)
  }

  async removeLogFile(filename) {
    var fullPath = Path.join(this.dailyLogDirPath, filename)
    var exists = await fs.pathExists(fullPath)
    if (!exists) {
      Logger.error(TAG, 'Invalid log dne ' + fullPath)
      this.dailyLogFiles = this.dailyLogFiles.filter(dlf => dlf.filename !== filename)
    } else {
      try {
        await fs.unlink(fullPath)
        Logger.info(TAG, 'Removed daily log: ' + filename)
        this.dailyLogFiles = this.dailyLogFiles.filter(dlf => dlf.filename !== filename)
      } catch (error) {
        Logger.error(TAG, 'Failed to unlink log file ' + fullPath)
      }
    }
  }

  logToFile(logObj) {
    if (!this.currentDailyLog) {
      this.dailyLogBuffer.push(logObj)
      return
    }

    // Check log rolls to next day
    if (this.currentDailyLog.id !== DailyLog.getCurrentDateString()) {
      var newDailyLog = new DailyLog()
      newDailyLog.setData({ dailyLogDirPath: this.dailyLogDirPath })
      this.currentDailyLog = newDailyLog
      if (this.dailyLogFiles.length > this.loggerDailyLogsToKeep) {
        this.removeOldestLog()
      }
    }

    // Append log line to log file
    this.currentDailyLog.appendLog(logObj)
  }

  socketRequestDailyLogs(socket) {
    if (!this.currentDailyLog) {
      return
    }

    var lastLogs = this.currentDailyLog.logs.slice(-5000)
    socket.emit('daily_logs', lastLogs)
  }
}
module.exports = LogManager