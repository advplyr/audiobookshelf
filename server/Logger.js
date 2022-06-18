const date = require('date-and-time')
const { LogLevel } = require('./utils/constants')

class Logger {
  constructor() {
    this.logLevel = process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.TRACE
    this.socketListeners = []

    this.logManager = null
  }

  get timestamp() {
    return date.format(new Date(), 'YYYY-MM-DD HH:mm:ss')
  }

  get levelString() {
    for (const key in LogLevel) {
      if (LogLevel[key] === this.logLevel) {
        return key
      }
    }
    return 'UNKNOWN'
  }

  getLogLevelString(level) {
    for (const key in LogLevel) {
      if (LogLevel[key] === level) {
        return key
      }
    }
    return 'UNKNOWN'
  }

  addSocketListener(socket, level) {
    var index = this.socketListeners.findIndex(s => s.id === socket.id)
    if (index >= 0) {
      this.socketListeners.splice(index, 1, {
        id: socket.id,
        socket,
        level
      })
    } else {
      this.socketListeners.push({
        id: socket.id,
        socket,
        level
      })
    }
  }

  removeSocketListener(socketId) {
    this.socketListeners = this.socketListeners.filter(s => s.id !== socketId)
  }

  handleLog(level, args) {
    const logObj = {
      timestamp: this.timestamp,
      message: args.join(' '),
      levelName: this.getLogLevelString(level),
      level
    }

    if (level >= this.logLevel && this.logManager) {
      this.logManager.logToFile(logObj)
    }

    this.socketListeners.forEach((socketListener) => {
      if (socketListener.level <= level) {
        socketListener.socket.emit('log', logObj)
      }
    })
  }

  setLogLevel(level) {
    this.logLevel = level
    this.debug(`Set Log Level to ${this.levelString}`)
  }

  trace(...args) {
    if (this.logLevel > LogLevel.TRACE) return
    console.trace(`[${this.timestamp}] TRACE:`, ...args)
    this.handleLog(LogLevel.TRACE, args)
  }

  debug(...args) {
    if (this.logLevel > LogLevel.DEBUG) return
    console.debug(`[${this.timestamp}] DEBUG:`, ...args)
    this.handleLog(LogLevel.DEBUG, args)
  }

  info(...args) {
    if (this.logLevel > LogLevel.INFO) return
    console.info(`[${this.timestamp}]  INFO:`, ...args)
    this.handleLog(LogLevel.INFO, args)
  }

  warn(...args) {
    if (this.logLevel > LogLevel.WARN) return
    console.warn(`[${this.timestamp}]  WARN:`, ...args)
    this.handleLog(LogLevel.WARN, args)
  }

  error(...args) {
    if (this.logLevel > LogLevel.ERROR) return
    console.error(`[${this.timestamp}] ERROR:`, ...args)
    this.handleLog(LogLevel.ERROR, args)
  }

  fatal(...args) {
    console.error(`[${this.timestamp}] FATAL:`, ...args)
    this.handleLog(LogLevel.FATAL, args)
  }

  note(...args) {
    console.log(`[${this.timestamp}] NOTE:`, ...args)
    this.handleLog(LogLevel.NOTE, args)
  }
}
module.exports = new Logger()