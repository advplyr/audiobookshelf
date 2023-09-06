const Path = require('path')
const fs = require('../libs/fsExtra')

const DailyLog = require('../objects/DailyLog')

const Logger = require('../Logger')

const TAG = '[LogManager]'

class LogManager {
  constructor() {
    this.DailyLogPath = Path.posix.join(global.MetadataPath, 'logs', 'daily')
    this.ScanLogPath = Path.posix.join(global.MetadataPath, 'logs', 'scans')

    this.currentDailyLog = null
    this.dailyLogBuffer = []
    this.dailyLogFiles = []
  }

  get loggerDailyLogsToKeep() {
    return global.ServerSettings.loggerDailyLogsToKeep || 7
  }

  async ensureLogDirs() {
    await fs.ensureDir(this.DailyLogPath)
    await fs.ensureDir(this.ScanLogPath)
  }

  async ensureScanLogDir() {
    if (!(await fs.pathExists(this.ScanLogPath))) {
      await fs.mkdir(this.ScanLogPath)
    }
  }

  async init() {
    await this.ensureLogDirs()

    // Load daily logs
    await this.scanLogFiles()

    // Check remove extra daily logs
    if (this.dailyLogFiles.length > this.loggerDailyLogsToKeep) {
      const dailyLogFilesCopy = [...this.dailyLogFiles]
      for (let i = 0; i < dailyLogFilesCopy.length - this.loggerDailyLogsToKeep; i++) {
        await this.removeLogFile(dailyLogFilesCopy[i])
      }
    }

    const currentDailyLogFilename = DailyLog.getCurrentDailyLogFilename()
    Logger.info(TAG, `Init current daily log filename: ${currentDailyLogFilename}`)

    this.currentDailyLog = new DailyLog()
    this.currentDailyLog.setData({ dailyLogDirPath: this.DailyLogPath })

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
    const dailyFiles = await fs.readdir(this.DailyLogPath)
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
    const oldestLog = this.dailyLogFiles[0]
    return this.removeLogFile(oldestLog)
  }

  async removeLogFile(filename) {
    const fullPath = Path.join(this.DailyLogPath, filename)
    const exists = await fs.pathExists(fullPath)
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
      const newDailyLog = new DailyLog()
      newDailyLog.setData({ dailyLogDirPath: this.DailyLogPath })
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

    const lastLogs = this.currentDailyLog.logs.slice(-5000)
    socket.emit('daily_logs', lastLogs)
  }
}
module.exports = LogManager